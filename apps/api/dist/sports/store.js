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
exports.SportsStore = void 0;
exports.need = need;
exports.version = version;
exports.json = json;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const rules_1 = require("./rules");
function need(condition, message) {
    if (!condition)
        throw new common_1.UnprocessableEntityException(message);
}
function version(row, expected) {
    if (row.version !== expected)
        throw new common_1.ConflictException({
            code: 'VERSION_CONFLICT',
            message: 'El registro cambió. Actualiza antes de guardar.',
            currentVersion: row.version,
        });
}
function json(value) {
    return typeof value === 'string' ? JSON.parse(value) : value;
}
let SportsStore = class SportsStore {
    db;
    constructor(db) {
        this.db = db;
    }
    async write(actor, admin, fn) {
        return this.db.transaction(async (tx) => {
            await tx.query('SELECT id FROM smc_mutex WHERE id=1 FOR UPDATE');
            const [u] = await tx.query('SELECT * FROM smc_users WHERE id=?', [
                actor.id,
            ]);
            if (!u?.active ||
                u.version !== actor.version ||
                u.must_change_password ||
                (admin && u.role !== 'admin'))
                throw new common_1.ForbiddenException('Tu sesión o permisos cambiaron. Inicia sesión.');
            return fn(tx);
        });
    }
    async operation(actor, admin, action, id, key, body, authorize, fn) {
        if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(key))
            throw new common_1.UnprocessableEntityException('Se requiere una clave de operación válida.');
        return this.write(actor, admin, async (tx) => {
            await authorize(tx);
            const hash = (0, rules_1.fingerprint)({ action, id, body });
            const [old] = await tx.query('SELECT * FROM smc_operations WHERE request_key=?', [key]);
            if (old) {
                if (old.actor_id !== actor.id ||
                    old.payload_hash !== hash ||
                    old.action !== action ||
                    old.aggregate_id !== id)
                    throw new common_1.ConflictException('La clave de operación ya se utilizó con otros datos.');
                return json(old.response);
            }
            const response = await fn(tx);
            await tx.query('INSERT INTO smc_operations(request_key,actor_id,action,aggregate_id,payload_hash,response,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(3))', [key, actor.id, action, id, hash, JSON.stringify(response)]);
            await (0, database_service_1.audit)(tx, actor.id, action, 'sports', id, body);
            return response;
        });
    }
    async competition(tx, id, editable = false) {
        const [c] = await tx.query("SELECT c.*,s.archived,s.active,s.timezone,s.name AS season_name,k.name AS category,(SELECT b.id FROM smc_import_batches b WHERE b.season_id=c.season_id AND b.status='promoted' LIMIT 1) AS import_batch_id FROM smc_competitions c JOIN smc_seasons s ON s.id=c.season_id JOIN smc_categories k ON k.id=c.category_id WHERE c.id=? FOR UPDATE", [id]);
        if (!c)
            throw new common_1.NotFoundException('Competición no encontrada.');
        if (editable)
            need(!c.archived, 'La temporada está archivada.');
        return c;
    }
    async match(tx, id) {
        const [m] = await tx.query('SELECT * FROM smc_matches WHERE id=? FOR UPDATE', [id]);
        if (!m)
            throw new common_1.NotFoundException('Partido no encontrado.');
        return m;
    }
    async matchPermission(tx, id, actor) {
        const m = await this.match(tx, id);
        if (actor.role !== 'admin') {
            const [a] = await tx.query('SELECT match_id FROM smc_assignments WHERE match_id=? AND user_id=?', [id, actor.id]);
            if (!a)
                throw new common_1.ForbiddenException('No tienes asignado este partido.');
        }
        return m;
    }
};
exports.SportsStore = SportsStore;
exports.SportsStore = SportsStore = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_service_1.DatabaseService)),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], SportsStore);
