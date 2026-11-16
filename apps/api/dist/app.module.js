"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const nodemailer_1 = __importDefault(require("nodemailer"));
const security_1 = require("./security");
const database_service_1 = require("./database/database.service");
const legacy_service_1 = require("./legacy.service");
const controllers_1 = require("./sports/controllers");
const public_service_1 = require("./sports/public.service");
const auth_module_1 = require("./auth/auth.module");
const admin_controller_1 = require("./admin/admin.controller");
class Inquiry {
    kind;
    email;
    name;
    team_name;
    owner;
    phone;
    message;
    players_to_enroll;
    product;
    website;
    csrf;
}
__decorate([
    (0, class_validator_1.IsIn)(['contact', 'registration', 'vendor']),
    __metadata("design:type", String)
], Inquiry.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], Inquiry.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], Inquiry.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], Inquiry.prototype, "team_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], Inquiry.prototype, "owner", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], Inquiry.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(6000),
    __metadata("design:type", String)
], Inquiry.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(6000),
    __metadata("design:type", String)
], Inquiry.prototype, "players_to_enroll", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(6000),
    __metadata("design:type", String)
], Inquiry.prototype, "product", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], Inquiry.prototype, "website", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], Inquiry.prototype, "csrf", void 0);
let PublicController = class PublicController {
    legacy;
    db;
    sports;
    constructor(legacy, db, sports) {
        this.legacy = legacy;
        this.db = db;
        this.sports = sports;
    }
    health() {
        return { status: 'ok', stage: 'foundation' };
    }
    async ready() {
        try {
            const rows = await this.db.query('SELECT name FROM smc_migrations');
            if (![
                'Foundation1794225600000',
                'Sports1794225700000',
                'Imports1794225800000',
            ].every((name) => rows.some((r) => r.name === name)))
                throw Error();
            return { status: 'ready' };
        }
        catch {
            throw new common_1.ServiceUnavailableException('El sistema todavía no está preparado.');
        }
    }
    async live(res) {
        res.setHeader('Cache-Control', 'no-store');
        return process.env.PUBLIC_DATA_SOURCE === 'system'
            ? this.sports.feed()
            : this.legacy.feed();
    }
    csrf(res) {
        const token = (0, security_1.createCsrf)(process.env.CSRF_SECRET);
        res.setHeader('Cache-Control', 'no-store');
        res.cookie('cup_csrf', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api',
            maxAge: 3600000,
        });
        return { token };
    }
    async inquiry(req) {
        if (req.get('origin') !== process.env.APP_ORIGIN ||
            !(0, security_1.validCsrf)(process.env.CSRF_SECRET, req.get('x-csrf-token'), req.cookies?.cup_csrf))
            throw new common_1.ForbiddenException('Your session expired. Reload the form and try again.');
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
            throw new common_1.BadRequestException('Invalid submission.');
        const dto = (0, class_transformer_1.plainToInstance)(Inquiry, req.body);
        if ((0, class_validator_1.validateSync)(dto, { whitelist: true, forbidNonWhitelisted: true })
            .length ||
            dto.website)
            throw new common_1.BadRequestException('Invalid submission.');
        const fields = dto.kind === 'registration'
            ? ['team_name', 'owner', 'email', 'phone', 'players_to_enroll']
            : dto.kind === 'vendor'
                ? ['name', 'email', 'phone']
                : ['name', 'email', 'message'];
        for (const key of fields) {
            const v = dto[key];
            if (typeof v !== 'string' || !v.trim())
                throw new common_1.BadRequestException('Please complete all required fields.');
        }
        if (!process.env.SMTP_HOST || !process.env.MAIL_FROM)
            throw new common_1.ServiceUnavailableException('Your message could not be sent. Please contact smokymountaincup@yahoo.com or try again later.');
        const transport = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_PORT === '465',
            requireTLS: true,
            auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
                : undefined,
            connectionTimeout: 10000,
            socketTimeout: 15000,
        });
        try {
            const result = await transport.sendMail({
                from: process.env.MAIL_FROM,
                to: process.env.MAIL_TO || 'smokymountaincup@yahoo.com',
                replyTo: dto.email,
                subject: `Smoky Mountain Cup: ${dto.kind}`,
                text: `Smoky Mountain Cup — ${dto.kind}\n\n` +
                    (dto.kind === 'vendor' ? [...fields, 'product'] : fields)
                        .map((k) => `${k}:\n${dto[k] ?? ''}\n`)
                        .join('\n'),
            });
            if (!result.accepted.length)
                throw Error();
            return { ok: true };
        }
        catch {
            throw new common_1.ServiceUnavailableException('Your message could not be sent. Please contact smokymountaincup@yahoo.com or try again later.');
        }
        finally {
            transport.close();
        }
    }
};
__decorate([
    (0, common_1.Get)('health/live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicController.prototype, "health", null);
__decorate([
    (0, common_1.Get)('health/ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PublicController.prototype, "ready", null);
__decorate([
    (0, common_1.Get)('public/live'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PublicController.prototype, "live", null);
__decorate([
    (0, common_1.Get)('auth/csrf'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PublicController.prototype, "csrf", null);
__decorate([
    (0, common_1.Post)('public/inquiries'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PublicController.prototype, "inquiry", null);
PublicController = __decorate([
    (0, common_1.Controller)('api/v1'),
    __param(0, (0, common_1.Inject)(legacy_service_1.LegacyService)),
    __param(1, (0, common_1.Inject)(database_service_1.DatabaseService)),
    __param(2, (0, common_1.Inject)(public_service_1.PublicSportsService)),
    __metadata("design:paramtypes", [legacy_service_1.LegacyService,
        database_service_1.DatabaseService,
        public_service_1.PublicSportsService])
], PublicController);
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, admin_controller_1.AdminModule, controllers_1.SportsModule],
        controllers: [PublicController],
        providers: [legacy_service_1.LegacyService],
    })
], AppModule);
