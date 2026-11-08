"""Local syntax and GET rendering checks; never submits forms or updates games."""
import csv
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'audit'
OUT.mkdir(parents=True, exist_ok=True)
rows = []
for path in sorted(ROOT.rglob('*.php')):
    if any(x in path.relative_to(ROOT).parts for x in ('storage', 'plugins')):
        continue
    proc = subprocess.run(['php', '-l', str(path)], capture_output=True, text=True, errors='replace')
    rows.append((path.relative_to(ROOT).as_posix(), 'pass' if proc.returncode == 0 else 'fail'))
with (OUT / 'php-syntax.csv').open('w', newline='', encoding='utf-8-sig') as f:
    writer = csv.writer(f)
    writer.writerow(['file', 'syntax'])
    writer.writerows(rows)
print(f'PHP syntax: {sum(r[1] == "pass" for r in rows)}/{len(rows)} pass')

pages = ['index.php', 'about.php', 'contact.php', 'gallery.php', 'tournament.php',
         'thank-you.php', 'sorry.php', 'admin/index.php']
results = []
for name in pages:
    code = "$_SERVER['REQUEST_METHOD']='GET'; $_SERVER['PHP_SELF']='/%s'; include '%s';" % (name, name)
    proc = subprocess.run(['php', '-d', 'display_errors=1', '-r', code], cwd=ROOT,
                          capture_output=True, text=True, errors='replace', timeout=15)
    html = proc.stdout
    errors = len(re.findall(r'(?:Warning|Fatal error|Deprecated|Notice):', html + proc.stderr))
    heads = len(re.findall(r'<head(?:\s|>)', html, re.I))
    bodies = len(re.findall(r'<body(?:\s|>)', html, re.I))
    results.append((name, proc.returncode, errors, heads, bodies, '</head>' in html, '</html>' in html))
with (OUT / 'render.csv').open('w', newline='', encoding='utf-8-sig') as f:
    writer = csv.writer(f)
    writer.writerow(['page', 'exit_code', 'php_diagnostics', 'head_count', 'body_count', 'head_closed', 'html_closed'])
    writer.writerows(results)
print(f'GET render: {sum(r[1] == 0 and r[2] == 0 for r in results)}/{len(results)} without PHP diagnostics')
for row in results:
    if row[1] or row[2] or row[3:5] != (1, 1) or not all(row[5:]):
        print(row)
if any(r[1] != 'pass' for r in rows) or any(r[1] or r[2] or r[3:5] != (1, 1) or not all(r[5:]) for r in results):
    sys.exit(1)
