"""Static inventory. Run: python tools/audit_site.py (no dependencies)."""
import csv
import re
from collections import deque
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'audit'
OUT.mkdir(parents=True, exist_ok=True)
files = {p.relative_to(ROOT).as_posix(): p for p in ROOT.rglob('*')
         if p.is_file() and not any(x in p.parts for x in ('.git', 'docs', 'tools', 'storage', 'tests')) and p.name!='local.php'}
edges = {}
missing = []
for name, path in files.items():
    if path.suffix.lower() not in ('.php', '.html', '.css', '.js'):
        continue
    source = path.read_text(encoding='utf-8', errors='replace')
    source = re.sub(r'<!--.*?-->|/\*.*?\*/', '', source, flags=re.S)
    if path.suffix == '.php':
        source = re.sub(r'^\s*//.*$', '', source, flags=re.M)
    refs = re.findall(r'''(?:\b(?:src|href|action|data-src|data-lazyload)\s*=\s*|\burl\(\s*|\b(?:fetch|url)\s*[:(]\s*)["']([^"']+)["']''', source, re.I)
    if path.suffix == '.php':
        refs += re.findall(r'''\b(?:include|require)(?:_once)?\s*\(?\s*["']([^"']+)["']''', source)
        refs += re.findall(r'''Location:\s*([^\s"']+)''', source, re.I)
    refs += re.findall(r'''url\(\s*([^\s"'()]+)\s*\)''', source, re.I)
    for candidates in re.findall(r'''\bsrcset\s*=\s*["']([^"']+)["']''', source, re.I):
        refs.extend(item.strip().split()[0] for item in candidates.split(',') if item.strip())
    edges[name] = set()
    if path.suffix == '.php':
        for ref in re.findall(r'''\b(?:include|require)(?:_once)?\s*\(?\s*__DIR__\s*\.\s*["']([^"']+)["']''', source):
            try:
                target = (path.parent / ref.lstrip('/')).resolve().relative_to(ROOT).as_posix()
            except ValueError:
                continue
            edges[name].add(target)
            if target not in files:
                missing.append((name, ref, target))
    for ref in refs:
        if ref.startswith(('#', '//')) or any(x in ref for x in ('<?', '$', '{', '+', '(')):
            continue
        url = urlsplit(ref)
        if url.scheme or not url.path:
            continue
        target = unquote(url.path).lstrip('/')
        # Shared root PHP templates emit URLs relative to the public root.
        base = path.parent if path.suffix in ('.css', '.html') or name.startswith('score/') else ROOT
        resolved = (base / target).resolve()
        try:
            key = resolved.relative_to(ROOT).as_posix()
        except ValueError:
            continue
        edges[name].add(key)
        if key not in files:
            missing.append((name, ref, key))
reachable = set()
queue = deque(['index.php'])
while queue:
    name = queue.popleft()
    if name in reachable or name not in files:
        continue
    reachable.add(name)
    queue.extend(edges.get(name, ()))
referenced = set().union(*edges.values())
def write(name, columns, rows):
    with (OUT / name).open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        writer.writerows(rows)
write('files.csv', ['file', 'bytes', 'reachable_from_home', 'has_static_reference'],
      ((n, p.stat().st_size, n in reachable, n in referenced) for n, p in sorted(files.items())))
write('missing-references.csv', ['source', 'reference', 'resolved_path'], sorted(set(missing)))
images = [(n, p) for n, p in files.items() if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg')]
write('images.csv', ['file', 'bytes', 'reachable_from_home', 'has_static_reference'],
      ((n, p.stat().st_size, n in reachable, n in referenced) for n, p in sorted(images, key=lambda x: -x[1].stat().st_size)))
write('dependencies.csv', ['source', 'target'], ((n, t) for n in sorted(edges) for t in sorted(edges[n])))
print(f'{len(files)} files; {len(reachable)} reachable; {len(images)} images; {len(set(missing))} missing static references')
print('Static candidates only: dynamic URLs, CSS imports, srcset and external links need separate verification.')
