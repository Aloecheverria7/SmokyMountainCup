"""Portable pre-push/CI checks. MySQL databases are generated and removed by this run."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
from legacy_fixture import generate
parser=argparse.ArgumentParser()
parser.add_argument('--mysql',action='store_true',help='Also run integration and concurrent writes against disposable MySQL databases')
parser.add_argument('--browser',action='store_true',help='Run Chrome end-to-end checks')
args=parser.parse_args()
php=os.environ.get('PHP_BINARY','php')
env=dict(os.environ)
env.pop('APP_TEST_MYSQL_DSN',None)
env['APP_SMTP_HOST']=''
fixture=ROOT/'tests/artifacts/legacy.sql'
generate(fixture)
def run(command, testenv=None, capture=False):
    result=subprocess.run(command,cwd=ROOT,env=testenv or env,text=True,capture_output=capture,timeout=240)
    if result.returncode:
        if capture:print(result.stdout,result.stderr,file=sys.stderr)
        raise RuntimeError('Check failed: '+' '.join(command[:3]))
    return result.stdout if capture else None
try:
    run([php,'tests/unit.php'])
    run([php,'tests/integration.php',str(fixture)])
    prepared=json.loads(run([php,'tests/fixture.php'],capture=True))
    renderenv=dict(env,APP_DSN='sqlite:'+prepared['database'])
    run([sys.executable,'tools/verify_site.py'],renderenv)
    for script in ['js/admin.js','js/results.js','tests/browser.mjs']:
        run(['node','--check',script])
    run([sys.executable,'tests/smtp_test.py'])
    if args.mysql:
        for command in [[php,'tests/integration.php',str(fixture)],[sys.executable,'tests/concurrency.py']]:
            database=json.loads(run([php,'tests/mysql_database.php','create'],capture=True))
            try:
                run(command,dict(env,APP_TEST_MYSQL_DSN=database['dsn']))
            finally:
                run([php,'tests/mysql_database.php','drop',database['name']])
    if args.browser:
        run(['node','tests/browser.mjs'])
    print('ALL REQUESTED CHECKS PASSED',flush=True)
except (RuntimeError,subprocess.TimeoutExpired,FileNotFoundError) as error:
    print(str(error),file=sys.stderr)
    sys.exit(1)
