// Deterministic CQA scoring engine (reference implementation).
// Rules: docs/case/checklist.md "Порядок расчёта" + AGENTS.md §6. Shapes: docs/CONTRACTS.md §2–3.
// Pure: no DOM, no network. Lane C ports this 1:1 to app/src/scoring.ts and tests both on the same fixtures.

/** Max step of a scale criterion (top step = full weight). */
export function maxStep(criterion) {
  return Math.max(...(criterion.scale || []).map((s) => s.value));
}

/** Is the answer allowed for this criterion? Returns an error string or null. */
export function validateAnswer(criterion, answer) {
  if (answer === 'na') return criterion.na_allowed ? null : `N/A не разрешён для «${criterion.title}»`;
  if (criterion.type === 'binary' || criterion.type === 'flag') return answer === 'yes' || answer === 'no' ? null : 'Ожидается yes/no';
  if (criterion.type === 'scale') {
    return (criterion.scale || []).some((s) => s.value === answer) ? null : `Значение ${answer} не входит в шкалу`;
  }
  return 'Неизвестный тип критерия';
}

/** Raw points before N/A redistribution (null = not counted). */
export function rawPoints(criterion, answer) {
  if (criterion.type === 'flag' || answer === 'na' || answer == null) return null;
  if (criterion.type === 'binary') return answer === 'yes' ? criterion.weight : 0;
  if (criterion.type === 'scale') {
    const v = Number(answer);
    return Number.isFinite(v) ? (criterion.weight * v) / maxStep(criterion) : null; // invalid answer → not counted, flagged by validateAnswer
  }
  return null;
}

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * Score one evaluation.
 * @param {object} checklist  Checklist (CONTRACTS §2)
 * @param {Record<string, any>} answers  criterion_id -> 'yes' | 'no' | 'na' | number
 * @returns {{ total: number|null, gross_error: boolean, criteria: object[], sections: object[], applicable_weight: number }}
 */
export function score(checklist, answers) {
  const crits = [...checklist.criteria].sort((a, b) => a.order - b.order);
  const weighted = crits.filter((c) => c.type !== 'flag' && c.weight > 0);
  const applicable = weighted.filter((c) => answers[c.id] !== 'na' && answers[c.id] != null);
  const applicableWeight = applicable.reduce((s, c) => s + c.weight, 0);
  const totalWeight = weighted.reduce((s, c) => s + c.weight, 0) || 100;
  // Step 4: redistribute N/A weight proportionally so the max stays 100.
  const factor = applicableWeight > 0 ? 100 / applicableWeight : 0;

  const rawScaled = new Map();
  const rows = crits.map((c) => {
    const answer = answers[c.id];
    const raw = rawPoints(c, answer);
    const effective = raw == null ? null : round2(c.weight * factor);
    const points = raw == null ? null : round2(raw * factor);
    rawScaled.set(c.id, raw == null ? 0 : raw * factor); // unrounded, used for totals (checklist: round only the total)
    return {
      criterion_id: c.id,
      answer: answer ?? null,
      raw_points: raw == null ? null : round2(raw),
      points,
      weight: c.weight,
      effective_weight: effective,
      error: answer == null ? 'нет ответа' : validateAnswer(c, answer),
    };
  });

  const sum = crits.reduce((s, c) => s + (rawScaled.get(c.id) || 0), 0);
  const total = applicableWeight > 0 ? round2(sum) : null; // Step 5: not calculated if nothing applicable
  const gross_error = crits.some((c) => c.type === 'flag' && answers[c.id] === 'yes');

  const sections = (checklist.sections || []).map((sec) => {
    const inSec = rows.filter((r) => crits.find((c) => c.id === r.criterion_id)?.section_id === sec.id);
    const got = inSec.reduce((s, r) => s + (rawScaled.get(r.criterion_id) || 0), 0);
    const max = inSec.reduce((s, r) => s + (r.effective_weight ?? 0), 0);
    return { section_id: sec.id, title: sec.title, points: round2(got), max: round2(max), score: max > 0 ? round2((got / max) * 100) : null };
  });

  return { total, gross_error, criteria: rows, sections, applicable_weight: applicableWeight, nominal_weight: totalWeight };
}

/** Score tier used by the UI (score ring color). */
export function tier(total) {
  if (total == null) return 'none';
  if (total >= 85) return 'high';
  if (total >= 60) return 'mid';
  return 'low';
}

/** Self-test against the rules in the checklist PDF. Run: node prototype/scoring.js  (or open the console in the prototype). */
export function selfTest(checklist) {
  const all = Object.fromEntries(checklist.criteria.map((c) => [c.id, c.type === 'scale' ? maxStep(c) : c.type === 'flag' ? 'no' : 'yes']));
  const t = [];
  t.push(['all yes → 100', score(checklist, all).total === 100]);
  const someNa = { ...all, c02: 'na', c03: 'na' };
  t.push(['N/A redistributes, still 100', score(checklist, someNa).total === 100]);
  const half = { ...all, c04: 10 };
  t.push(['c04=10 of 20 with weight 20 → 90', score(checklist, half).total === 90]);
  const worst = Object.fromEntries(checklist.criteria.map((c) => [c.id, c.na_allowed ? 'na' : c.type === 'scale' ? 0 : 'no']));
  t.push(['gross flag never adds points', score(checklist, { ...all, c08: 'yes' }).total === 100 && score(checklist, { ...all, c08: 'yes' }).gross_error]);
  t.push(['N/A where allowed + worst elsewhere → 0', score(checklist, worst).total === 0]);
  const nothing = Object.fromEntries(checklist.criteria.map((c) => [c.id, c.type === 'flag' ? 'no' : 'na']));
  t.push(['nothing applicable → total null (not calculated)', score(checklist, nothing).total === null]);
  const mixed = { ...all, c02: 'na', c06: 7, c07: 'no' }; // applicable 85: 10+20+20+15+10.5+0 = 75.5 → 75.5/85*100
  t.push(['mixed case rounds to 2 decimals (88.82)', score(checklist, mixed).total === 88.82]);
  // Rounding regression (gold audit): official = round(100·Σraw/Σweights, 2) = 30.59; rounding each row first gave 30.58.
  const r3 = { c01: 'yes', c02: 'na', c03: 'no', c04: 5, c05: 'no', c06: 4, c07: 'yes', c08: 'no' };
  t.push(['total rounds once at the end (30.59, not 30.58)', score(checklist, r3).total === 30.59]);
  return t;
}
