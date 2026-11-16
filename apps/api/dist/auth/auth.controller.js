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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const guards_1 = require("./guards");
const dto_1 = require("./dto");
const security_1 = require("../security");
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    cookies(res, token) {
        res.cookie('cup_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/api',
            maxAge: 86400000,
        });
        res.cookie('cup_csrf', (0, security_1.createCsrf)(process.env.CSRF_SECRET), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api',
            maxAge: 3600000,
        });
        res.setHeader('Cache-Control', 'no-store');
    }
    async login(req, res) {
        const dto = (0, dto_1.parseDto)(dto_1.LoginDto, req.body);
        const result = await this.auth.login(dto.email, dto.password, req.cookies?.cup_session);
        this.cookies(res, result.token);
        return { data: result.user };
    }
    me(req, res) {
        res.setHeader('Cache-Control', 'no-store');
        return { data: req.principal };
    }
    async logout(req, res) {
        await this.auth.logout(req.cookies.cup_session, req.principal);
        res.clearCookie('cup_session', {
            path: '/api',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });
        res.setHeader('Cache-Control', 'no-store');
    }
    async password(req, res) {
        const dto = (0, dto_1.parseDto)(dto_1.PasswordDto, req.body);
        const result = await this.auth.changePassword(req.principal, dto.currentPassword, dto.newPassword);
        this.cookies(res, result.token);
        return { data: result.user };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(guards_1.CsrfGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(guards_1.SessionGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(204),
    (0, common_1.UseGuards)(guards_1.SessionGuard, guards_1.CsrfGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('password'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(guards_1.SessionGuard, guards_1.CsrfGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "password", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('api/v1/auth'),
    __param(0, (0, common_1.Inject)(auth_service_1.AuthService)),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
