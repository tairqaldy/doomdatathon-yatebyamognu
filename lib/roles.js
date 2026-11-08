// Who is who in a transcript: operator identities, operator → colleague remarks, dialogs without a client.
// Pure pre-processing before lib/evaluator.js (which stays untouched): the checklist grades the operator's work with
// the client (AGENTS §6), so a remark one operator addresses to another is context, like a system event. For the
// evaluation such a turn becomes speaker "system" with a clear prefix; the caller keeps the original text for display.
// A dialog with one operator identity and no explicit internal markers comes back with the very same transcript array
// (the eval cache key includes it), so DEV / FBroker / Swap evaluations and their cached answers do not change.
// No DOM, no network: imported by api/evaluate.js and by the admin card (/lib/roles.js).

const OP_WORD = '(?:оператор|operator|agent|агент|менеджер|manager|специалист|specialist|сотрудник|маман)';
const OP_RE = new RegExp(`^${OP_WORD}$`, 'i');
const ARROW = '(?:→|->|=>|⇒|>)';
// speaker "operator→operator" / "оператор -> оператор": an explicit internal line
const SPK_INTERNAL = new RegExp(`^${OP_WORD}[^→>]*${ARROW}\\s*${OP_WORD}`, 'i');
// speaker "operator:Арман", "operator/2", "operator (Арман)", "operator#2"
const SPK_NAMED = new RegExp(`^${OP_WORD}\\s*[:/#(]\\s*([^)]{1,40}?)\\s*\\)?$`, 'i');
// text label «[Оператор Арман → Оператор Айгерим] …» / «Оператор → Оператор: …»
const TXT_ARROW = new RegExp(`^\\s*[\\[(]?\\s*${OP_WORD}[^\\]):→>]{0,40}${ARROW}\\s*${OP_WORD}[^\\]):]{0,40}[\\]):]\\s*`, 'i');
// text label «[Оператор Арман] …» / «Оператор Арман: …» / «Старший оператор: …»
const TXT_OP_LABEL = new RegExp(`^\\s*(?:\\[([^\\]]{1,40})\\]|((?:[\\p{L}-]+\\s+){0,2}${OP_WORD}(?:\\s+[\\p{L}\\d.-]+){0,2})\\s*[:：])\\s*`, 'iu');
// a bare leading «Имя:» (1–2 capitalised words); trusted only when it starts at least two operator turns
const TXT_NAME = /^\s*(\p{Lu}[\p{Ll}-]+(?:\s\p{Lu}[\p{Ll}.-]*)?)\s*[:：]\s+/u;
// explicit internal tags at the start of a line
const TXT_INTERNAL = /^\s*[[(]?\s*(?:внутр(?:енн(?:яя|ее|ий))?\.?(?:\s+(?:реплика|заметка|комментарий|чат))?|internal(?:\s+note)?|ішкі(?:\s+жазба)?)\s*[\]):]/i;
// the text talks to a colleague, not to the client (used only next to another operator, with no client in between)
// JS \b is ASCII-only, so Cyrillic words get explicit letter lookarounds
const w = (alts) => `(?<!\\p{L})(?:${alts})(?!\\p{L})`;
const COLLEAGUE = [
  new RegExp(`${w('коллега|коллеги|әріптес\\p{L}*|colleague')}\\s*[,!:]`, 'iu'),
  new RegExp(`^\\s*${w('коллега|коллеги|әріптес\\p{L}*|colleague')}`, 'iu'),
  new RegExp(w('передаю\\s+(?:тебе|его|её|ее|клиента|чат)|передам\\s+тебе|можешь\\s+(?:посмотреть|глянуть|проверить|взять|подключиться|помочь)|посмотри(?:шь)?|глянь|возьм(?:и|ёшь|ешь)|подхвати|принимай|прими\\s+(?:клиента|чат|диалог)|у\\s+тебя|тебе|ты'), 'iu'),
  /\b(can you (take|check|look)|over to you|could you take)\b/i,
];
// a short reply to a colleague's internal remark: no «вы» to the client, no greeting
const REPLY_BAD = new RegExp(`${w('вы|вас|вам|ваш\\p{L}*|сіз\\p{L}*|you|your')}|здравствуйте|добрый|сәлеметсіз|hello|good (?:morning|afternoon|evening)`, 'iu');

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const nameOfLabel = (label) => {
  const words = label.trim().replace(/[,.]+$/, '').split(/\s+/);
  const i = words.findIndex((w) => OP_RE.test(w));
  if (i < 0) return label.trim();
  const rest = words.slice(i + 1).join(' ');
  // «Оператор Арман» → Арман · «Оператор 2» / «Старший оператор» → the whole label
  return rest && !/^\d+$/.test(rest) && i === 0 ? rest : words.join(' ');
};

/** One turn → { speaker, name, internal } without changing it. */
function readTurn(m) {
  let speaker = String(m?.speaker ?? '').trim();
  let name = str(m?.name) || str(m?.agent_name) || str(m?.operator_name) || str(m?.agent) || str(m?.author_name) || '';
  let internal = m?.internal === true || /^(internal|note|private)$/i.test(str(m?.visibility) || str(m?.type));
  if (SPK_INTERNAL.test(speaker)) { internal = true; speaker = 'operator'; }
  const named = speaker.match(SPK_NAMED);
  if (named) { speaker = 'operator'; name = name || nameOfLabel(`Оператор ${named[1]}`); }
  speaker = speaker.toLowerCase();
  if (OP_RE.test(speaker)) speaker = 'operator';
  const text = String(m?.text ?? '');
  let label = '';
  if (speaker === 'operator') {
    if (TXT_ARROW.test(text) || TXT_INTERNAL.test(text)) internal = true;
    const lm = text.match(TXT_OP_LABEL);
    if (!name && lm && (lm[2] || (lm[1] && new RegExp(OP_WORD, 'i').test(lm[1])))) name = nameOfLabel(lm[1] || lm[2]);
    if (!name) label = text.match(TXT_NAME)?.[1] || '';
  }
  return { speaker, name, internal, label, text };
}

const EMPTY = { operators: [], internal: [], no_client: false };

/**
 * annotateRoles(conv) → { ...conv, transcript, roles: { operators, internal, no_client, names } }
 *  - operators: distinct operator identities in order of appearance (empty when there is only one, unnamed)
 *  - internal:  indices of operator turns addressed to a colleague; in the returned transcript they are speaker "system"
 *               with text «Внутренняя реплика оператора <имя> коллеге: …» (indices never shift, evidence links stay valid)
 *  - no_client: true when the dialog has no client turn at all (the checklist does not apply)
 *  - names:     per-turn operator name or null, for display
 * The returned transcript is the input array itself unless a turn had to change.
 */
export function annotateRoles(conv) {
  const t = conv?.transcript;
  if (!Array.isArray(t) || !t.length) return { ...conv, roles: { ...EMPTY, names: [] } };
  const turns = t.map(readTurn);
  // a bare «Имя:» counts as a name only when it starts two or more operator turns («Важно:» once is just text)
  const labelCount = new Map();
  for (const x of turns) if (x.label) labelCount.set(x.label, (labelCount.get(x.label) || 0) + 1);
  for (const x of turns) if (x.label && labelCount.get(x.label) >= 2) x.name = x.label;

  const ids = [];
  for (const x of turns) if (x.speaker === 'operator' && !ids.includes(x.name)) ids.push(x.name);
  const multi = ids.length > 1;
  const operators = multi ? ids.map((n) => n || 'Оператор') : ids[0] ? [ids[0]] : [];

  if (multi) {
    // nearest operator/client turn before and after (bot and system lines are skipped)
    const near = (i, d) => { for (let j = i + d; j >= 0 && j < turns.length; j += d) if (turns[j].speaker === 'operator' || turns[j].speaker === 'client') return j; return -1; };
    const otherOp = (i, j) => j >= 0 && turns[j].speaker === 'operator' && turns[j].name !== turns[i].name;
    for (let i = 0; i < turns.length; i++) {
      const x = turns[i];
      if (x.speaker !== 'operator' || x.internal) continue;
      const p = near(i, -1), n = near(i, 1);
      if (!otherOp(i, p) && !otherOp(i, n)) continue;
      const others = turns.filter((y) => y.speaker === 'operator' && y.name && y.name !== x.name).map((y) => y.name.split(/\s+/)[0]);
      const byName = others.some((nm) => new RegExp(`^\\s*${nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[,!]`, 'iu').test(x.text));
      const replyToInternal = otherOp(i, p) && turns[p].internal && x.text.length <= 160 && !REPLY_BAD.test(x.text);
      if (byName || COLLEAGUE.some((re) => re.test(x.text)) || replyToInternal) x.internal = true;
    }
  }

  const internal = turns.map((x, i) => (x.speaker === 'operator' && x.internal ? i : -1)).filter((i) => i >= 0);
  const no_client = !turns.some((x) => x.speaker === 'client');
  const names = turns.map((x) => (x.speaker === 'operator' && x.name ? x.name : null));
  const roles = { operators, internal, no_client, names };

  const changed = internal.length > 0 || turns.some((x, i) => x.speaker !== t[i]?.speaker);
  if (!changed) return { ...conv, roles };
  const transcript = t.map((m, i) => {
    const x = turns[i];
    if (x.speaker === 'operator' && x.internal) {
      const who = x.name ? ` ${x.name}` : '';
      return { ...m, speaker: 'system', text: `Внутренняя реплика оператора${who} коллеге: ${x.text.replace(TXT_ARROW, '')}` };
    }
    return x.speaker !== m?.speaker ? { ...m, speaker: x.speaker, ...(x.name ? { name: x.name } : {}) } : m;
  });
  return { ...conv, transcript, roles };
}

export const NO_CLIENT_MESSAGE = 'В разговоре нет клиента: чек-лист оценивает работу оператора с клиентом, оценка не применяется';
