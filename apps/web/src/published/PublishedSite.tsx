import parse, {
  attributesToProps,
  domToReact,
  Element,
  type DOMNode,
  type HTMLReactParserOptions,
} from 'html-react-parser';
import { createElement, useLayoutEffect, useMemo } from 'react';
import { pages, type PublishedPage } from './registry';
import { PublishedSportsProvider, sportsReplacement } from './PublishedSports';
export const isPublishedPath = (path: string) =>
  path === '/' || path === '/index.php' || Object.hasOwn(pages, path);
function loadScript(src: string) {
  return new Promise<void>((resolve) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    s.dataset.published = 'true';
    document.body.append(s);
  });
}
function loadStyle(href: string) {
  return new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.published = 'true';
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.append(link);
  });
}
export function PublishedSite() {
  const page: PublishedPage =
    pages[
      location.pathname === '/' || location.pathname === '/index.php'
        ? '/'
        : location.pathname
    ];
  const markup = useMemo(() => {
    const counters: Record<string, number> = {};
    const selectors: Record<string, number> = {};
    const options: HTMLReactParserOptions = {
      replace(node) {
        if (!(node instanceof Element)) return;
        const selector =
          node.name +
          (node.attribs.class
            ?.trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((c) => '.' + c)
            .join('') ?? '');
        const index = selectors[selector] ?? 0;
        selectors[selector] = index + 1;
        const bound = sportsReplacement(node, page.route, counters);
        if (bound !== undefined)
          return (
            <span
              data-smc-selector={selector}
              data-smc-index={index}
              style={{ display: 'contents' }}
            >
              {bound}
            </span>
          );
        delete node.attribs.onclick;
        delete node.attribs.onsubmit;
        if (node.attribs.style?.includes('!important')) {
          const css = node.attribs.style;
          return createElement(
            node.name,
            {
              ...attributesToProps(node.attribs),
              ref: (element: HTMLElement | null) => {
                element?.setAttribute('style', css);
              },
            },
            node.children.length
              ? domToReact(node.children as DOMNode[], options)
              : undefined,
          );
        }
      },
    };
    return parse(page.html, options);
  }, [page]);
  useLayoutEffect(() => {
    const old = document.querySelector<HTMLLinkElement>(
      'link[href="/css/cup.css"]',
    );
    if (old) old.disabled = true;
    document.title = page.title;
    for (const [name, value] of Object.entries(page.bodyAttributes))
      document.body.setAttribute(name, value);
    document.documentElement.style.scrollBehavior = '';
    let mounted = true;
    const styles = page.stylesheets.map(loadStyle);
    for (const css of page.headStyles) {
      const s = document.createElement('style');
      s.dataset.published = 'true';
      s.textContent = css;
      document.head.append(s);
    }
    async function start() {
      await Promise.all(styles);
      for (const src of page.scripts) {
        if (!mounted) return;
        await loadScript(src);
        if (
          new URL(src, location.href).pathname.endsWith('/js/jquery/jquery.js')
        )
          (window as any).jQuery?.holdReady(true);
      }
      await document.fonts.ready;
      if (mounted) {
        (window as any).jQuery?.holdReady(false);
        window.dispatchEvent(new Event('load'));
        document.documentElement.dataset.publishedReady = 'true';
        window.dispatchEvent(new Event('smc-published-ready'));
      }
    }
    void start();
    async function submit(event: Event) {
      const form = event.target;
      if (
        !(form instanceof HTMLFormElement) ||
        form.method.toLowerCase() !== 'post'
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const action = form.getAttribute('action') || '';
      const kind = action.includes('inscription')
        ? 'registration'
        : action.includes('seller')
          ? 'vendor'
          : action.includes('mail.php')
            ? 'contact'
            : 'newsletter';
      if (kind === 'newsletter') {
        location.href = location.pathname + location.search;
        return;
      }
      const fields =
        kind === 'registration'
          ? ['team_name', 'owner', 'email', 'phone', 'players_to_enroll']
          : kind === 'vendor'
            ? ['name', 'email', 'phone', 'product']
            : ['name', 'email', 'message'];
      const body: Record<string, string> = { kind };
      for (const key of fields) body[key] = String(data.get(key) || '');
      const buttons = form.querySelectorAll<
        HTMLInputElement | HTMLButtonElement
      >('[type="submit"],button');
      buttons.forEach((b) => (b.disabled = true));
      try {
        const csrf = await fetch('/api/v1/auth/csrf');
        if (!csrf.ok) throw Error();
        const token = (await csrf.json()).token;
        const r = await fetch('/api/v1/public/inquiries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token,
          },
          body: JSON.stringify(body),
        });
        location.href = r.ok ? '/thank-you.php' : '/sorry.php';
      } catch {
        location.href = '/sorry.php';
      }
    }
    window.addEventListener('submit', submit, true);
    return () => {
      mounted = false;
      window.removeEventListener('submit', submit, true);
      document
        .querySelectorAll('[data-published="true"]')
        .forEach((e) => e.remove());
      if (old) old.disabled = false;
    };
  }, [page]);
  return <PublishedSportsProvider>{markup}</PublishedSportsProvider>;
}
