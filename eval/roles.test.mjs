// node --test eval/roles.test.mjs: operator ↔ operator handling in lib/roles.js.
// The first test is the safety net: every bundled dialog must come back with the very same transcript array,
// so the eval cache keys (and every cached / submitted answer) stay as they are.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { annotateRoles } from '../lib/roles.js';

const records = (f) => { const j = JSON.parse(readFileSync(new URL(`../data/datasets/${f}.json`, import.meta.url), 'utf8')); return j.data?.records || j.records || j; };
const T = (speaker, text, extra = {}) => ({ timestamp: '', speaker, text, ...extra });

test('bundled dialogs (DEV, FBroker, Swap) are returned byte-identical', () => {
  let n = 0;
  for (const f of ['DEV', 'FBroker', 'Swap']) {
    for (const c of records(f)) {
      const before = JSON.stringify(c.transcript);
      const r = annotateRoles(c);
      assert.equal(r.transcript, c.transcript, `${f}/${c.conversation_id}: transcript array replaced`);
      assert.equal(JSON.stringify(r.transcript), before, `${f}/${c.conversation_id}: transcript changed`);
      assert.deepEqual(r.roles.internal, [], `${f}/${c.conversation_id}: internal turns found`);
      assert.equal(r.roles.no_client, false, `${f}/${c.conversation_id}: no client`);
      assert.ok(r.roles.operators.length <= 1, `${f}/${c.conversation_id}: several operators`);
      n++;
    }
  }
  assert.ok(n >= 65);
});

test('a transfer between two named operators keeps both identities and stays gradable', () => {
  const conv = { conversation_id: 't1', transcript: [
    T('client', 'Здравствуйте, не могу вывести деньги.'),
    T('operator', 'Добрый день! Меня зовут Арман. Передаю вас коллеге из отдела выводов, она поможет.', { name: 'Арман' }),
    T('system', 'Чат передан оператору Айгерим.'),
    T('operator', 'Здравствуйте! Меня зовут Айгерим. Вижу вашу заявку, вывод ограничен до проверки документов.', { name: 'Айгерим' }),
    T('client', 'Спасибо.'),
  ] };
  const r = annotateRoles(conv);
  assert.deepEqual(r.roles.operators, ['Арман', 'Айгерим']);
  assert.deepEqual(r.roles.internal, []);
  assert.equal(r.roles.no_client, false);
  assert.equal(r.transcript, conv.transcript, 'nothing to rewrite: both operators talk to the client');
});

test('speaker "operator:Имя" and «Оператор 2:» labels keep operators distinct', () => {
  const r = annotateRoles({ conversation_id: 't2', transcript: [
    T('client', 'Hi'), T('operator:Alex', 'Hello, I am Alex.'), T('operator:Dana', 'Hello, Dana here, I will continue.'), T('client', 'Thanks'),
  ] });
  assert.deepEqual(r.roles.operators, ['Alex', 'Dana']);
  assert.deepEqual(r.transcript.map((m) => m.speaker), ['client', 'operator', 'operator', 'client']);
  const r2 = annotateRoles({ conversation_id: 't3', transcript: [T('client', 'Добрый день'), T('operator', 'Оператор 1: Здравствуйте!'), T('operator', 'Оператор 2: Здравствуйте, продолжу я.'), T('client', 'Ок')] });
  assert.deepEqual(r2.roles.operators, ['Оператор 1', 'Оператор 2']);
});

test('an internal operator ↔ operator exchange inside a client chat becomes context', () => {
  const conv = { conversation_id: 't4', transcript: [
    T('client', 'Здравствуйте, почему заблокирован вывод?'),
    T('operator', 'Добрый день! Меня зовут Арман, сейчас уточню.', { name: 'Арман' }),
    T('operator', 'Айгерим, можешь посмотреть заявку клиента? Там блок по документам.', { name: 'Арман' }),
    T('operator', 'Да, вижу, беру.', { name: 'Айгерим' }),
    T('operator', 'Здравствуйте! Меня зовут Айгерим. Вывод ограничен до проверки удостоверения, загрузите его в «Профиль» → «Документы».', { name: 'Айгерим' }),
    T('client', 'Понял, спасибо.'),
  ] };
  const r = annotateRoles(conv);
  assert.deepEqual(r.roles.internal, [2, 3]);
  assert.equal(r.transcript.length, conv.transcript.length, 'indices never shift');
  assert.equal(r.transcript[2].speaker, 'system');
  assert.match(r.transcript[2].text, /^Внутренняя реплика оператора Арман коллеге: Айгерим, можешь посмотреть/);
  assert.equal(r.transcript[3].speaker, 'system');
  assert.equal(r.transcript[4].speaker, 'operator', 'the colleague then talks to the client: graded');
  assert.equal(conv.transcript[2].speaker, 'operator', 'the original is kept for display');
});

test('an explicit «Оператор → Оператор» label is internal even with one named operator', () => {
  const r = annotateRoles({ conversation_id: 't5', transcript: [
    T('client', 'Добрый день'), T('operator', 'Здравствуйте, чем помочь?'), T('operator', 'Оператор → Оператор: проверьте, пожалуйста, KYC клиента'), T('client', 'Жду'),
  ] });
  assert.deepEqual(r.roles.internal, [2]);
  assert.equal(r.transcript[2].text, 'Внутренняя реплика оператора коллеге: проверьте, пожалуйста, KYC клиента');
});

test('an operator-only conversation is flagged no_client', () => {
  const r = annotateRoles({ conversation_id: 't6', transcript: [
    T('operator', 'Айгерим, ты сегодня на выводах?', { name: 'Арман' }),
    T('operator', 'Да, до шести. Передавай клиентов мне.', { name: 'Айгерим' }),
  ] });
  assert.equal(r.roles.no_client, true);
  assert.deepEqual(r.roles.operators, ['Арман', 'Айгерим']);
});

test('one-off «Важно:» is not taken as an operator name; a single unnamed operator returns the same array', () => {
  const conv = { conversation_id: 't7', transcript: [T('client', 'Вопрос'), T('operator', 'Важно: комиссия 0,1%.'), T('operator', 'Тебе ещё что-нибудь подсказать?'), T('client', 'Нет')] };
  const r = annotateRoles(conv);
  assert.equal(r.transcript, conv.transcript);
  assert.deepEqual(r.roles.operators, []);
  assert.deepEqual(r.roles.internal, []);
});
