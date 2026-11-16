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
exports.CatalogService = void 0;
exports.paged = paged;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const luxon_1 = require("luxon");
const database_service_1 = require("../database/database.service");
const admin_service_1 = require("../admin/admin.service");
const store_1 = require("./store");
function paged(rows, limit, map = (r) => r) {
    const visible = rows.slice(0, limit);
    return {
        data: visible.map(map),
        page: { nextCursor: rows.length > limit ? visible.at(-1).id : null },
    };
}
const playerSelect = "SELECT id,name,DATE_FORMAT(birth_date,'%Y-%m-%d') AS birthDate,contact,archived,version FROM smc_players";
let CatalogService = class CatalogService {
    store;
    constructor(store) {
        this.store = store;
    }
    async row(tx, table, id) {
        const [r] = await tx.query(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`, [
            id,
        ]);
        if (!r)
            throw new common_1.NotFoundException('Registro no encontrado.');
        return r;
    }
    async list(kind, query) {
        const { limit, cursor } = (0, admin_service_1.pageParams)(query);
        const sql = kind === 'players'
            ? playerSelect
            : kind === 'venues'
                ? 'SELECT id,name,address,archived,version FROM smc_venues'
                : 'SELECT f.id,f.name,f.venue_id AS venueId,v.name AS venue,f.archived,f.version,v.archived AS venueArchived FROM smc_fields f JOIN smc_venues v ON v.id=f.venue_id';
        const id = kind === 'fields' ? 'f.id' : 'id';
        return paged(await this.store.db.query(sql + ` WHERE (? IS NULL OR ${id}>?) ORDER BY ${id} LIMIT ?`, [cursor ?? null, cursor ?? null, limit + 1]), limit, (r) => ({
            ...r,
            archived: !!r.archived,
            ...(kind === 'fields' ? { venueArchived: !!r.venueArchived } : {}),
        }));
    }
    async player(actor, d, id) {
        if (d.birthDate) {
            const date = luxon_1.DateTime.fromISO(d.birthDate, { zone: 'UTC' });
            (0, store_1.need)(/^\d{4}-\d{2}-\d{2}$/.test(d.birthDate) &&
                date.isValid &&
                date.toISODate() === d.birthDate &&
                d.birthDate <= luxon_1.DateTime.utc().toISODate(), 'Fecha de nacimiento inválida.');
        }
        return this.store.write(actor, true, async (tx) => {
            if (id) {
                const p = await this.row(tx, 'smc_players', id);
                (0, store_1.version)(p, d.expectedVersion);
                (0, store_1.need)(!p.archived, 'El jugador está archivado.');
                await tx.query('UPDATE smc_players SET name=?,birth_date=?,contact=?,version=version+1 WHERE id=?', [d.name, d.birthDate ?? null, d.contact ?? null, id]);
            }
            else {
                id = (0, node_crypto_1.randomUUID)();
                await tx.query('INSERT INTO smc_players(id,name,birth_date,contact,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP(3))', [id, d.name, d.birthDate ?? null, d.contact ?? null]);
            }
            await (0, database_service_1.audit)(tx, actor.id, 'player.save', 'player', id, { name: d.name });
            const [row] = await tx.query(playerSelect + ' WHERE id=?', [id]);
            return { data: { ...row, archived: !!row.archived } };
        });
    }
    async archive(actor, kind, id, expected) {
        return this.store.write(actor, true, async (tx) => {
            const table = kind === 'players'
                ? 'smc_players'
                : kind === 'venues'
                    ? 'smc_venues'
                    : 'smc_fields';
            const row = await this.row(tx, table, id);
            (0, store_1.version)(row, expected);
            (0, store_1.need)(!row.archived, 'El registro ya está archivado.');
            await tx.query(`UPDATE ${table} SET archived=1,version=version+1 WHERE id=?`, [id]);
            await (0, database_service_1.audit)(tx, actor.id, kind + '.archive', kind, id);
            return { data: { id, archived: true, version: row.version + 1 } };
        });
    }
    async venue(actor, d, id) {
        return this.store.write(actor, true, async (tx) => {
            if (id) {
                const old = await this.row(tx, 'smc_venues', id);
                (0, store_1.version)(old, d.expectedVersion);
                (0, store_1.need)(!old.archived, 'La sede está archivada.');
                await tx.query('UPDATE smc_venues SET name=?,address=?,version=version+1 WHERE id=?', [d.name, d.address ?? '', id]);
            }
            else {
                id = (0, node_crypto_1.randomUUID)();
                await tx.query('INSERT INTO smc_venues(id,name,address) VALUES (?,?,?)', [id, d.name, d.address ?? '']);
            }
            await (0, database_service_1.audit)(tx, actor.id, 'venue.save', 'venue', id, { name: d.name });
            return { data: await this.row(tx, 'smc_venues', id) };
        });
    }
    async field(actor, d, id) {
        return this.store.write(actor, true, async (tx) => {
            if (id) {
                const old = await this.row(tx, 'smc_fields', id);
                (0, store_1.version)(old, d.expectedVersion);
                (0, store_1.need)(!old.archived, 'La cancha está archivada.');
                const venue = await this.row(tx, 'smc_venues', old.venue_id);
                (0, store_1.need)(!venue.archived, 'La sede está archivada.');
                await tx.query('UPDATE smc_fields SET name=?,version=version+1 WHERE id=?', [d.name, id]);
            }
            else {
                const v = await this.row(tx, 'smc_venues', d.venueId);
                (0, store_1.need)(!v.archived, 'La sede está archivada.');
                id = (0, node_crypto_1.randomUUID)();
                await tx.query('INSERT INTO smc_fields(id,venue_id,name) VALUES (?,?,?)', [id, v.id, d.name]);
            }
            await (0, database_service_1.audit)(tx, actor.id, 'field.save', 'field', id, { name: d.name });
            const row = await this.row(tx, 'smc_fields', id);
            return {
                data: {
                    id: row.id,
                    name: row.name,
                    venueId: row.venue_id,
                    archived: !!row.archived,
                    version: row.version,
                },
            };
        });
    }
    async roster(entryId) {
        const [entry] = await this.store.db.query('SELECT id FROM smc_entries WHERE id=?', [entryId]);
        if (!entry)
            throw new common_1.NotFoundException('Inscripción no encontrada.');
        return {
            data: await this.store.db.query('SELECT r.id,r.entry_id AS entryId,r.player_id AS playerId,r.number,r.version,p.name,p.archived FROM smc_rosters r JOIN smc_players p ON p.id=r.player_id WHERE r.entry_id=? ORDER BY r.number,r.id', [entryId]),
        };
    }
    async saveRoster(actor, d, entryId, id) {
        return this.store.write(actor, true, async (tx) => {
            let row;
            if (id) {
                row = await this.row(tx, 'smc_rosters', id);
                (0, store_1.version)(row, d.expectedVersion);
                entryId = row.entry_id;
            }
            const entry = await this.row(tx, 'smc_entries', entryId);
            await this.store.competition(tx, entry.competition_id, true);
            if (id)
                await tx.query('UPDATE smc_rosters SET number=?,version=version+1 WHERE id=?', [d.number, id]);
            else {
                const player = await this.row(tx, 'smc_players', d.playerId);
                (0, store_1.need)(!player.archived, 'El jugador está archivado.');
                id = (0, node_crypto_1.randomUUID)();
                await tx.query('INSERT INTO smc_rosters(id,entry_id,competition_id,player_id,number) VALUES (?,?,?,?,?)', [id, entryId, entry.competition_id, player.id, d.number]);
            }
            await (0, database_service_1.audit)(tx, actor.id, 'roster.save', 'roster', id, {
                entryId,
                number: d.number,
            });
            row = await this.row(tx, 'smc_rosters', id);
            return {
                data: {
                    id: row.id,
                    entryId: row.entry_id,
                    competitionId: row.competition_id,
                    playerId: row.player_id,
                    number: row.number,
                    version: row.version,
                },
            };
        });
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(store_1.SportsStore)),
    __metadata("design:paramtypes", [store_1.SportsStore])
], CatalogService);
