// Production imports are read-only. Every evaluate() call uses force=true and a local fetch double:
// no real network, cache writes, env-file loading, or model inference occurs in this suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalize, evaluate, buildMessages, schemaFor } from '../../lib/evaluator.js';
import { score } from '../../prototype/scoring.js';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const cl = read('data/checklists/freedom-chat-v1.json');
const ds = new Map(read('data/datasets/DEV.json').data.records.map(c => [c.conversation_id, c]));
const cases = read('eval/readiness/c08-cases.json').cases;
const synthetic = {
  conversation_id: 'offline-contract-fixture', channel: 'agent chat', language: 'EN', audio_url: null,
  transcript: [
    { timestamp: '00:00', speaker: 'client', text: 'Where is the help page?' },
    { timestamp: '00:01', speaker: 'operator', text: 'Hello, I am Support. Open Help in the menu.' },
    { timestamp: '00:02', speaker: 'client', text: 'Thank you.' },
  ],
};
const evidence = (conv, i) => ({ kind: 'message', turn_index: i, range_start: null, range_end: null, quote: conv.transcript[i].text });
function validRaw(conv = synthetic, turn = 1) {
  return { summary: { reason: 'Fixture', operator_actions: 'Fixture', outcome: 'Fixture' },
    criteria: cl.criteria.map(c => ({ criterion_id: c.id,
      answer: c.type === 'flag' ? 'no' : c.type === 'scale' ? String(Math.max(...c.scale.map(s => s.value))) : 'yes',
      explanation: 'Contract fixture, not a model judgment.', deduction_reason: '', evidence: [evidence(conv, turn)] })) };
}
const row = (raw, id = 'c08') => raw.criteria.find(c => c.criterion_id === id);
const rejected = (norm, id = 'c08') => !norm.answers[id] || norm.problems.some(p => p.startsWith(`${id}:`));

// The original fetch is never called, including on an unexpected request.
async function withResponses(responses, fn) {
  const originalFetch = globalThis.fetch, originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'offline-readiness-fixture';
  const requests = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions', 'Unexpected endpoint blocked');
    assert.equal(init.method, 'POST');
    const i = requests.length;
    requests.push(JSON.parse(init.body));
    assert(i < responses.length, 'Unexpected extra request blocked');
    const value = responses[i];
    return new Response(JSON.stringify({ model: 'offline-test-double',
      choices: [{ message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, cost: (i + 1) / 100 } }), { status: 200 });
  };
  try { return await fn(requests); }
  finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  }
}
const invoke = () => evaluate(synthetic, cl, { model: 'offline-test-double', force: true });

for (const c of cases) {
  test(`injected yes survives normalization/scoring: ${c.conversation_id} (NOT LLM accuracy)`, () => {
    const conv = ds.get(c.conversation_id), raw = validRaw(conv, c.violation_turns[0]);
    row(raw).answer = 'yes';
    const norm = normalize(raw, conv, cl);
    assert.deepEqual(norm.problems, []);
    assert.equal(norm.answers.c08.answer, 'yes');
    assert.equal(norm.answers.c08.evidence[0].turn_index, c.violation_turns[0]);
    const answers = Object.fromEntries(Object.entries(norm.answers).map(([k, r]) => [k, r.answer]));
    const s = score(cl, answers);
    assert.equal(s.gross_error, true);
    assert.equal(s.total, score(cl, { ...answers, c08: 'no' }).total);
    assert.equal(s.criteria.find(r => r.criterion_id === 'c08').points, null);
  });
}

test('prompt includes the official flag rule and indexed operator/client context', () => {
  const messages = buildMessages(synthetic, cl);
  assert.equal(messages[0].role, 'system');
  assert(messages[1].content.includes(cl.criteria.find(c => c.id === 'c08').description));
  assert(messages[1].content.includes('[1] 00:01 ОПЕРАТОР:'));
  assert(schemaFor(cl).properties.criteria.items.properties.criterion_id.enum.includes('c08'));
});
test('invalid c08 answer is diagnosed and not scored', () => {
  const raw = validRaw(); row(raw).answer = 'maybe';
  const norm = normalize(raw, synthetic, cl);
  assert(rejected(norm)); assert.equal(norm.answers.c08, undefined);
});
test('out-of-range evidence is removed and diagnosed', () => {
  const raw = validRaw(); row(raw).evidence[0].turn_index = 999;
  const norm = normalize(raw, synthetic, cl);
  assert(rejected(norm)); assert.deepEqual(norm.answers.c08.evidence, []);
});
test('missing criterion triggers a second synthetic response', async () => {
  const first = validRaw(); first.criteria = first.criteria.filter(c => c.criterion_id !== 'c08');
  await withResponses([first, validRaw()], async calls => {
    const r = await invoke(); assert.equal(calls.length, 2); assert.equal(r.value.attempts, 2);
    assert.equal(r.value.answers.c08.answer, 'no');
  });
});

// These assert required behavior, not the current defects. They intentionally fail until the owner fixes production.
test('positive c08 without evidence must be diagnosed', () => {
  const raw = validRaw(); row(raw).answer = 'yes'; row(raw).evidence = [];
  assert(rejected(normalize(raw, synthetic, cl)), 'Missing evidence silently accepted');
});
test('a mismatched model quote must be diagnosed, not silently replaced', () => {
  const raw = validRaw(); row(raw).evidence[0].quote = 'This quote is absent from the conversation.';
  assert(rejected(normalize(raw, synthetic, cl)), 'Fabricated quote replaced without a problem record');
});
test('positive c08 cannot be supported only by na_condition', () => {
  const raw = validRaw(); row(raw).answer = 'yes';
  row(raw).evidence = [{ kind: 'na_condition', turn_index: null, range_start: null, range_end: null, quote: 'Not applicable' }];
  assert(rejected(normalize(raw, synthetic, cl)), 'N/A evidence accepted for a flag with N/A forbidden');
});
test('conflicting duplicate c08 answers must be diagnosed', () => {
  const raw = validRaw(); raw.criteria.push({ ...structuredClone(row(raw)), answer: 'yes' });
  assert(rejected(normalize(raw, synthetic, cl)), 'First duplicate silently wins');
});
test('invalid evidence triggers repair even when every answer is present', async () => {
  const first = validRaw(); row(first).answer = 'yes'; row(first).evidence[0].turn_index = 999;
  await withResponses([first, validRaw()], async calls => {
    await invoke(); assert.equal(calls.length, 2, 'Answer-count-only gate bypassed evidence failure');
  });
});
test('invalid JSON is retried within the bounded retry policy', async () => {
  await withResponses(['not JSON', validRaw()], async calls => {
    await invoke(); assert.equal(calls.length, 2);
  });
});
test('exhausted missing-criterion retries must reject partial success', async () => {
  await withResponses([{ criteria: [] }, { criteria: [] }], async calls => {
    await assert.rejects(invoke, 'Incomplete results returned as success');
    assert.equal(calls.length, 2);
  });
});
test('reported usage cost must include both synthetic attempts', async () => {
  const first = validRaw(); first.criteria = first.criteria.filter(c => c.criterion_id !== 'c08');
  await withResponses([first, validRaw()], async () => {
    const r = await invoke();
    assert(Math.abs(r.value.usage.cost - 0.03) < 1e-9, `Only last attempt cost retained: ${r.value.usage.cost}`);
  });
});
