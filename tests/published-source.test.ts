import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
const base = 'tests/fixtures/published-2026-11-14';
test('published reference fixtures are exact source captures, not the redesigned PHP baseline', () => {
  const manifest = JSON.parse(readFileSync(base + '/manifest.json', 'utf8'));
  assert.equal(manifest.length, 19);
  for (const row of manifest) {
    const name =
      row.route === '/' ? 'index.html' : row.route.slice(1) + '.html';
    const bytes = readFileSync(base + '/' + name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
  }
  const home = readFileSync(base + '/index.html', 'utf8');
  assert.match(home, /rev_slider_1_1/);
  assert.match(home, /Latest Games/);
  assert.ok(!home.includes('The game brings'));
});
test('React page documents preserve source text, navigation, forms and animation parameters', () => {
  function inventory(html: string) {
    const doc = parse(html);
    const values: any[] = [];
    function walk(n: any) {
      const a = Object.fromEntries(
        (n.attrs || []).map((a: any) => [a.name, a.value]),
      );
      if (
        n.tagName === 'script' ||
        n.tagName === 'style' ||
        n.tagName === 'head'
      )
        return;
      if (
        ['h1', 'h2', 'h3', 'form', 'rs-slide', 'rs-layer'].includes(
          n.tagName,
        ) ||
        a['data-parallax-speed']
      )
        values.push({
          tag: n.tagName,
          id: a.id,
          action: a.action,
          frame: a['data-frame_1'],
          parallax: a['data-parallax-speed'],
        });
      if (n.nodeName === '#text' && n.value.trim())
        values.push({ text: n.value.trim() });
      for (const c of n.childNodes || []) walk(c);
    }
    walk(doc);
    return values;
  }
  for (const file of readdirSync('apps/web/src/published/pages')) {
    if (!file.endsWith('.json')) continue;
    const row = JSON.parse(
      readFileSync('apps/web/src/published/pages/' + file, 'utf8'),
    );
    const name =
      row.route === '/' ? 'index.html' : row.route.slice(1) + '.html';
    assert.deepEqual(
      inventory(row.html),
      inventory(readFileSync(base + '/' + name, 'utf8')),
      row.route,
    );
    assert.ok(!/<script\b/.test(row.html));
  }
});
test('public theme resources match their recorded bundled checksums', () => {
  const manifest = JSON.parse(
    readFileSync('docs/published-reference-assets.json', 'utf8'),
  );
  for (const row of manifest) {
    if (row.error) continue;
    assert.equal(
      createHash('sha256')
        .update(readFileSync('apps/web/public' + decodeURI(row.path)))
        .digest('hex'),
      row.bundledSha256,
      row.path,
    );
  }
});

test('independent original CSS/runtime fixtures keep their captured hashes', () => {
  const manifest = JSON.parse(
    readFileSync('docs/published-reference-assets.json', 'utf8'),
  );
  for (const row of manifest) {
    if (row.error) continue;
    if (
      row.type.includes('css') ||
      row.path.endsWith('.css') ||
      row.compatibilityPatch
    ) {
      const bytes = readFileSync(
        'tests/fixtures/published-original-assets' + row.path,
      );
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        row.sha256,
        row.path,
      );
    }
  }
  const runtime = readFileSync(
    'apps/web/public/plugins/goodlayers-core/plugins/script.js',
    'utf8',
  );
  assert.ok(!runtime.includes('new Function("return/*@cc_on!@*/!1")'));
  assert.ok(!runtime.includes('eval("({"+d.data("options")+"})")'));
});
