"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hostingOptions = hostingOptions;
exports.mountWeb = mountWeb;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const express_1 = require("express");
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
function hostingOptions(env = process.env) {
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
async function mountWeb(app) {
    const root = (0, node_path_1.resolve)(__dirname, '../../web/dist');
    if (!(await (0, promises_1.stat)((0, node_path_1.resolve)(root, 'index.html'))).isFile())
        throw Error('Falta el build de React. Ejecuta npm run build.');
    app.use((0, express_1.static)(root, {
        index: false,
        dotfiles: 'deny',
        redirect: false,
        maxAge: 0,
    }));
    app.use((req, res, next) => {
        if (['GET', 'HEAD'].includes(req.method) &&
            (pages.has(req.path) || /^\/admin(?:\/|$)/.test(req.path))) {
            res.setHeader('Cache-Control', 'no-store');
            return res.sendFile((0, node_path_1.resolve)(root, 'index.html'));
        }
        next();
    });
}
