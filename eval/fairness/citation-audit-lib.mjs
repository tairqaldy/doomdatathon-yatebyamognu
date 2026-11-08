// Read-only provenance inspection, not a scoring or evidence-repair heuristic.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { hashKey, logicFingerprint, LOGIC } from '../../lib/cache.js';
import { fingerprint } from './validation.mjs';

// This investigation describes v5.1; moving main/HEAD must not change its inputs.
export const CITATION_SOURCE_REVISION = '965f782';
const historicalSource = path => execFileSync('git', ['show', `${CITATION_SOURCE_REVISION}:${path}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const stub = `data:text/javascript;base64,${Buffer.from("export const MODELS = {}; export function chatJSON(){throw Error('Offline historical audit');} export function cached(){throw Error('Offline historical audit');}").toString('base64')}`;
const replaySource = historicalSource('lib/evaluator.js').replace("'./llm.js'", `'${stub}'`).replace("'./cache.js'", `'${stub}'`);
const { combineSamples } = await import(`data:text/javascript;base64,${Buffer.from(replaySource).toString('base64')}`);

export const textHash = value => createHash('sha256').update(value).digest('hex');
export const canonicalLogicFingerprint = source => createHash('sha1').update(String(source).replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);

export function loadCitationInputs() {
  if (JSON.stringify(LOGIC.eval) !== JSON.stringify(['./evaluator.js'])) throw new Error('Review namespace provenance: logic inputs changed');
  const read = file => JSON.parse(historicalSource(file));
  const source = historicalSource('lib/evaluator.js');
  const canonical = canonicalLogicFingerprint(source.toString('utf8'));
  const current = logicFingerprint('eval');
  const dataset = read('data/datasets/DEV.json').data.records;
  const checklist = read('data/checklists/freedom-chat-v1.json');
  const stored = read('data/evaluations/DEV.json');
  const samplePath = (conversation, sample, fp = canonical) => `eval/cache/eval/${hashKey('eval', fp,
    stored.prompt_version, stored.model, conversation.conversation_id, conversation.transcript, checklist.criteria, `sample-${sample}`)}.json`;
  let canonicalHits = 0, currentHits = 0;
  for (const c of dataset) for (let i = 0; i < 3; i++) {
    canonicalHits += Number(existsSync(samplePath(c, i)));
    currentHits += Number(existsSync(samplePath(c, i, current)));
  }
  return { dataset, checklist, stored, samplePath,
    cache_provenance: { source_revision: CITATION_SOURCE_REVISION, canonical_git_lf_fingerprint: canonical, current_worktree_fingerprint: current,
      expected_v51_samples: dataset.length * 3, canonical_file_hits: canonicalHits, current_worktree_file_hits: currentHits } };
}

export function inspectCitationCase(inputs, id) {
  const conversation = inputs.dataset.find(c => c.conversation_id === id);
  const files = Array.from({ length: 3 }, (_, i) => inputs.samplePath(conversation, i));
  const before = files.map(file => textHash(readFileSync(file)));
  const samples = files.map(file => JSON.parse(readFileSync(file, 'utf8')));
  if (samples.some(s => s.prompt_version !== inputs.stored.prompt_version || !s.complete)) throw new Error(`Incomplete or wrong-version samples: ${id}`);
  const tagged = samples.map((sample, i) => ({ ...structuredClone(sample), answers: Object.fromEntries(
    Object.entries(sample.answers).map(([criterion, row]) => [criterion, { ...structuredClone(row), __citation_sample: i + 1 }])) }));
  const replayed = combineSamples(tagged, conversation, inputs.checklist);
  const plainAnswers = Object.fromEntries(Object.entries(replayed.answers).map(([criterion, row]) => {
    const { __citation_sample, ...answer } = row; return [criterion, answer];
  }));
  if (fingerprint(plainAnswers) !== fingerprint(inputs.stored.results[id].answers)) throw new Error(`Sample replay differs from stored answers: ${id}`);
  const diagnostics = [];
  for (const [i, sample] of samples.entries()) for (const problem of sample.problems) {
    const match = problem.match(/^(c\d+): quote not found in turn (\d+)$/);
    if (!match) throw new Error(`Unclassified diagnostic: ${problem}`);
    const [, criterion, turn] = match, index = Number(turn), message = conversation.transcript[index];
    if (!message) throw new Error('Referenced original message is absent');
    const normalizedEvidence = sample.answers[criterion].evidence.filter(e => e.kind === 'message' && e.turn_index === index);
    const selected = replayed.answers[criterion].__citation_sample;
    const selectedRow = replayed.answers[criterion];
    const sourceRoles = new Set(selectedRow.evidence.flatMap(e => e.kind === 'message' ? [conversation.transcript[e.turn_index]?.speaker]
      : e.kind === 'range' ? conversation.transcript.slice(e.range[0], e.range[1] + 1).map(m => m.speaker) : []).filter(Boolean));
    diagnostics.push({ sample: i + 1, criterion_id: criterion, turn_index: index, source_speaker: message.speaker,
      original_message_sha256: textHash(message.text), raw_diagnostic: problem,
      original_model_quote_recoverable: false,
      stored_quote_substrings_match_source: normalizedEvidence.length > 0 && normalizedEvidence.every(e => message.text.includes(e.quote)),
      final_selected_sample: selected ?? null, belongs_to_selected_sample: selected === i + 1,
      final_row_source_roles: [...sourceRoles].sort(), sample_attempts: sample.attempts });
  }
  const accumulated = samples.flatMap((s, i) => s.problems.map(p => `s${i + 1} ${p}`));
  if (fingerprint(accumulated) !== fingerprint(inputs.stored.results[id].problems)) throw new Error('Published diagnostics differ from cached sample diagnostics');
  if (files.some((file, i) => textHash(readFileSync(file)) !== before[i])) throw new Error('Cache unexpectedly changed');
  return { conversation_id: id, cache_files: files, cache_file_sha256: before,
    sample_attempts: samples.map(s => s.attempts),
    replay_matches_stored_answers: true, cache_unchanged: true,
    diagnostics, selected_sample_diagnostics: diagnostics.filter(d => d.belongs_to_selected_sample).length,
    unselected_sample_diagnostics: diagnostics.filter(d => !d.belongs_to_selected_sample).length,
    raw_model_quotes_available: false, diagnostics_cleared: false, scores_changed: false };
}
