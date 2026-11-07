// MOCK evaluator for the clickable prototype ONLY.
// Keyword heuristics stand in for the real LLM pipeline (Lane C, eval/). It returns the same
// shape the LLM must return: answer + explanation + evidence per criterion (docs/CONTRACTS.md §3).
// Never ship this as the evaluator. It exists so UI/UX can be built and demoed before the model is ready.

const RX = {
  greet: /(здравствуйте|добрый (день|вечер|утро)|приветствую|сәлеметсіз|сәлем|қайырлы|hello|hi\b|good (morning|afternoon|evening))/i,
  intro: /(меня зовут|на связи|это \S+ из|мен \S+(мын|мін|пын|пін|быn)|менің атым|i'm \S+|i am \S+|my name is|this is \S+)/i,
  question: /\?/,
  needsId: /(сч[её]т|баланс|вывод|пополн|пароль|номер договора|персональн|шот|қаражат|құпиясөз|account|balance|withdraw|deposit|password|statement|my order|заявк)/i,
  idCheck: /(кодов|кодовое слово|ИИН|дата рождения|верифик|подтвердите личность|жеке басы|ЖСН|verify|verification|date of birth|security (question|code)|identity)/i,
  idOk: /(личность клиента подтверждена|identity (confirmed|verified)|жеке басы расталды)/i,
  thanks: /(спасибо|понял|поняла|нашла|нашёл|ясно|рақмет|түсіндім|жақсы|thanks|thank you|got it|that's all|perfect)/i,
  polite: /(пожалуйста|рад[аы]? помочь|извините|прошу прощения|понимаю|рақмет|кешіріңіз|өтінемін|please|happy to help|glad|sorry|apolog|i understand)/i,
  complaint: /(не работает|ужас|плохо|долго|недовол|жалоб|проблем|нашар|ұзақ|not working|terrible|annoy|complain|frustrat|slow)/i,
  bye: /(до свидания|хорошего (дня|вечера)|всего доброго|обращайтесь|чем[- ]?(то|нибудь)? ещё|сау болыңыз|күніңіз|тағы сұрақ|goodbye|bye|have a (nice|good)|anything else)/i,
  abrupt: /(клиент завершил|связь прервал|байланыс үзілді|client (left|disconnected)|connection lost)/i,
  gross: /(переведите (мне|на мою)|на мою (личную )?карту|мой личный номер|напишите мне в (whatsapp|телеграм)|личн(ую|ая) консультаци|my personal (number|account)|send (it|money) to me|дурак|идиот|тупой|stupid|idiot)/i,
  wait: /(минут|подождите|ожидайте|уточню|секунд|күте тұрыңыз|минут|one moment|please wait|let me check)/i,
};

const BUILTIN = {
  c01: { title: 'Установление контакта', type: 'binary' },
  c02: { title: 'Выявление потребности', type: 'binary' },
  c03: { title: 'Идентификация', type: 'binary' },
  c04: { title: 'Корректная и полная консультация', type: 'scale' },
  c05: { title: 'Эмпатия и клиентоориентированность', type: 'binary' },
  c06: { title: 'Управление диалогом, скорость и грамотность', type: 'scale' },
  c07: { title: 'Завершение', type: 'binary' },
  c08: { title: 'Грубые ошибки', type: 'flag' },
};

const ev = (t, i) => ({ kind: 'message', turn_index: i, quote: t[i].text.slice(0, 160) });
const range = (a, b) => ({ kind: 'range', range: [a, b] });
const naEv = (why) => ({ kind: 'na_condition', quote: why });

function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }

export function mockEvaluate(conv, checklist) {
  const t = conv.transcript;
  const idx = (pred) => t.map((m, i) => [m, i]).filter(([m]) => pred(m)).map(([, i]) => i);
  const op = idx((m) => m.speaker === 'operator');
  const cl = idx((m) => m.speaker === 'client');
  const sys = idx((m) => m.speaker === 'system');
  const firstOp = op[0];
  const lastOp = op[op.length - 1];
  const out = {};

  for (const c of checklist.criteria) {
    let r;
    // Built-in heuristics only apply while the criterion is still the original one (same title + type).
    // A renamed / retyped criterion is a *replaced* criterion → generic placeholder branch.
    const known = BUILTIN[c.id];
    const rule = known && known.title === c.title && known.type === c.type ? c.id : 'custom';
    switch (rule) {
      case 'c01': {
        if (firstOp == null) { r = { answer: 'no', explanation: 'Оператор не подключился к диалогу, приветствия нет.', evidence: [range(0, t.length - 1)] }; break; }
        const m = t[firstOp].text;
        const g = RX.greet.test(m), n = RX.intro.test(m);
        r = g && n
          ? { answer: 'yes', explanation: 'В первом ответе оператор поздоровался на языке клиента и представился.', evidence: [ev(t, firstOp)] }
          : { answer: 'no', explanation: `В первом ответе ${!g ? 'нет приветствия' : ''}${!g && !n ? ' и ' : ''}${!n ? 'оператор не представился' : ''}.`, evidence: [ev(t, firstOp)] };
        break;
      }
      case 'c02': {
        const asked = op.find((i) => RX.question.test(t[i].text));
        r = asked != null
          ? { answer: 'yes', explanation: 'Оператор уточнил недостающие детали перед ответом.', evidence: [ev(t, asked)] }
          : { answer: 'na', explanation: 'Данных в запросе клиента хватало для ответа с самого начала.', evidence: [naEv('Запрос сформулирован полностью'), ...(cl[0] != null ? [ev(t, cl[0])] : [])] };
        break;
      }
      case 'c03': {
        const need = cl.find((i) => RX.needsId.test(t[i].text));
        if (need == null) { r = { answer: 'na', explanation: 'Запрос общий и не требовал проверки личности.', evidence: [naEv('Нет запроса персональных данных или защищённого действия')] }; break; }
        const ok = [...sys, ...op].find((i) => RX.idOk.test(t[i].text) || RX.idCheck.test(t[i].text));
        r = ok != null
          ? { answer: 'yes', explanation: 'Личность клиента проверена до раскрытия данных.', evidence: [ev(t, ok)] }
          : { answer: 'no', explanation: 'Клиент запросил данные по счёту, но проверка личности в чате не подтверждена.', evidence: [ev(t, need), range(need, lastOp ?? t.length - 1)] };
        break;
      }
      case 'c04': {
        if (cl.length === 0 || firstOp == null) { r = { answer: 'na', explanation: 'Чат закончился до того, как клиент сформулировал запрос.', evidence: [naEv('Нет запроса клиента после подключения оператора')] }; break; }
        const after = cl.filter((i) => i > firstOp);
        const satisfied = after.find((i) => RX.thanks.test(t[i].text));
        const followUps = after.filter((i) => RX.question.test(t[i].text)).length;
        const step = satisfied != null ? (followUps > 1 ? 15 : 20) : followUps > 0 ? 10 : 15;
        r = { answer: step, explanation: { 20: 'Вопрос клиента закрыт, клиент подтвердил понимание.', 15: 'Основной вопрос решён, но клиенту пришлось уточнять детали.', 10: 'Часть запроса закрыта, клиент остался с открытым вопросом.' }[step],
          evidence: [ev(t, firstOp), ...(satisfied != null ? [ev(t, satisfied)] : [])] };
        break;
      }
      case 'c05': {
        const complaint = cl.find((i) => RX.complaint.test(t[i].text));
        const polite = op.find((i) => RX.polite.test(t[i].text));
        r = polite != null || (firstOp != null && complaint == null)
          ? { answer: 'yes', explanation: complaint != null ? 'Оператор вежлив и отреагировал на недовольство клиента.' : 'Оператор вежлив на протяжении диалога.', evidence: [ev(t, polite ?? firstOp)] }
          : { answer: 'no', explanation: 'Клиент выразил недовольство, оператор не отреагировал на проблему.', evidence: complaint != null ? [ev(t, complaint)] : [range(0, t.length - 1)] };
        break;
      }
      case 'c06': {
        let gaps = 0, at = null;
        for (let k = 1; k < t.length; k++) if (t[k].speaker === 'client' && t[k - 1].speaker === 'client') { gaps++; at ??= k; }
        const warned = op.find((i) => RX.wait.test(t[i].text));
        const step = gaps === 0 ? 10 : gaps === 1 ? 7 : 4;
        r = { answer: step, explanation: step === 10 ? 'Ответы ясные и последовательные.' : step === 7 ? 'Один заметный сбой: клиенту пришлось писать повторно.' : 'Клиенту несколько раз приходилось переспрашивать.',
          evidence: at != null ? [ev(t, at)] : warned != null ? [ev(t, warned)] : firstOp != null ? [ev(t, firstOp)] : [] };
        break;
      }
      case 'c07': {
        const abrupt = sys.find((i) => RX.abrupt.test(t[i].text) && (lastOp == null || i > lastOp - 1));
        const bye = op.slice().reverse().find((i) => RX.bye.test(t[i].text));
        if (bye != null) r = { answer: 'yes', explanation: 'Оператор попрощался или предложил дальнейшую помощь.', evidence: [ev(t, bye)] };
        else if (abrupt != null) r = { answer: 'na', explanation: 'Чат оборвался со стороны клиента до возможности завершения.', evidence: [naEv('Системное сообщение о разрыве'), ev(t, abrupt)] };
        else r = { answer: 'no', explanation: 'Оператор закрыл диалог без итога и прощания.', evidence: lastOp != null ? [ev(t, lastOp)] : [range(0, t.length - 1)] };
        break;
      }
      case 'c08': {
        const g = op.find((i) => RX.gross.test(t[i].text));
        r = g != null
          ? { answer: 'yes', explanation: 'Обнаружено грубое нарушение в реплике оператора.', evidence: [ev(t, g)] }
          : { answer: 'no', explanation: 'Оскорблений, предложений услуг в обход компании и раскрытия конфиденциальных данных не обнаружено.', evidence: [] };
        break;
      }
      default: {
        // Custom criteria added in the editor: deterministic placeholder until the LLM is connected.
        const h = hash(conv.conversation_id + c.id);
        let answer = c.type === 'scale' ? c.scale[h % c.scale.length].value : h % 4 === 0 ? 'no' : 'yes';
        if (c.na_allowed && h % 7 === 0) answer = 'na';
        if (c.type === 'flag') answer = 'no';
        r = { answer, explanation: `MOCK: ответ сгенерирован заглушкой. Подключите LLM-оценщик (Lane C), чтобы оценить «${c.title}».`,
          evidence: firstOp != null && answer !== 'na' ? [ev(t, firstOp)] : [naEv(c.na_condition || 'условие N/A')] };
      }
    }
    if (r.answer === 'na' && !c.na_allowed) r = { ...r, answer: c.type === 'scale' ? Math.min(...c.scale.map((s) => s.value)) : 'no' };
    // A built-in scale rule may produce a step that the edited scale no longer has → snap to nearest step.
    if (c.type === 'scale' && typeof r.answer === 'number' && !c.scale.some((s) => s.value === r.answer)) {
      r = { ...r, answer: c.scale.reduce((best, s) => (Math.abs(s.value - r.answer) < Math.abs(best - r.answer) ? s.value : best), c.scale[0].value) };
    }
    out[c.id] = r;
  }
  return out;
}
