"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = require("express-rate-limit");
const web_hosting_1 = require("./web-hosting");
const app_module_1 = require("./app.module");
const database_errors_filter_1 = require("./database/database-errors.filter");
async function bootstrap() {
    if (!process.env.CSRF_SECRET || process.env.CSRF_SECRET.length < 32)
        throw new Error('Configure CSRF_SECRET with at least 32 random characters.');
    if (!process.env.APP_ORIGIN)
        throw new Error('Configure APP_ORIGIN.');
    if (process.env.PUBLIC_DATA_SOURCE &&
        !['legacy', 'system'].includes(process.env.PUBLIC_DATA_SOURCE))
        throw new Error('PUBLIC_DATA_SOURCE must be legacy or system.');
    const hosting = (0, web_hosting_1.hostingOptions)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    app.getHttpAdapter().getInstance().set('trust proxy', hosting.proxy);
    const { json } = await Promise.resolve().then(() => __importStar(require('express')));
    app.useGlobalFilters(new database_errors_filter_1.DatabaseErrorsFilter());
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                frameSrc: [
                    "'self'",
                    'https://www.facebook.com',
                    'https://www.youtube.com',
                    'https://www.google.com',
                ],
            },
        },
    }));
    app.use(json({ limit: '32kb' }));
    app.use((0, cookie_parser_1.default)());
    app.use('/api/v1', (_req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
    });
    app.use('/api/v1/auth/login', (0, express_rate_limit_1.rateLimit)({
        windowMs: 900000,
        limit: 20,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { message: 'Demasiados intentos. Espera quince minutos.' },
    }));
    app.use('/api/v1/public/inquiries', (0, express_rate_limit_1.rateLimit)({
        windowMs: 3600000,
        limit: 5,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { message: 'Please wait before sending another message.' },
    }));
    if (hosting.serveWeb)
        await (0, web_hosting_1.mountWeb)(app);
    app.enableShutdownHooks();
    await app.listen(Number(process.env.PORT || 3000), hosting.host);
}
void bootstrap();
