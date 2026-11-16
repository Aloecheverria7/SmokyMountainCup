import type { INestApplication } from '@nestjs/common';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  static as serveStatic,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
const pages = new Set([
  '/',
  '/index.php',
  '/schedule.php',
  '/games-details.php',
  '/games-results.php',
  '/games-boxScores.php',
  '/games-calendar.php',
  '/games-list.php',
  '/games-blocks.php',
  '/blog.php',
  '/leaguetable.php',
  '/player-details.php',
  '/player-gallery.php',
  '/player-list.php',
  '/player-statics.php',
  '/about.php',
  '/gallery.php',
  '/contact.php',
  '/thank-you.php',
  '/sorry.php',
  '/message-error',
  '/tournament.php',
  '/match.php',
]);
export function hostingOptions(env = process.env) {
  const host = env.LISTEN_HOST || '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0', '::1', '::'].includes(host))
    throw Error('LISTEN_HOST inválido.');
  const proxy = env.TRUST_PROXY_HOPS || '0';
  if (!/^[0-5]$/.test(proxy))
    throw Error('TRUST_PROXY_HOPS debe ser un entero entre 0 y 5.');
  if (env.SERVE_WEB && !['0', '1'].includes(env.SERVE_WEB))
    throw Error('SERVE_WEB debe ser 0 o 1.');
  return { host, proxy: Number(proxy), serveWeb: env.SERVE_WEB === '1' };
}
export async function mountWeb(app: INestApplication) {
  const root = resolve(__dirname, '../../web/dist');
  if (!(await stat(resolve(root, 'index.html'))).isFile())
    throw Error('Falta el build de React. Ejecuta npm run build.');
  app.use(
    serveStatic(root, {
      index: false,
      dotfiles: 'deny',
      redirect: false,
      maxAge: 0,
    }),
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      ['GET', 'HEAD'].includes(req.method) &&
      (pages.has(req.path) || /^\/admin(?:\/|$)/.test(req.path))
    ) {
      res.setHeader('Cache-Control', 'no-store');
      return res.sendFile(resolve(root, 'index.html'));
    }
    next();
  });
}
