// Freeze an experiment plan only. There is intentionally no inference/execute mode here.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { buildMessages, schemaFor } from '../../lib/evaluator.js';
import { buildFairnessMessages, CANDIDATE_VERSION } from './evaluator-candidate.mjs';
import { fingerprint } from './validation.mjs';
import { VALIDATION_VERSION } from './policy.mjs';

globalThis.fetch = () => { throw new Error('Preparation must not call any API'); };
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const ds = read('data/datasets/DEV.json').data.records;
const cl = read('data/checklists/freedom-chat-v1.json');
const saved = read('data/evaluations/DEV.json');
const ids = readdirSync('eval/gold').filter(f => f.endsWith('.json')).map(f => read(`eval/gold/${f}`))
  .filter(g => g.status === 'reviewed').map(g => g.conversation_id).sort();
const plan = {
  status: 'prepared_only_not_executed', paid_calls: 0,
  purpose: 'Paired development comparison, not an independent test.',
  baseline_prompt_version: saved.prompt_version, candidate_version: CANDIDATE_VERSION,
  shared_model: saved.model, shared_checklist_sha256: fingerprint(cl),
  shared_schema_sha256: fingerprint(schemaFor(cl)), shared_validation_version: VALIDATION_VERSION,
  generation_settings: null, budget_cap_usd: null,
  baseline_saved_generation_settings_verified: false,
  prerequisites: ['Explicit paid API authorization and budget cap.',
    'Freeze identical provider/model/temperature/token limits/seed when supported for both arms.',
    'Re-use baseline generations only when their full generation settings and input provenance match.',
    'Do not compare published-only metrics without reporting total coverage and review rate.'],
  max_attempts_per_arm_dialog: 2,
  max_primary_generations: ids.length * 2, max_generations_including_repairs: ids.length * 4,
  generation_cache_key_fields: ['model', 'full_messages', 'schema', 'all_generation_settings'],
  validation_sidecar_key_fields: ['generation_output_sha256', 'validation_version', 'probe_sha256', 'checklist_sha256'],
  note: 'Changing validation alone must not invalidate paid generation cache.',
  dialogs: ids.map(id => {
    const c = ds.find(c => c.conversation_id === id);
    return { id, language: c.language, transcript_sha256: fingerprint(c.transcript),
      baseline_messages_sha256: fingerprint(buildMessages(c, cl)),
      candidate_messages_sha256: fingerprint(buildFairnessMessages(c, cl)) };
  }),
  metrics: ['all-input strict and lenient accuracy', 'false penalty/pass with a predeclared denominator',
    'NA precision/recall and mismatches', 'c08 precision/recall', 'score MAE', 'review rate', 'publishable rate',
    'evidence validity and separate human evidence sufficiency'],
  independent_test: { available: false, status: 'new unseen human-reviewed RU/KZ/EN set required after prompt freeze' },
  audio_review: { status: 'not_performed', queue: 'eval/runs/transcript-compat-audio-queue.json' },
};
writeFileSync('eval/runs/transcript-compat-comparison-plan.json', JSON.stringify(plan, null, 2)+'\n');
console.log(`Prepared ${ids.length} development pairs; 0 API calls. Generation settings and budget are unset.`);
