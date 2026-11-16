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
exports.CsrfGuard = exports.AdminGuard = exports.SessionGuard = void 0;
const common_1 = require("@nestjs/common");
const security_1 = require("../security");
const auth_service_1 = require("./auth.service");
let SessionGuard = class SessionGuard {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        req.principal = await this.auth.resolve(req.cookies?.cup_session);
        return true;
    }
};
exports.SessionGuard = SessionGuard;
exports.SessionGuard = SessionGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(auth_service_1.AuthService)),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], SessionGuard);
let AdminGuard = class AdminGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        if (req.principal.role !== 'admin')
            throw new common_1.ForbiddenException('Acceso reservado al administrador.');
        if (req.principal.mustChangePassword)
            throw new common_1.ForbiddenException('Cambia tu contraseña antes de continuar.');
        return true;
    }
};
exports.AdminGuard = AdminGuard;
exports.AdminGuard = AdminGuard = __decorate([
    (0, common_1.Injectable)()
], AdminGuard);
let CsrfGuard = class CsrfGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method))
            return true;
        if (req.get('origin') !== process.env.APP_ORIGIN ||
            !(0, security_1.validCsrf)(process.env.CSRF_SECRET, req.get('x-csrf-token'), req.cookies?.cup_csrf))
            throw new common_1.ForbiddenException('La sesión cambió. Recarga y vuelve a intentarlo.');
        return true;
    }
};
exports.CsrfGuard = CsrfGuard;
exports.CsrfGuard = CsrfGuard = __decorate([
    (0, common_1.Injectable)()
], CsrfGuard);
