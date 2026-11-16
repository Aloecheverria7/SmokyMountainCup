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
exports.AdminService = exports.teamDto = exports.seasonDto = void 0;
exports.assertVersion = assertVersion;
exports.pageParams = pageParams;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const class_validator_1 = require("class-validator");
const database_service_1 = require("../database/database.service");
const auth_service_1 = require("../auth/auth.service");
const password_1 = require("../auth/password");
function assertVersion(row, version) {
    if (row.version !== version)
        throw new common_1.ConflictException({
            code: 'VERSION_CONFLICT',
            message: 'El registro cambió. Actualiza antes de guardar.',
            currentVersion: row.version,
        });
}
function checkTimezone(value) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
    }
    catch {
        throw new common_1.UnprocessableEntityException('Zona horaria inválida.');
    }
}
function pageParams(query) {
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    if (!Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        (query.cursor !== undefined &&
            (typeof query.cursor !== 'string' || !(0, class_validator_1.isUUID)(query.cursor, '4'))))
        throw new common_1.UnprocessableEntityException('Paginación inválida.');
    return { limit, cursor: query.cursor };
}
function page(rows, limit, map = (r) => r) {
    const more = rows.length > limit;
    const visible = rows.slice(0, limit);
    return {
        data: visible.map(map),
        page: { nextCursor: more ? visible.at(-1).id : null },
    };
}
const seasonDto = (s) => ({
    id: s.id,
    name: s.name,
    timezone: s.timezone,
    active: !!s.active,
    archived: !!s.archived,
    version: s.version,
});
exports.seasonDto = seasonDto;
const teamDto = (s) => ({
    id: s.id,
    name: s.name,
    archived: !!s.archived,
    version: s.version,
});
exports.teamDto = teamDto;
let AdminService = class AdminService {
    db;
    constructor(db) {
        this.db = db;
    }
    async write(actor, fn) {
        return this.db.transaction(async (tx) => {
            await tx.query('SELECT id FROM smc_mutex WHERE id=1 FOR UPDATE');
            const [user] = await tx.query('SELECT role,active,must_change_password,version FROM smc_users WHERE id=?', [actor.id]);
            if (!user?.active ||
                user.role !== 'admin' ||
                user.must_change_password ||
                user.version !== actor.version)
                throw new common_1.ForbiddenException('Acceso reservado al administrador.');
            return fn(tx);
        });
    }
    async record(tx, table, id) {
        const [row] = await tx.query(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`, [id]);
        if (!row)
            throw new common_1.NotFoundException('Registro no encontrado.');
        return row;
    }
    async editableCompetition(tx, id) {
        const c = await this.record(tx, 'smc_competitions', id);
        const s = await this.record(tx, 'smc_seasons', c.season_id);
        if (s.archived)
            throw new common_1.UnprocessableEntityException('La temporada está archivada.');
        if (c.published)
            throw new common_1.UnprocessableEntityException('Retira el sorteo antes de modificar la competición.');
        return c;
    }
    async seasons(query) {
        const { limit, cursor } = pageParams(query);
        return page(await this.db.query('SELECT * FROM smc_seasons WHERE (? IS NULL OR id>?) ORDER BY id LIMIT ?', [cursor ?? null, cursor ?? null, limit + 1]), limit, exports.seasonDto);
    }
    async createSeason(actor, d) {
        checkTimezone(d.timezone);
        return this.write(actor, async (tx) => {
            const id = (0, node_crypto_1.randomUUID)();
            await tx.query('INSERT INTO smc_seasons(id,name,timezone,created_at) VALUES (?,?,?,UTC_TIMESTAMP(3))', [id, d.name, d.timezone]);
            const categories = await tx.query('SELECT * FROM smc_categories ORDER BY slug');
            if (categories.length !== 4)
                throw new common_1.ConflictException('El catálogo de competiciones está incompleto.');
            for (const category of categories) {
                const cid = (0, node_crypto_1.randomUUID)();
                await tx.query('INSERT INTO smc_competitions(id,season_id,category_id) VALUES (?,?,?)', [cid, id, category.id]);
                for (const name of ['A', 'B'])
                    await tx.query('INSERT INTO smc_groups(id,competition_id,name) VALUES (?,?,?)', [(0, node_crypto_1.randomUUID)(), cid, name]);
            }
            await (0, database_service_1.audit)(tx, actor.id, 'season.create', 'season', id, {
                name: d.name,
                timezone: d.timezone,
            });
            return { data: (0, exports.seasonDto)(await this.record(tx, 'smc_seasons', id)) };
        });
    }
    async editSeason(actor, id, d) {
        if (d.timezone)
            checkTimezone(d.timezone);
        return this.write(actor, async (tx) => {
            const s = await this.record(tx, 'smc_seasons', id);
            assertVersion(s, d.expectedVersion);
            if (s.archived)
                throw new common_1.UnprocessableEntityException('La temporada está archivada.');
            await tx.query('UPDATE smc_seasons SET name=?,timezone=?,version=version+1 WHERE id=?', [d.name ?? s.name, d.timezone ?? s.timezone, id]);
            await (0, database_service_1.audit)(tx, actor.id, 'season.edit', 'season', id, {
                name: d.name,
                timezone: d.timezone,
            });
            return { data: (0, exports.seasonDto)(await this.record(tx, 'smc_seasons', id)) };
        });
    }
    async activateSeason(actor, id, version) {
        return this.write(actor, async (tx) => {
            const s = await this.record(tx, 'smc_seasons', id);
            assertVersion(s, version);
            if (s.archived)
                throw new common_1.UnprocessableEntityException('Una temporada archivada no puede activarse.');
            await tx.query('UPDATE smc_seasons SET active=0,version=version+1 WHERE active=1 AND id<>?', [id]);
            await tx.query('UPDATE smc_seasons SET active=1,version=version+1 WHERE id=?', [id]);
            await (0, database_service_1.audit)(tx, actor.id, 'season.activate', 'season', id);
            return { data: (0, exports.seasonDto)(await this.record(tx, 'smc_seasons', id)) };
        });
    }
    async archiveSeason(actor, id, version) {
        return this.write(actor, async (tx) => {
            const s = await this.record(tx, 'smc_seasons', id);
            assertVersion(s, version);
            if (s.archived)
                throw new common_1.UnprocessableEntityException('La temporada ya está archivada.');
            const [unfinished] = await tx.query('SELECT m.id FROM smc_matches m JOIN smc_competitions c ON c.id=m.competition_id WHERE c.season_id=? AND (m.status<>? OR m.confirmed=0) LIMIT 1', [id, 'finished']);
            if (unfinished)
                throw new common_1.UnprocessableEntityException('Finaliza y confirma los partidos antes de archivar la temporada.');
            await tx.query('UPDATE smc_seasons SET active=0,archived=1,version=version+1 WHERE id=?', [id]);
            await (0, database_service_1.audit)(tx, actor.id, 'season.archive', 'season', id);
            return { data: (0, exports.seasonDto)(await this.record(tx, 'smc_seasons', id)) };
        });
    }
    async competitions(seasonId) {
        const rows = await this.db.query("SELECT c.*,k.name,k.slug,s.archived FROM smc_competitions c JOIN smc_categories k ON k.id=c.category_id JOIN smc_seasons s ON s.id=c.season_id WHERE c.season_id=? ORDER BY FIELD(k.slug,'infantil','junior','adulto','femenino')", [seasonId]);
        const groups = await this.db.query('SELECT g.* FROM smc_groups g JOIN smc_competitions c ON c.id=g.competition_id WHERE c.season_id=? ORDER BY g.name', [seasonId]);
        return {
            data: rows.map((c) => ({
                id: c.id,
                seasonId: c.season_id,
                name: c.name,
                slug: c.slug,
                format: c.format,
                groupCount: c.group_count,
                duration: c.duration,
                winPoints: c.win_points,
                drawPoints: c.draw_points,
                lossPoints: c.loss_points,
                groupCapacity: c.group_capacity,
                qualifiers: c.qualifiers,
                rulesConfirmed: !!c.rules_confirmed,
                published: !!c.published,
                archived: !!c.archived,
                version: c.version,
                groups: groups
                    .filter((g) => g.competition_id === c.id)
                    .map((g) => ({ id: g.id, name: g.name })),
            })),
        };
    }
    async rules(actor, id, d) {
        if (d.qualifiers >= d.groupCapacity)
            throw new common_1.UnprocessableEntityException('Deben clasificar menos equipos que la capacidad del grupo.');
        return this.write(actor, async (tx) => {
            const c = await this.editableCompetition(tx, id);
            assertVersion(c, d.expectedVersion);
            const [count] = await tx.query('SELECT COUNT(*) AS n FROM smc_entries WHERE competition_id=?', [id]);
            if (Number(count.n) > d.groupCapacity * 2)
                throw new common_1.UnprocessableEntityException('La capacidad no admite todos los equipos inscritos.');
            await tx.query('UPDATE smc_competitions SET duration=?,win_points=?,draw_points=?,loss_points=?,group_capacity=?,qualifiers=?,rules_confirmed=?,version=version+1 WHERE id=?', [
                d.duration,
                d.winPoints,
                d.drawPoints,
                d.lossPoints,
                d.groupCapacity,
                d.qualifiers,
                d.rulesConfirmed,
                id,
            ]);
            await (0, database_service_1.audit)(tx, actor.id, 'competition.rules', 'competition', id, {
                ...d,
            });
            return { data: { id, version: c.version + 1 } };
        });
    }
    async teams(query) {
        const { limit, cursor } = pageParams(query);
        return page(await this.db.query('SELECT * FROM smc_teams WHERE (? IS NULL OR id>?) ORDER BY id LIMIT ?', [cursor ?? null, cursor ?? null, limit + 1]), limit, exports.teamDto);
    }
    async createTeam(actor, name) {
        return this.write(actor, async (tx) => {
            const id = (0, node_crypto_1.randomUUID)();
            await tx.query('INSERT INTO smc_teams(id,name,created_at) VALUES (?,?,UTC_TIMESTAMP(3))', [id, name]);
            await (0, database_service_1.audit)(tx, actor.id, 'team.create', 'team', id, { name });
            return { data: (0, exports.teamDto)(await this.record(tx, 'smc_teams', id)) };
        });
    }
    async editTeam(actor, id, name, version) {
        return this.write(actor, async (tx) => {
            const team = await this.record(tx, 'smc_teams', id);
            assertVersion(team, version);
            if (team.archived)
                throw new common_1.UnprocessableEntityException('El equipo está archivado.');
            await tx.query('UPDATE smc_teams SET name=?,version=version+1 WHERE id=?', [name, id]);
            await (0, database_service_1.audit)(tx, actor.id, 'team.edit', 'team', id, { name });
            return { data: (0, exports.teamDto)(await this.record(tx, 'smc_teams', id)) };
        });
    }
    async archiveTeam(actor, id, version) {
        return this.write(actor, async (tx) => {
            const team = await this.record(tx, 'smc_teams', id);
            assertVersion(team, version);
            await tx.query('UPDATE smc_teams SET archived=1,version=version+1 WHERE id=?', [id]);
            await (0, database_service_1.audit)(tx, actor.id, 'team.archive', 'team', id);
            return { data: (0, exports.teamDto)(await this.record(tx, 'smc_teams', id)) };
        });
    }
    async entries(competitionId, query) {
        const { limit, cursor } = pageParams(query);
        return page(await this.db.query('SELECT e.id,e.competition_id AS competitionId,e.team_id AS teamId,t.name FROM smc_entries e JOIN smc_teams t ON t.id=e.team_id WHERE e.competition_id=? AND (? IS NULL OR e.id>?) ORDER BY e.id LIMIT ?', [competitionId, cursor ?? null, cursor ?? null, limit + 1]), limit);
    }
    async createEntry(actor, competitionId, teamId) {
        return this.write(actor, async (tx) => {
            const c = await this.editableCompetition(tx, competitionId);
            const team = await this.record(tx, 'smc_teams', teamId);
            if (team.archived)
                throw new common_1.UnprocessableEntityException('El equipo está archivado.');
            const [duplicate] = await tx.query('SELECT id FROM smc_entries WHERE competition_id=? AND team_id=?', [competitionId, teamId]);
            if (duplicate)
                throw new common_1.ConflictException('El equipo ya está inscrito en esta competición.');
            const [count] = await tx.query('SELECT COUNT(*) AS n FROM smc_entries WHERE competition_id=?', [competitionId]);
            if (count.n >= c.group_count * c.group_capacity)
                throw new common_1.UnprocessableEntityException('La competición alcanzó su capacidad.');
            const id = (0, node_crypto_1.randomUUID)();
            await tx.query('INSERT INTO smc_entries(id,competition_id,team_id,created_at) VALUES (?,?,?,UTC_TIMESTAMP(3))', [id, competitionId, teamId]);
            await (0, database_service_1.audit)(tx, actor.id, 'entry.create', 'entry', id, {
                competitionId,
                teamId,
            });
            return { data: { id, competitionId, teamId, name: team.name } };
        });
    }
    async users(query) {
        const { limit, cursor } = pageParams(query);
        return page(await this.db.query('SELECT id,name,email,role,active,must_change_password,version FROM smc_users WHERE (? IS NULL OR id>?) ORDER BY id LIMIT ?', [cursor ?? null, cursor ?? null, limit + 1]), limit, auth_service_1.publicUser);
    }
    async createUser(actor, d) {
        const hash = await (0, password_1.passwordHash)(d.password);
        return this.write(actor, async (tx) => {
            const [existing] = await tx.query('SELECT id FROM smc_users WHERE email=?', [d.email.toLowerCase()]);
            if (existing)
                throw new common_1.ConflictException('Ese correo ya está registrado.');
            const id = (0, node_crypto_1.randomUUID)();
            await tx.query('INSERT INTO smc_users(id,name,email,password_hash,role,must_change_password,created_at) VALUES (?,?,?,?,?,1,UTC_TIMESTAMP(3))', [id, d.name, d.email.toLowerCase(), hash, d.role]);
            await (0, database_service_1.audit)(tx, actor.id, 'user.create', 'user', id, { role: d.role });
            return { data: (0, auth_service_1.publicUser)(await this.record(tx, 'smc_users', id)) };
        });
    }
    async editUser(actor, id, d) {
        return this.write(actor, async (tx) => {
            const u = await this.record(tx, 'smc_users', id);
            assertVersion(u, d.expectedVersion);
            const role = d.role ?? u.role, active = d.active ?? !!u.active;
            if (id === actor.id && (!active || role !== 'admin'))
                throw new common_1.UnprocessableEntityException('No puedes desactivar ni quitar permisos a tu propia cuenta.');
            const [count] = await tx.query("SELECT COUNT(*) AS n FROM smc_users WHERE role='admin' AND active=1");
            if (u.role === 'admin' &&
                u.active &&
                (!active || role !== 'admin') &&
                Number(count.n) <= 1)
                throw new common_1.UnprocessableEntityException('Debe existir un administrador activo.');
            if (d.email) {
                const [other] = await tx.query('SELECT id FROM smc_users WHERE email=? AND id<>?', [d.email.toLowerCase(), id]);
                if (other)
                    throw new common_1.ConflictException('Ese correo ya está registrado.');
            }
            await tx.query('UPDATE smc_users SET name=?,email=?,role=?,active=?,auth_version=auth_version+1,version=version+1 WHERE id=?', [d.name ?? u.name, d.email?.toLowerCase() ?? u.email, role, active, id]);
            await tx.query('DELETE FROM smc_sessions WHERE user_id=?', [id]);
            await (0, database_service_1.audit)(tx, actor.id, 'user.edit', 'user', id, { role, active });
            return { data: (0, auth_service_1.publicUser)(await this.record(tx, 'smc_users', id)) };
        });
    }
    async resetPassword(actor, id, password, version) {
        const hash = await (0, password_1.passwordHash)(password);
        return this.write(actor, async (tx) => {
            const u = await this.record(tx, 'smc_users', id);
            assertVersion(u, version);
            if (id === actor.id)
                throw new common_1.UnprocessableEntityException('Cambia tu contraseña desde Mi cuenta.');
            await tx.query('UPDATE smc_users SET password_hash=?,must_change_password=1,auth_version=auth_version+1,version=version+1 WHERE id=?', [hash, id]);
            await tx.query('DELETE FROM smc_sessions WHERE user_id=?', [id]);
            await (0, database_service_1.audit)(tx, actor.id, 'user.password-reset', 'user', id);
            return { data: (0, auth_service_1.publicUser)(await this.record(tx, 'smc_users', id)) };
        });
    }
    async auditLog(query) {
        const { limit, cursor } = pageParams(query);
        return page(await this.db.query('SELECT a.id,a.action,a.entity,a.entity_id AS entityId,a.details,a.created_at AS createdAt,u.name AS actor FROM smc_audit a LEFT JOIN smc_users u ON u.id=a.actor_id WHERE (? IS NULL OR a.seq<(SELECT seq FROM smc_audit WHERE id=?)) ORDER BY a.seq DESC LIMIT ?', [cursor ?? null, cursor ?? null, limit + 1]), limit);
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_service_1.DatabaseService)),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AdminService);
