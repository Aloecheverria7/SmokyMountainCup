"""Real parallel PHP processes against a disposable MySQL database."""
import concurrent.futures
import json
import os
import secrets
import subprocess
import time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
PHP = os.environ.get('PHP_BINARY', 'php')
def call(mode, data=None):
    result = subprocess.run([PHP, 'tests/concurrency.php', mode], cwd=ROOT, input=json.dumps(data) if data else '', text=True, capture_output=True, timeout=45)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return json.loads(result.stdout)
setup = call('setup')
def batch(tasks):
    start = time.time() + 2
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        return list(pool.map(lambda data: call('worker', dict(data, start=start)), tasks))
def goal(match, version, key):
    return dict(user=setup['user'], data=dict(action='goal', match_id=match, entry_id=2*match-1, version=version, request_key=key, minute=5, kind='goal'))
first = setup['matches'][0]
shared = goal(first, 0, secrets.token_hex(16))
duplicates = batch([shared]*8)
assert all(r['ok'] for r in duplicates) and sum(not r['duplicate'] for r in duplicates)==1
assert call('state')['events']==1
print('PASS eight simultaneous retries persist exactly one goal')
race = batch([goal(first, 1, secrets.token_hex(16)) for _ in range(8)])
assert sum(r['ok'] for r in race)==1 and sum(r.get('conflict', False) for r in race)==7
assert call('state')['events']==2
print('PASS competing edits accept one version and reject seven stale writes')
independent = batch([goal(mid, 0, secrets.token_hex(16)) for mid in setup['matches'][1:]])
assert all(r['ok'] for r in independent)
state = call('state')
assert state['events']==19 and state['requests']==19
assert state['matches'][0]['home_score']==2 and all(m['home_score']==1 for m in state['matches'][1:])
print('PASS seventeen independent matches update without cross-contamination')
reads = batch([dict(kind='read') for _ in range(8)])
times = sorted(t for r in reads for t in r['times'])
assert all(r['ok'] for r in reads) and len(times)==160
print(f'PASS 160 concurrent feed reads; p95={times[int(len(times)*.95)-1]:.1f} ms (local smoke measurement, not hosting capacity)')
