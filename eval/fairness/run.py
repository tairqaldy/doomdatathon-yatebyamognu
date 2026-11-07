"""Offline guard experiment. No HTTP or inference; raw exports stay gitignored."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_module(path):
    namespace = {'__name__': 'guard_experiment', '__file__': str(path)}
    exec(compile(path.read_text(encoding='utf-8'), str(path), 'exec'), namespace)
    return namespace


def experiment(guard, fixtures):
    results = []
    for f in fixtures:
        actual = guard['greeting_probe'](f['text'], f['language'],
            f.get('first_agent_turn', True), f.get('asr_uncertain', False))['status']
        results.append({'id': f['id'], 'expected': f['expected'], 'actual': actual,
                        'passed': actual == f['expected']})
    return {'passed': sum(r['passed'] for r in results), 'total': len(results),
            'false_supports': sum(r['actual'] == 'supported' and r['expected'] != 'supported' for r in results),
            'cases': results}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--iteration', default='final')
    parser.add_argument('--holdout', action='store_true')
    args = parser.parse_args()
    fixtures = json.loads((ROOT/'eval/fairness/fixtures.json').read_text(encoding='utf-8'))
    current = ROOT/'eval/transcript_guard.py'
    baseline = ROOT/'eval/fairness/guard-v0.snapshot.txt'
    report = {'kind': 'offline guard experiment, not LLM accuracy', 'iteration': args.iteration,
              'fixture_sha256': hashlib.sha256((ROOT/'eval/fairness/fixtures.json').read_bytes()).hexdigest(),
              'guard_sha256': hashlib.sha256(current.read_bytes()).hexdigest(),
              'baseline': experiment(load_module(baseline), fixtures['development']),
              'candidate': experiment(load_module(current), fixtures['development'])}
    guard = load_module(current)
    try:
        report['baseline_dataset'] = load_module(baseline)['summarize_dataset'](ROOT/'data/datasets/DEV.json')
    except ValueError as error:
        report['baseline_dataset'] = {'error': str(error)}
    report['dataset'] = guard['summarize_dataset'](ROOT/'data/datasets/DEV.json')
    if args.holdout:
        report['holdout'] = experiment(guard, fixtures['holdout'])
    output = ROOT/f'eval/runs/transcript-{args.iteration}.json'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: {'passed': report[k]['passed'], 'total': report[k]['total'],
                         'false_supports': report[k]['false_supports']}
                      for k in ('baseline', 'candidate', 'holdout') if k in report}))
    print(f"dataset={report['dataset']['dialog_count']}; report={output.relative_to(ROOT)}")


if __name__ == '__main__':
    main()
