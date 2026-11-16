import { parse, serialize } from 'parse5';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { format } from 'prettier';
const input = process.argv[2];
if (!input) throw Error('Provide a private directory of captured public HTML.');
const out = 'apps/web/src/published/pages';
await mkdir(out, { recursive: true });
await mkdir('apps/web/public/published-runtime', { recursive: true });
const manifest = [];
const urls = new Set();
const resourceMap = JSON.parse(
  await readFile('docs/published-reference-assets.json', 'utf8'),
);
function localize(value) {
  for (const r of resourceMap)
    if (!r.error && !r.url.startsWith('https://smokymountaincup.com/'))
      value = value.replaceAll(r.url, r.path);
  return value;
}
const base = 'https://smokymountaincup.com/';
function record(url) {
  try {
    const u = new URL(url, base);
    if (['http:', 'https:'].includes(u.protocol)) urls.add(u.href);
  } catch {}
}
function attrs(node) {
  return Object.fromEntries((node.attrs || []).map((a) => [a.name, a.value]));
}
for (const file of (await readdir(input))
  .filter((f) => f.endsWith('.html'))
  .sort()) {
  const raw = await readFile(join(input, file), 'utf8');
  const doc = parse(raw);
  let body, head;
  const scriptNodes = [],
    styleNodes = [];
  const resources = [];
  function visit(n) {
    const a = attrs(n);
    if (n.tagName === 'body') body = n;
    if (n.tagName === 'head') head = n;
    if (n.tagName === 'script') scriptNodes.push(n);
    if (n.tagName === 'style') styleNodes.push(n);
    if (n.tagName === 'link' && a.rel === 'stylesheet') {
      record(a.href);
      resources.push(a.href);
    }
    for (const key of ['src', 'data-lazyload', 'data-src', 'data-bg'])
      if (a[key] && /\.(png|jpe?g|webp|gif|svg|css|js)(?:[?#]|$)/i.test(a[key]))
        record(a[key]);
    if (
      n.tagName === 'a' &&
      /\.(png|jpe?g|webp|gif|svg)(?:[?#]|$)/i.test(a.href || '')
    )
      record(a.href);
    for (const m of (a.style || '').matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g))
      record(m[1]);
    for (const c of n.childNodes || []) visit(c);
  }
  visit(doc);
  if (!body || !head) throw Error('Invalid capture ' + file);
  const route = file === 'index.html' ? '/' : '/' + file.slice(0, -5);
  const slug = route === '/' ? 'index' : route.slice(1, -4);
  const scripts = [];
  let index = 0;
  for (const n of scriptNodes) {
    const a = attrs(n);
    let src = a.src;
    if (src) {
      record(src);
    } else {
      const code = (n.childNodes || []).map((c) => c.value || '').join('');
      if (!code.trim()) continue;
      src = '/published-runtime/' + slug + '-' + index++ + '.js';
      await writeFile('apps/web/public' + src, code);
    }
    scripts.push(src);
  }
  // Script execution is isolated in audited same-origin files, never from user/API HTML.
  function strip(n) {
    n.childNodes = (n.childNodes || []).filter((c) => c.tagName !== 'script');
    for (const c of n.childNodes) strip(c);
  }
  strip(body);
  const headStyles = styleNodes
    .filter((n) => {
      let p = n.parentNode;
      while (p) {
        if (p === head) return true;
        p = p.parentNode;
      }
      return false;
    })
    .map((n) => (n.childNodes || []).map((c) => c.value || '').join(''));
  const data = {
    route,
    title:
      raw.match(/<title>(.*?)<\/title>/s)?.[1] ||
      'Smoky Mountain Cup Tennessee',
    bodyAttributes: attrs(body),
    html: localize(serialize(body)),
    stylesheets: resources.map(localize),
    headStyles,
    scripts: scripts.map(localize),
  };
  await writeFile(join(out, slug + '.json'), JSON.stringify(data));
  manifest.push({
    route,
    sha256: createHash('sha256').update(raw).digest('hex'),
    bytes: Buffer.byteLength(raw),
    scripts: scripts.length,
  });
}
await writeFile(
  join(input, 'asset-urls.json'),
  JSON.stringify([...urls], null, 2),
);
await writeFile(
  join(input, 'captured-pages.json'),
  JSON.stringify(manifest, null, 2),
);
console.log(
  JSON.stringify({ pages: manifest.length, assetReferences: urls.size }),
);

const generated = (await readdir(out))
  .filter((name) => name.endsWith('.json'))
  .sort();
const registry =
  generated
    .map((name, i) => `import p${i} from './pages/${name}';`)
    .join('\n') +
  `\nexport interface PublishedPage {route:string;title:string;bodyAttributes:Record<string,string>;html:string;stylesheets:string[];headStyles:string[];scripts:string[];}\nexport const pages:Record<string,PublishedPage>={\n` +
  generated
    .map(
      (name, i) =>
        `  ${JSON.stringify(name === 'index.json' ? '/' : '/' + name.slice(0, -5) + '.php')}: p${i}`,
    )
    .join(',\n') +
  '\n};\n';
await writeFile(
  'apps/web/src/published/registry.ts',
  await format(registry, {
    parser: 'typescript',
    singleQuote: true,
    trailingComma: 'all',
  }),
);
