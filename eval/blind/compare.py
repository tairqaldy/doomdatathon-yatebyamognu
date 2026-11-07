"""Compare blind labelers A/B with evaluator runs, per criterion.
usage: python3 -I eval/blind/compare.py eval/blind/blind-24.json name=<evaluations-or-app-data.json> [name=...]
   or: python3 -I eval/blind/compare.py <labeler-A.json> <labeler-B.json> name=<file> [name=...]
Accepts eval/runs/*.evaluations.json ({evaluations:[{conversation_id, criteria:[{criterion_id, answer}]}]})
or data/evaluations/<group>.json ({results:{id:{answers:{cid:{answer}}}}})."""
import json, sys, collections

def norm(a):
    if a is None: return None
    s = str(a).strip().lower()
    if s in ('n/a', 'na', 'null'): return 'na'
    try:
        f = float(s); return str(int(f)) if f == int(f) else str(f)
    except ValueError: return s

def load_run(path):
    d = json.load(open(path))
    out = {}
    if 'evaluations' in d:
        for e in d['evaluations']:
            out[e['conversation_id']] = {c['criterion_id']: norm(c['answer']) for c in e['criteria']}
    else:
        for cid, r in d['results'].items():
            out[cid] = {k: norm(v.get('answer')) for k, v in r['answers'].items()}
    return out

first = json.load(open(sys.argv[1]))
if 'labelers' in first: A, B, rest = first['labelers']['A'], first['labelers']['B'], sys.argv[2:]
else: A, B, rest = first, json.load(open(sys.argv[2])), sys.argv[3:]
runs = {}
for arg in rest:
    name, path = arg.split('=', 1); runs[name] = load_run(path)
ids = sorted(set(A) & set(B))
crits = [f'c0{i}' for i in range(1, 9)]
a = lambda L, i, c: norm(L[i][c]['a'])
alts = lambda L, i, c: {a(L, i, c)} | ({norm(L[i][c]['alt'])} if L[i][c].get('alt') is not None else set())

print(f'{len(ids)} dialogs\n')
hdr = f"{'crit':5} {'A=B':>6}" + ''.join(f" {n+'~A':>8} {n+'~B':>8} {n+'~AB':>8}" for n in runs)
print(hdr)
tot = collections.Counter()
for c in crits:
    ab = sum(a(A, i, c) == a(B, i, c) for i in ids)
    row = f'{c:5} {ab:>3}/{len(ids):<2}'
    tot['ab'] += ab
    for n, R in runs.items():
        have = [i for i in ids if i in R]
        va = sum(R[i].get(c) == a(A, i, c) for i in have)
        vb = sum(R[i].get(c) == a(B, i, c) for i in have)
        agreed = [i for i in have if a(A, i, c) == a(B, i, c)]
        vab = sum(R[i].get(c) == a(A, i, c) for i in agreed)
        tot[n + 'a'] += va; tot[n + 'b'] += vb; tot[n + 'ab'] += vab; tot[n + 'abn'] += len(agreed); tot[n + 'n'] += len(have)
        row += f' {va:>4}/{len(have):<3} {vb:>4}/{len(have):<3} {vab:>4}/{len(agreed):<3}'
    print(row)
print(f"\nA=B overall {tot['ab']}/{len(ids)*8} = {tot['ab']/(len(ids)*8):.1%}")
for n in runs:
    print(f"{n}: vs A {tot[n+'a']/tot[n+'n']:.1%}  vs B {tot[n+'b']/tot[n+'n']:.1%}  vs A&B-agreed {tot[n+'ab']}/{tot[n+'abn']} = {tot[n+'ab']/max(1,tot[n+'abn']):.1%}")

for n, R in runs.items():
    print(f'\n--- {n}: both labelers agree, {n} differs ---')
    for i in ids:
        if i not in R: continue
        for c in crits:
            if a(A, i, c) == a(B, i, c) and R[i].get(c) != a(A, i, c):
                print(f"{i} {c}: experts={a(A,i,c)} {n}={R[i].get(c)} | A: {A[i][c]['why'][:110]}")
print('\n--- labelers disagree (ambiguous) ---')
for i in ids:
    for c in crits:
        if a(A, i, c) != a(B, i, c):
            print(f"{i} {c}: A={a(A,i,c)}(alt {A[i][c].get('alt')}) B={a(B,i,c)}(alt {B[i][c].get('alt')}) " + ' '.join(f"{n}={R.get(i,{}).get(c)}" for n, R in runs.items()))
