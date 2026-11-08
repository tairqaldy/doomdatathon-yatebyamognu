"""Chance-corrected agreement for the evaluator, with intervals and a human ceiling. Free: reads committed files only.

usage: python3 -I eval/agreement.py [name=<run>] ... [--json out.json] [--md out.md]
  default run: v53=data/evaluations/DEV.json (the production eval-v5.3 answers)
  <run> = data/evaluations/<group>.json or eval/runs/*.evaluations.json (same loader as eval/blind/compare.py)

What it reports, per criterion and overall, on chats only (the control set is 10 chats):
  gold   = our 18 reviewed gold chats (eval/gold, drafted by an agent, reviewed by a human): strict %, Wilson 95% CI, Cohen's kappa
  blind  = consensus of two independent AI labelers on 24 other DEV chats (eval/blind/blind-24.json): strict %, CI, kappa
  ceiling= labeler A vs labeler B on the same 24 chats: how much two careful readers agree with each other
  votes  = share of answers where all self-consistency samples agreed (the confidence shown in the admin card)
Kappa is n/a when a criterion has one class only in the reference (e.g. C3 is N/A in every blind chat): agreement there
says little, which is exactly why strict % alone flatters us.
"""
import json, glob, math, sys, collections

CRITS = [f'c0{i}' for i in range(1, 9)]


def norm(a):
    if a is None: return 'na'
    s = str(a).strip().lower()
    if s in ('n/a', 'na', 'null', 'none'): return 'na'
    try:
        f = float(s); return str(int(f)) if f == int(f) else str(f)
    except ValueError: return s


def load_run(path):
    d = json.load(open(path))
    ans, agr = {}, {}
    if 'evaluations' in d:
        for e in d['evaluations']:
            ans[e['conversation_id']] = {c['criterion_id']: norm(c['answer']) for c in e['criteria']}
            agr[e['conversation_id']] = e.get('agreement') or {}
    else:
        for cid, r in d['results'].items():
            ans[cid] = {k: norm(v.get('answer')) for k, v in r['answers'].items()}
            agr[cid] = r.get('agreement') or {}
    return ans, agr


def wilson(k, n, z=1.96):
    if n == 0: return (None, None)
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (round(100 * (c - h), 1), round(100 * (c + h), 1))


def kappa(x, y):
    n = len(x)
    if n == 0: return None
    po = sum(a == b for a, b in zip(x, y)) / n
    cx, cy = collections.Counter(x), collections.Counter(y)
    pe = sum(cx[k] * cy[k] for k in set(cx) | set(cy)) / (n * n)
    return None if pe >= 1 else round((po - pe) / (1 - pe), 2)


def block(pairs):
    """pairs: list of (model, reference) → dict with n, strict %, CI, kappa."""
    n = len(pairs); k = sum(a == b for a, b in pairs)
    return {'n': n, 'agree': k, 'pct': round(100 * k / n, 1) if n else None, 'ci95': wilson(k, n),
            'kappa': kappa([a for a, _ in pairs], [b for _, b in pairs])}


def main(argv):
    runs, out_json, out_md, i = {}, None, None, 0
    while i < len(argv):
        a = argv[i]
        if a == '--json': out_json = argv[i + 1]; i += 2; continue
        if a == '--md': out_md = argv[i + 1]; i += 2; continue
        name, path = a.split('=', 1); runs[name] = path; i += 1
    if not runs: runs = {'v53': 'data/evaluations/DEV.json'}

    gold = {}
    for f in sorted(glob.glob('eval/gold/*.json')):
        g = json.load(open(f))
        if g.get('status') == 'reviewed' and g['conversation_id'].startswith('p1-'):
            gold[g['conversation_id']] = {c: norm(g['labels'][c]['answer']) for c in CRITS}
    b = json.load(open('eval/blind/blind-24.json'))
    A, B = b['labelers']['A'], b['labelers']['B']
    bids = sorted(set(A) & set(B))

    report = {'chats_gold': len(gold), 'chats_blind': len(bids), 'ceiling': {}, 'runs': {}}
    # Human ceiling: labeler A vs labeler B (per criterion + overall).
    allp = []
    for c in CRITS:
        p = [(norm(A[i][c]['a']), norm(B[i][c]['a'])) for i in bids]; allp += p
        report['ceiling'][c] = block(p)
    report['ceiling']['overall'] = block(allp)

    for name, path in runs.items():
        ans, agr = load_run(path)
        r = {'gold': {}, 'blind': {}, 'votes': {}}
        tg, tb, tv = [], [], [0, 0]
        for c in CRITS:
            pg = [(ans[i][c], gold[i][c]) for i in gold if i in ans and c in ans[i]]
            # blind consensus only where both labelers agree (disputed answers are genuinely ambiguous)
            pb = [(ans[i][c], norm(A[i][c]['a'])) for i in bids if i in ans and c in ans[i] and norm(A[i][c]['a']) == norm(B[i][c]['a'])]
            tg += pg; tb += pb
            r['gold'][c], r['blind'][c] = block(pg), block(pb)
            vs = [agr[i][c] for i in ans if i.startswith('p1-') and c in (agr.get(i) or {})]
            un = sum(1 for v in vs if v >= 1)
            r['votes'][c] = {'n': len(vs), 'unanimous_pct': round(100 * un / len(vs), 1) if vs else None}
            tv[0] += un; tv[1] += len(vs)
        r['gold']['overall'], r['blind']['overall'] = block(tg), block(tb)
        r['votes']['overall'] = {'n': tv[1], 'unanimous_pct': round(100 * tv[0] / tv[1], 1) if tv[1] else None}
        report['runs'][name] = r

    fmt = lambda x: '–' if x is None else str(x)
    ci = lambda t: '–' if t[0] is None else f'{t[0]}–{t[1]}'
    lines = [f"Chats only. Gold: {len(gold)} reviewed chats (agent-drafted, human-reviewed). Blind: {len(bids)} chats, two independent AI labelers.", '']
    for name, r in report['runs'].items():
        lines += [f'### {name}', '',
                  '| crit | gold % (95% CI) | gold κ | blind consensus % (95% CI) | blind κ | ceiling A~B % | ceiling κ | unanimous votes % |',
                  '|---|---|---|---|---|---|---|---|']
        for c in CRITS + ['overall']:
            g, bl, ce, v = r['gold'][c], r['blind'][c], report['ceiling'][c], r['votes'][c]
            lines.append(f"| {c} | {fmt(g['pct'])} ({ci(g['ci95'])}) | {fmt(g['kappa'])} | {fmt(bl['pct'])} ({ci(bl['ci95'])}) | {fmt(bl['kappa'])} | {fmt(ce['pct'])} | {fmt(ce['kappa'])} | {fmt(v['unanimous_pct'])} |")
        lines.append('')
    lines.append('κ = Cohen\'s kappa (chance-corrected); "–" = one class only in the reference, so agreement there proves little.')
    text = '\n'.join(lines)
    print(text)
    if out_json: json.dump(report, open(out_json, 'w'), ensure_ascii=False, indent=1)
    if out_md: open(out_md, 'w').write(text + '\n')


if __name__ == '__main__':
    main(sys.argv[1:])
