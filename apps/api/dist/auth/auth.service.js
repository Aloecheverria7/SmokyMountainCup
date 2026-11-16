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
exports.AuthService = exports.publicUser = exports.sessionHash = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const database_service_1 = require("../database/database.service");
const password_1 = require("./password");
const sessionHash = (token) => (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
exports.sessionHash = sessionHash;
const publicUser = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: !!u.active,
    mustChangePassword: !!u.must_change_password,
    version: u.version,
});
exports.publicUser = publicUser;
let AuthService = class AuthService {
    db;
    dummy = (0, password_1.passwordHash)((0, node_crypto_1.randomBytes)(32).toString('hex'));
    constructor(db) {
        this.db = db;
    }
    async login(email, password, oldToken) {
        const users = await this.db.query('SELECT * FROM smc_users WHERE email=?', [
            email.toLowerCase().trim(),
        ]);
        const account = users[0];
        const valid = await (0, password_1.passwordMatches)(account?.password_hash ?? (await this.dummy), password);
        if (!account || !account.active || !valid)
            throw new common_1.UnauthorizedException('Correo o contraseña incorrectos.');
        return this.db.transaction(async (tx) => {
            const [current] = await tx.query('SELECT * FROM smc_users WHERE id=? FOR UPDATE', [account.id]);
            if (!current?.active ||
                current.auth_version !== account.auth_version ||
                current.password_hash !== account.password_hash)
                throw new common_1.UnauthorizedException('Correo o contraseña incorrectos.');
            if (oldToken)
                await tx.query('DELETE FROM smc_sessions WHERE token_hash=?', [
                    (0, exports.sessionHash)(oldToken),
                ]);
            await tx.query('DELETE FROM smc_sessions WHERE user_id=? AND (expires_at<=UTC_TIMESTAMP(3) OR last_seen_at<=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 HOUR))', [current.id]);
            const token = await this.mint(tx, current);
            await (0, database_service_1.audit)(tx, current.id, 'auth.login', 'user', current.id);
            return { token, user: (0, exports.publicUser)(current) };
        });
    }
    async mint(tx, u) {
        const token = (0, node_crypto_1.randomBytes)(32).toString('hex');
        await tx.query('INSERT INTO smc_sessions(token_hash,user_id,auth_version,created_at,last_seen_at,expires_at) VALUES (?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 24 HOUR))', [(0, exports.sessionHash)(token), u.id, u.auth_version]);
        return token;
    }
    async resolve(token) {
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
            throw new common_1.UnauthorizedException('Inicia sesión.');
        const [account] = await this.db.query('SELECT u.* FROM smc_sessions s JOIN smc_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.auth_version=u.auth_version AND u.active=1 AND s.expires_at>UTC_TIMESTAMP(3) AND s.last_seen_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 HOUR)', [(0, exports.sessionHash)(token)]);
        if (!account)
            throw new common_1.UnauthorizedException('La sesión expiró. Inicia sesión.');
        await this.db.query('UPDATE smc_sessions SET last_seen_at=UTC_TIMESTAMP(3) WHERE token_hash=?', [(0, exports.sessionHash)(token)]);
        return (0, exports.publicUser)(account);
    }
    async logout(token, user) {
        await this.db.transaction(async (tx) => {
            await tx.query('DELETE FROM smc_sessions WHERE token_hash=?', [
                (0, exports.sessionHash)(token),
            ]);
            await (0, database_service_1.audit)(tx, user.id, 'auth.logout', 'user', user.id);
        });
    }
    async changePassword(user, currentPassword, newPassword) {
        (0, password_1.validatePassword)(newPassword);
        const [u] = await this.db.query('SELECT * FROM smc_users WHERE id=?', [
            user.id,
        ]);
        if (!u || !(await (0, password_1.passwordMatches)(u.password_hash, currentPassword)))
            throw new common_1.BadRequestException('La contraseña actual es incorrecta.');
        const hash = await (0, password_1.passwordHash)(newPassword);
        return this.db.transaction(async (tx) => {
            const [fresh] = await tx.query('SELECT * FROM smc_users WHERE id=? FOR UPDATE', [user.id]);
            if (!fresh?.active || fresh.auth_version !== u.auth_version)
                throw new common_1.UnauthorizedException('La sesión cambió. Inicia sesión.');
            await tx.query('UPDATE smc_users SET password_hash=?,must_change_password=0,auth_version=auth_version+1,version=version+1 WHERE id=?', [hash, user.id]);
            await tx.query('DELETE FROM smc_sessions WHERE user_id=?', [user.id]);
            fresh.auth_version++;
            fresh.version++;
            fresh.must_change_password = 0;
            const token = await this.mint(tx, fresh);
            await (0, database_service_1.audit)(tx, user.id, 'auth.password', 'user', user.id);
            return { token, user: (0, exports.publicUser)(fresh) };
        });
    }
    async createInitialAdmin(name, email, password) {
        (0, password_1.validatePassword)(password);
        const hash = await (0, password_1.passwordHash)(password);
        return this.db.transaction(async (tx) => {
            await tx.query('SELECT id FROM smc_mutex WHERE id=1 FOR UPDATE');
            const [existing] = await tx.query("SELECT id FROM smc_users WHERE role='admin' AND active=1 LIMIT 1");
            if (existing)
                throw new common_1.BadRequestException('Ya existe un administrador activo. Crea usuarios desde el panel.');
            const id = (0, node_crypto_1.randomUUID)();
            await tx.query("INSERT INTO smc_users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,'admin',UTC_TIMESTAMP(3))", [id, name, email.toLowerCase().trim(), hash]);
            await (0, database_service_1.audit)(tx, null, 'user.bootstrap', 'user', id);
            return id;
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_service_1.DatabaseService)),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AuthService);
