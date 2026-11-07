"""Offline compatibility regression/replay. Keeps historical strict-policy outputs intact."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from run import ROOT, experiment, load_module

def save(name, value):
    (ROOT/'eval/runs'/f'transcript-compat-{name}.json').write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

protected = [ROOT/'data/datasets/DEV.json', ROOT/'data/evaluations/DEV.json',
             ROOT/'eval/runs/transcript-validation-audit.json', *sorted((ROOT/'eval/cache/eval').glob('*.json')),
             *sorted((ROOT/'eval/gold').glob('*.json'))]
hashes = lambda: {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
before = hashes()
guard = load_module(ROOT/'eval/transcript_guard.py')
save('guard', guard['summarize_dataset'](ROOT/'data/datasets/DEV.json'))
report = {'scope': 'Offline compatibility and regression tests, no new inference', 'checks': []}
for filename, key in [('adversarial.json', None), ('fixtures.json', 'development'), ('fixtures.json', 'holdout')]:
    fixtures = json.loads((ROOT/'eval/fairness'/filename).read_text(encoding='utf-8'))
    report[key or 'adversarial'] = experiment(guard, fixtures[key] if key else fixtures)
commands = [[sys.executable, '-m', 'unittest', 'discover', '-s', 'eval/fairness', '-p', 'test_guard.py', '-v'],
            ['node', '--test', 'eval/fairness/candidate.test.mjs', 'eval/fairness/validation.test.mjs', 'eval/fairness/compatibility.test.mjs'],
            ['node', 'scripts/test-scoring.mjs'], ['node', 'eval/fairness/audit-validation.mjs'],
            ['node', 'eval/fairness/prepare-comparison.mjs']]
for command in commands:
    run = subprocess.run(command, cwd=ROOT, capture_output=True, encoding='utf-8', errors='replace')
    report['checks'].append({'command': command, 'exit_code': run.returncode, 'stdout': run.stdout, 'stderr': run.stderr})
report['protected_inputs_unchanged'] = before == hashes()
report['protected_input_hashes'] = before
save('tests', report)
print(json.dumps({'guard': {key: f"{report[key]['passed']}/{report[key]['total']}" for key in ['adversarial', 'development', 'holdout']},
                  'exit_codes': [check['exit_code'] for check in report['checks']],
                  'protected_inputs_unchanged': report['protected_inputs_unchanged']}))
failed = any(check['exit_code'] for check in report['checks']) or not report['protected_inputs_unchanged']
failed = failed or any(report[key]['passed'] != report[key]['total'] for key in ['adversarial', 'development', 'holdout'])
raise SystemExit(1 if failed else 0)
