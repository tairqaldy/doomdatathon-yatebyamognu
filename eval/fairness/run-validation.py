"""One reproducible offline regression command. Historical artifacts are not overwritten."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from run import ROOT, experiment, load_module


def save(name, value):
    (ROOT/'eval/runs'/name).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


guard = load_module(ROOT/'eval/transcript_guard.py')
source = subprocess.check_output(['git', 'show', 'fbb45c2:eval/transcript_guard.py'], cwd=ROOT).decode('utf-8')
baseline = {'__name__': 'baseline'}
exec(compile(source, 'baseline@fbb45c2', 'exec'), baseline)
adversarial = json.loads((ROOT/'eval/fairness/adversarial.json').read_text(encoding='utf-8'))
prior = json.loads((ROOT/'eval/fairness/fixtures.json').read_text(encoding='utf-8'))
report = {'scope': 'offline regression, not independent model accuracy', 'baseline_commit': 'fbb45c2',
          'baseline': experiment(baseline, adversarial), 'candidate': experiment(guard, adversarial),
          'prior_development_regression': experiment(guard, prior['development']),
          'prior_synthetic_regression': experiment(guard, prior['holdout']),
          'source_sha256': hashlib.sha256((ROOT/'eval/transcript_guard.py').read_bytes()).hexdigest()}
save('transcript-validation-guard.json', guard['summarize_dataset'](ROOT/'data/datasets/DEV.json'))
commands = [[sys.executable, '-m', 'unittest', 'discover', '-s', 'eval/fairness', '-p', 'test_guard.py', '-v'],
            ['node', '--test', 'eval/fairness/candidate.test.mjs', 'eval/fairness/validation.test.mjs'],
            ['node', 'scripts/test-scoring.mjs'], ['node', 'eval/fairness/audit-validation.mjs']]
report['checks'] = []
for command in commands:
    run = subprocess.run(command, cwd=ROOT, capture_output=True, encoding='utf-8', errors='replace')
    report['checks'].append({'command': command, 'exit_code': run.returncode, 'stdout': run.stdout, 'stderr': run.stderr})
save('transcript-validation-tests.json', report)
print(json.dumps({key: f"{report[key]['passed']}/{report[key]['total']}" for key in
                 ['baseline', 'candidate', 'prior_development_regression', 'prior_synthetic_regression']}))
print('Command exit codes:', [check['exit_code'] for check in report['checks']])
failed = any(check['exit_code'] for check in report['checks']) or any(report[key]['passed'] != report[key]['total']
    for key in ['candidate', 'prior_development_regression', 'prior_synthetic_regression'])
raise SystemExit(1 if failed else 0)
