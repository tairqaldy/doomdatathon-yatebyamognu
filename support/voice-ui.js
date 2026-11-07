// /support voice: mic in the composer (tap or hold → Whisper → text sent through the normal form) and a speaker toggle
// in the header (AIM's replies read aloud with the cached OpenAI voice, browser voice as fallback). Built on
// shared/voice.js. Self-contained on purpose: it only needs the page's ids (#sp-form, #sp-input, #sp-send, .sp-head,
// .sp-lang) and the live store, so support.js needs no changes. Brings its own stylesheet (support/voice.css).
import * as store from '/shared/live-store.js';
import { createVoice } from '/shared/voice.js';

const SESSION_KEY = 'cqa-support-session'; // written by support.js
const SPEAK_KEY = 'cqa-support-speak';
const STR = {
  RU: { mic: 'Сказать голосом', mic_stop: 'Отправить запись', speak_on: 'Озвучивать ответы AIM', speak_off: 'Не озвучивать ответы',
    listening: 'Слушаю… отпустите или нажмите ещё раз', starting: 'Включаю микрофон…', transcribing: 'Распознаю речь…',
    denied: 'Нет доступа к микрофону. Разрешите его в браузере или напишите текстом.', error: 'Не расслышал. Попробуйте ещё раз или напишите.',
    greet: 'Здравствуйте! Я AIM, ассистент Freedom Broker. Отвечаю на то, что знаю точно, а если нужно, позову специалиста.' },
  KZ: { mic: 'Дауыспен айту', mic_stop: 'Жазбаны жіберу', speak_on: 'AIM жауаптарын дыбыстау', speak_off: 'Жауаптарды дыбыстамау',
    listening: 'Тыңдап тұрмын… жіберіп немесе қайта басыңыз', starting: 'Микрофонды қосып жатырмын…', transcribing: 'Сөзді танып жатырмын…',
    denied: 'Микрофонға рұқсат жоқ. Браузерде рұқсат беріңіз немесе жазып жіберіңіз.', error: 'Естімей қалдым. Қайталап көріңіз немесе жазыңыз.',
    greet: 'Сәлеметсіз бе! Мен AIM, Freedom Broker көмекшісімін. Нақты білетінімді айтамын, қажет болса маманды шақырамын.' },
  EN: { mic: 'Speak', mic_stop: 'Send recording', speak_on: 'Read AIM replies aloud', speak_off: 'Stop reading replies aloud',
    listening: 'Listening… release or tap again', starting: 'Turning the mic on…', transcribing: 'Transcribing…',
    denied: 'No microphone access. Allow it in the browser or type instead.', error: 'Didn\'t catch that. Try again or type.',
    greet: 'Hello! I\'m AIM, the Freedom Broker assistant. I answer what I know for sure and call a specialist when needed.' },
};
const ICON = {
  mic: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.75a2.5 2.5 0 0 0-2.5 2.5v4.5a2.5 2.5 0 0 0 5 0v-4.5a2.5 2.5 0 0 0-2.5-2.5Zm-5 7a5 5 0 0 0 10 0M10 14.75v2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  speak: '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.75 8v4h3l4.25 3.25V4.75L6.75 8h-3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path class="spv-wave" d="M13.75 7.5a3.5 3.5 0 0 1 0 5M15.75 5.5a6.25 6.25 0 0 1 0 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

const $ = (s) => document.querySelector(s);
const form = $('#sp-form'); const input = $('#sp-input'); const sendBtn = $('#sp-send'); const head = $('.sp-head');
if (form && input && head) mount();

function mount() {
  const lang = () => ({ kk: 'KZ', kz: 'KZ', en: 'EN' })[(document.documentElement.lang || 'ru').slice(0, 2).toLowerCase()] || 'RU';
  const t = (k) => STR[lang()][k] ?? STR.RU[k];
  const vox = createVoice({ getLang: lang });
  let speakOn = false; try { speakOn = localStorage.getItem(SPEAK_KEY) === '1'; } catch {}
  let voiceTurn = false; let submittingVoice = false; let restoreTimer = null;

  // stylesheet first, controls after, so they never flash unstyled
  const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('./voice.css', import.meta.url).href });
  document.head.append(css);

  const speakBtn = document.createElement('button');
  speakBtn.type = 'button'; speakBtn.className = 'spv-speak'; speakBtn.innerHTML = ICON.speak;
  const micBtn = document.createElement('button');
  micBtn.type = 'button'; micBtn.className = 'spv-mic'; micBtn.innerHTML = ICON.mic;
  const live = Object.assign(document.createElement('span'), { className: 'sp-sr' }); live.setAttribute('aria-live', 'polite');
  head.classList.add('spv-head'); head.insertBefore(speakBtn, head.querySelector('.sp-lang')); head.append(live);
  form.insertBefore(micBtn, sendBtn);

  let micState = 'idle';
  function render() {
    speakBtn.setAttribute('aria-pressed', String(speakOn));
    speakBtn.setAttribute('aria-label', speakOn ? t('speak_off') : t('speak_on')); speakBtn.title = speakBtn.getAttribute('aria-label');
    micBtn.dataset.state = micState;
    const rec = micState === 'recording' || micState === 'starting';
    micBtn.setAttribute('aria-pressed', String(rec));
    micBtn.setAttribute('aria-label', rec ? t('mic_stop') : t('mic')); micBtn.title = micBtn.getAttribute('aria-label');
    micBtn.disabled = micState === 'transcribing' || form.closest('[hidden], .is-hidden') != null;
  }
  // The input's placeholder doubles as the voice status (visible on phones too, where the hint row is hidden).
  function status(key, ms = 0) {
    clearTimeout(restoreTimer);
    if (!input.dataset.spvPh) input.dataset.spvPh = input.placeholder;
    if (key) { input.placeholder = t(key); live.textContent = t(key); } else { input.placeholder = input.dataset.spvPh; delete input.dataset.spvPh; live.textContent = ''; }
    if (key && ms) restoreTimer = setTimeout(() => status(''), ms);
  }

  const mic = vox.recorder({
    lang,
    onState: (s) => {
      micState = s === 'denied' || s === 'error' ? 'idle' : s; render();
      if (s === 'idle') status('');
      else if (s === 'denied' || s === 'error') status(s, 4500);
      else status(s === 'recording' ? 'listening' : s);
    },
    onText: (text) => {
      status('');
      submittingVoice = true;
      input.value = input.value.trim() ? `${input.value.trim()} ${text}` : text;
      input.dispatchEvent(new Event('input', { bubbles: true })); // support.js enables the send button on input
      form.requestSubmit();
      submittingVoice = false;
    },
  });
  mic.bind(micBtn);

  // Any send stops AIM talking; a typed send ends "voice mode" (replies are then read only if the toggle is on).
  form.addEventListener('submit', () => { vox.stop(); vox.unlock(); voiceTurn = submittingVoice; }, true);
  // Chips and other buttons that send also count as a user gesture for audio.
  document.addEventListener('pointerdown', () => vox.unlock(), { once: true, capture: true });

  speakBtn.addEventListener('click', () => {
    speakOn = !speakOn; try { localStorage.setItem(SPEAK_KEY, speakOn ? '1' : '0'); } catch {}
    render();
    if (!speakOn) { vox.stop(); return; }
    vox.unlock();
    const s = current();
    if (!s || !s.messages.some((m) => m.speaker === 'client')) vox.speak(t('greet'), lang(), { ui: true }); // AIM says hello
  });

  // ---- read new AIM messages aloud ----
  const seen = new Set();
  const keyOf = (m) => `${m.at}|${m.text?.length}`;
  function current() { try { const id = sessionStorage.getItem(SESSION_KEY); return id ? store.get(id) : null; } catch { return null; } }
  function markAll() { current()?.messages.forEach((m) => seen.add(keyOf(m))); }
  markAll(); // history from before a reload is not read out again
  store.subscribe(() => {
    const s = current(); if (!s) return;
    const fresh = s.messages.filter((m) => !seen.has(keyOf(m)));
    fresh.forEach((m) => seen.add(keyOf(m)));
    const bot = fresh.filter((m) => m.speaker === 'bot').at(-1);
    if (bot && (speakOn || voiceTurn)) vox.speak(bot.text, s.language || lang());
    if (fresh.some((m) => m.speaker === 'operator')) vox.stop(); // a person joined: AIM goes quiet
    render();
  });

  // Language switch relabels the controls; the greeting for the new language is warmed up.
  new MutationObserver(() => { render(); if (speakOn) vox.prefetch(t('greet'), lang(), { ui: true }); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if (speakOn) vox.prefetch(t('greet'), lang(), { ui: true });
  render();

  window.CQA = Object.assign(window.CQA || {}, { supportVoice: vox });
}
