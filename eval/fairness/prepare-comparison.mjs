// Freeze an experiment plan only. There is intentionally no inference/execute mode here.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { buildMessages, schemaFor, PROMPT_VERSION, DEFAULT_SAMPLES } from '../../lib/evaluator.js';
import { buildFairnessMessages, CANDIDATE_VERSION } from './evaluator-candidate.mjs';
import { fingerprint } from './validation.mjs';
import { VALIDATION_VERSION } from './policy.mjs';

globalThis.fetch = () => { throw new Error('Preparation must not call any API'); };
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const ds = read('data/datasets/DEV.json').data.records;
const cl = read('data/checklists/freedom-chat-v1.json');
const saved = read('data/evaluations/DEV.json');
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex < 0 ? 'eval/runs/review-cases-comparison-plan.json' : process.argv[outputIndex + 1];
if (!/^eval\/runs\/[a-z0-9-]+\.json$/.test(output)) throw new Error('Invalid output path');
const samples = PROMPT_VERSION === 'eval-v4' ? 1 : DEFAULT_SAMPLES;
const ids = readdirSync('eval/gold').filter(f => f.endsWith('.json')).map(f => read(`eval/gold/${f}`))
  .filter(g => g.status === 'reviewed').map(g => g.conversation_id).sort();
const plan = {
  status: 'prepared_only_not_executed', paid_calls: 0,
  purpose: 'Paired development comparison, not an independent test.',
  baseline_prompt_version: PROMPT_VERSION, saved_prompt_version: saved.prompt_version, candidate_version: CANDIDATE_VERSION,
  shared_model: saved.model, shared_checklist_sha256: fingerprint(cl),
  shared_schema_sha256: fingerprint(schemaFor(cl, PROMPT_VERSION)), shared_validation_version: VALIDATION_VERSION,
  proposed_architecture: { samples_per_arm_dialog: samples,
    shared_postprocessing: PROMPT_VERSION === 'eval-v4' ? 'normalize' : 'normalize + normalizeFacts + deriveBuiltins + vote via combineSamples',
    require_all_samples_completed: true, max_completion_tokens_per_sample: PROMPT_VERSION === 'eval-v4' ? 4000 : 9000,
    temperature_from_current_client_default: 0,
    note: 'Freeze and record effective request settings, including any provider fallback that removes temperature.' },
  generation_settings: null, budget_cap_usd: null,
  baseline_saved_generation_settings_verified: false,
  prerequisites: ['Explicit paid API authorization and budget cap.',
    'Freeze identical provider/model/temperature/token limits/seed when supported for both arms.',
    'Re-use baseline generations only when their full generation settings and input provenance match.',
    'Do not compare published-only metrics without reporting total coverage and review rate.'],
  max_attempts_per_arm_dialog: 2,
  max_primary_generations: ids.length * 2 * samples, max_generations_including_repairs: ids.length * 4 * samples,
  generation_cache_key_fields: ['model', 'full_messages', 'schema', 'all_generation_settings', 'sampling_replica_id'],
  transport_retry_budget: 'Must be declared separately; the counts below cover generation attempts and bounded repair, not arbitrary provider HTTP retries.',
  validation_sidecar_key_fields: ['generation_output_sha256', 'validation_version', 'probe_sha256', 'checklist_sha256'],
  note: 'Changing validation alone must not invalidate paid generation cache.',
  dialogs: ids.map(id => {
    const c = ds.find(c => c.conversation_id === id);
    return { id, language: c.language, transcript_sha256: fingerprint(c.transcript),
      baseline_messages_sha256: fingerprint(buildMessages(c, cl, PROMPT_VERSION)),
      candidate_messages_sha256: fingerprint(buildFairnessMessages(c, cl, PROMPT_VERSION)) };
  }),
  metrics: ['all-input strict and lenient accuracy', 'false penalty/pass with a predeclared denominator',
    'NA precision/recall and mismatches', 'c08 precision/recall', 'score MAE', 'review rate', 'publishable rate',
    'evidence validity and separate human evidence sufficiency'],
  independent_test: { available: false, status: 'new unseen human-reviewed RU/KZ/EN set required after prompt freeze' },
  audio_review: { status: 'not_performed', queue: 'eval/runs/transcript-compat-audio-queue.json' },
};
writeFileSync(output, JSON.stringify(plan, null, 2)+'\n');
console.log(`Prepared ${ids.length} development pairs; 0 API calls. Generation settings and budget are unset.`);
