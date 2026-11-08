import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalize } from '../../lib/evaluator.js';
import { loadCitationInputs, inspectCitationCase, canonicalLogicFingerprint } from './citation-audit-lib.mjs';

const inputs = loadCitationInputs();

test('all 195 committed samples resolve with the canonical source fingerprint', () => {
  assert.equal(inputs.cache_provenance.canonical_file_hits, 195);
  assert.equal(inputs.cache_provenance.expected_v51_samples, 195);
});

test('p4-ru-005: four diagnostics belong to an unselected sample; voting reproduces stored answers', () => {
  const result = inspectCitationCase(inputs, 'p4-ru-005');
  assert.equal(result.diagnostics.length, 4);
  assert.equal(result.selected_sample_diagnostics, 0);
  assert.equal(result.unselected_sample_diagnostics, 4);
  assert.equal(result.replay_matches_stored_answers, true);
  assert.equal(result.cache_unchanged, true);
  assert.ok(result.diagnostics.every(d => d.sample === 2 && d.final_selected_sample === 1));
});

test('p4-ru-004: five selected and eight unselected diagnostics remain visible', () => {
  const result = inspectCitationCase(inputs, 'p4-ru-004');
  assert.equal(result.diagnostics.length, 13);
  assert.equal(result.selected_sample_diagnostics, 5);
  assert.equal(result.unselected_sample_diagnostics, 8);
  assert.equal(result.diagnostics_cleared, false);
  assert.equal(result.scores_changed, false);
  assert.ok(result.diagnostics.every(d => d.stored_quote_substrings_match_source));
});

test('normalizer flags an invented quote but does not retain the original offending string', () => {
  const invented = 'Invented words that never appear in the conversation';
  const conversation = { transcript: [{ speaker: 'operator', timestamp: '00:00', text: 'Hello, my name is John.' }] };
  const checklist = { criteria: [{ id: 'c01', type: 'binary', na_allowed: false }] };
  const result = normalize({ criteria: [{ criterion_id: 'c01', answer: 'yes', explanation: 'fixture', deduction_reason: '',
    evidence: [{ kind: 'message', turn_index: 0, quote: invented }] }] }, conversation, checklist);
  assert.ok(result.problems.some(p => p.includes('quote not found')));
  assert.equal(result.answers.c01.evidence[0].quote, conversation.transcript[0].text);
  assert.equal(JSON.stringify(result).includes(invented), false);
});

test('canonical fingerprint is identical for LF and CRLF source', () => {
  const source = 'export const value = 1;\n// fixture\n';
  assert.equal(canonicalLogicFingerprint(source), canonicalLogicFingerprint(source.replaceAll('\n', '\r\n')));
});

test('proposed cache patch executes with stable keys for LF and CRLF, without touching production', async t => {
  const patch = readFileSync('eval/fairness/cache-lf-fingerprint.patch', 'utf8');
  const removed = patch.split('\n').filter(line => line.startsWith('-') && !line.startsWith('---')).map(line => line.slice(1)).join('\n');
  const added = patch.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1)).join('\n');
  const original = readFileSync('lib/cache.js', 'utf8').replaceAll('\r\n', '\n');
  assert.equal(original.split(removed).length, 2, 'patch must target one exact source location');
  const directory = mkdtempSync(join(tmpdir(), 'cqa-lf-cache-'));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('cqa-lf-cache-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const modulePath = join(directory, 'cache.mjs');
  writeFileSync(modulePath, original.replace(removed, added));
  const evaluatorPath = join(directory, 'evaluator.js');
  const source = 'export const prompt = "fixture";\n';
  writeFileSync(evaluatorPath, source);
  const lf = await import(`${pathToFileURL(modulePath).href}?case=lf`);
  const lfFingerprint = lf.logicFingerprint('eval');
  const lfKey = lf.hashKey('eval', lfFingerprint, 'fixture-input');
  writeFileSync(evaluatorPath, source.replaceAll('\n', '\r\n'));
  const crlf = await import(`${pathToFileURL(modulePath).href}?case=crlf`);
  assert.equal(crlf.logicFingerprint('eval'), lfFingerprint);
  assert.equal(crlf.hashKey('eval', crlf.logicFingerprint('eval'), 'fixture-input'), lfKey);
  assert.equal(readFileSync('lib/cache.js', 'utf8').replaceAll('\r\n', '\n'), original);
});
