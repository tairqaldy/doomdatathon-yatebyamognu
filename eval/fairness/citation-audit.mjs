import { writeFileSync } from 'node:fs';
import { loadCitationInputs, inspectCitationCase } from './citation-audit-lib.mjs';

globalThis.fetch = () => { throw new Error('Offline citation investigation must never call a model or network'); };
const inputs = loadCitationInputs();
const cases = ['p4-ru-005', 'p4-ru-004'].map(id => inspectCitationCase(inputs, id));
const diagnostics = cases.flatMap(c => c.diagnostics);
const report = { scope: 'Offline investigation of persisted diagnostics; not human audio review or score correction.',
  paid_calls: 0, total_diagnostics: diagnostics.length,
  selected_sample_diagnostics: diagnostics.filter(d => d.belongs_to_selected_sample).length,
  unselected_sample_diagnostics: diagnostics.filter(d => !d.belongs_to_selected_sample).length,
  unique_message_anchors: new Set(cases.flatMap(c => c.diagnostics.map(d => `${c.conversation_id}:${d.turn_index}`))).size,
  cache_provenance: inputs.cache_provenance,
  evidence_loss: 'normalize() checks the original model quote, then stores the transcript prefix instead. The original mismatching quote is not retained in these sample cache entries.',
  score_implication: 'A quote mismatch is not proof that the criterion answer is wrong. No diagnostics are cleared and no answers or N/A values are changed.',
  cases };
writeFileSync('eval/runs/citation-investigation.json', JSON.stringify(report, null, 2)+'\n');
const lines = ['# Расследование 17 citation diagnostics', '',
  'Исходные неверные цитаты модели не сохранены. Ссылка ниже указывает на оригинальный transcript; наличие нормализованной цитаты не снимает диагностическое сообщение.', '',
  '| Диалог | Sample | Критерий | Индекс | Speaker | Выбран для финального критерия | Оригинальная цитата модели |', '|---|---:|---|---:|---|---|---|'];
for (const c of cases) for (const d of c.diagnostics) lines.push(`| ${c.conversation_id} | ${d.sample} | ${d.criterion_id} | ${d.turn_index} | ${d.source_speaker} | ${d.belongs_to_selected_sample ? 'да' : 'нет'} | не сохранена |`);
writeFileSync('eval/runs/citation-investigation.md', lines.join('\n')+'\n');
console.log(JSON.stringify({ total: report.total_diagnostics, selected: report.selected_sample_diagnostics,
  unselected: report.unselected_sample_diagnostics, unique_anchors: report.unique_message_anchors, cache: report.cache_provenance }, null, 2));
