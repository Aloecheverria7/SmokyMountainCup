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
exports.MatchService = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const luxon_1 = require("luxon");
const node_crypto_1 = require("node:crypto");
const admin_service_1 = require("../admin/admin.service");
const store_1 = require("./store");
const competition_service_1 = require("./competition.service");
const queries_1 = require("./queries");
const rules_1 = require("./rules");
const catalog_service_1 = require("./catalog.service");
let MatchService = class MatchService {
    store;
    competitions;
    constructor(store, competitions) {
        this.store = store;
        this.competitions = competitions;
    }
    async list(actor, query) {
        const { limit, cursor } = (0, admin_service_1.pageParams)(query);
        const where = ['(? IS NULL OR m.id>?)'], args = [cursor ?? null, cursor ?? null];
        if (actor.role !== 'admin') {
            where.push('a.user_id=?');
            args.push(actor.id);
        }
        for (const [key, column] of [
            ['seasonId', 'c.season_id'],
            ['competitionId', 'm.competition_id'],
        ])
            if (query[key]) {
                if (typeof query[key] !== 'string' ||
                    !(0, class_validator_1.isUUID)(query[key], '4'))
                    throw new common_1.BadRequestException('Filtro inválido.');
                where.push(column + '=?');
                args.push(query[key]);
            }
        return (0, catalog_service_1.paged)(await this.store.db.query(queries_1.matchSelect +
            ' WHERE ' +
            where.join(' AND ') +
            ' ORDER BY m.id LIMIT ?', [...args, limit + 1]), limit, (m) => (0, queries_1.matchDto)(m, true));
    }
    async detail(actor, id) {
        return this.store.db.transaction(async (tx) => {
            await this.store.matchPermission(tx, id, actor);
            return this.snapshot(tx, id);
        });
    }
    async snapshot(tx, id) {
        const [m] = await tx.query(queries_1.matchSelect + ' WHERE m.id=?', [id]);
        if (!m)
            throw new common_1.NotFoundException('Partido no encontrado.');
        const events = await tx.query('SELECT e.id,e.entry_id AS entryId,e.kind,e.minute,e.reason,e.voided_at AS voidedAt,p.name AS player,r.number,t.name AS team FROM smc_events e JOIN smc_entries en ON en.id=e.entry_id JOIN smc_teams t ON t.id=en.team_id LEFT JOIN smc_rosters r ON r.id=e.roster_id LEFT JOIN smc_players p ON p.id=r.player_id WHERE e.match_id=? ORDER BY e.minute,e.created_at,e.id', [id]);
        const roster = await tx.query('SELECT r.id,r.entry_id AS entryId,r.number,p.name FROM smc_rosters r JOIN smc_players p ON p.id=r.player_id WHERE r.entry_id IN (?,?) AND p.archived=0 ORDER BY r.entry_id,r.number', [m.home_entry_id, m.away_entry_id]);
        return { data: (0, queries_1.matchDto)(m, true), events, roster };
    }
    async update(tx, id) {
        await tx.query('UPDATE smc_matches SET version=version+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?', [id]);
    }
    async run(actor, id, key, action, d, admin, fn) {
        return this.store.operation(actor, admin, action, id, key, d, (tx) => this.store.matchPermission(tx, id, actor), async (tx) => {
            const m = await this.store.match(tx, id), c = await this.store.competition(tx, m.competition_id, true);
            (0, store_1.version)(m, d.expectedVersion);
            await fn(tx, m, c);
            await this.update(tx, id);
            return this.snapshot(tx, id);
        });
    }
    async schedule(actor, id, key, d) {
        let date = null;
        if (d.scheduledAt !== null) {
            (0, store_1.need)(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(d.scheduledAt), 'Incluye fecha, hora y desfase UTC explícito.');
            const parsed = luxon_1.DateTime.fromISO(d.scheduledAt, { setZone: true });
            (0, store_1.need)(parsed.isValid, 'Fecha u hora inválida.');
            date = parsed.toJSDate();
        }
        return this.run(actor, id, key, 'match.schedule', d, true, async (tx, m, c) => {
            (0, store_1.need)(['scheduled', 'suspended'].includes(m.status), 'Solo puedes programar partidos pendientes o suspendidos.');
            if (d.fieldId) {
                const [f] = await tx.query('SELECT f.id FROM smc_fields f JOIN smc_venues v ON v.id=f.venue_id WHERE f.id=? AND f.archived=0 AND v.archived=0', [d.fieldId]);
                (0, store_1.need)(f, 'La cancha o su sede no están disponibles.');
            }
            try {
                await (0, queries_1.checkSchedule)(tx, m, d.fieldId, date, c.duration);
            }
            catch (e) {
                throw new common_1.UnprocessableEntityException(e.message === 'FIELD_CONFLICT'
                    ? 'La cancha ya tiene un partido en ese horario.'
                    : 'Un equipo ya tiene otro partido en ese horario.');
            }
            await tx.query('UPDATE smc_matches SET field_id=?,scheduled_at=? WHERE id=?', [d.fieldId, date, id]);
        });
    }
    async assign(actor, id, key, d) {
        return this.run(actor, id, key, 'match.assign', d, true, async (tx) => {
            if (d.scorerId) {
                const [u] = await tx.query("SELECT id FROM smc_users WHERE id=? AND role='scorer' AND active=1", [d.scorerId]);
                (0, store_1.need)(u, 'Anotador no disponible.');
            }
            await tx.query('DELETE FROM smc_assignments WHERE match_id=?', [id]);
            if (d.scorerId)
                await tx.query('INSERT INTO smc_assignments(match_id,user_id) VALUES (?,?)', [id, d.scorerId]);
        });
    }
    async status(actor, id, key, d) {
        return this.run(actor, id, key, 'match.status', d, false, async (tx, m, c) => {
            (0, store_1.need)(!m.confirmed, 'El resultado está confirmado.');
            (0, store_1.need)(rules_1.transitions[m.status]?.includes(d.status), 'Cambio de estado no permitido.');
            (0, store_1.need)(m.home_entry_id && m.away_entry_id, 'Faltan equipos por clasificar.');
            if (m.status === 'suspended' && d.status === 'live' && m.scheduled_at) {
                try {
                    await (0, queries_1.checkSchedule)(tx, m, m.field_id, new Date(m.scheduled_at), c.duration);
                }
                catch {
                    throw new common_1.UnprocessableEntityException('Reprograma el partido suspendido antes de retomarlo: hay un conflicto horario.');
                }
            }
            await tx.query('UPDATE smc_matches SET status=?,elapsed_seconds=?,clock_started_at=? WHERE id=?', [d.status, (0, rules_1.elapsed)(m), d.status === 'live' ? new Date() : null, id]);
        });
    }
    async rescore(tx, m) {
        const events = await tx.query('SELECT entry_id,kind FROM smc_events WHERE match_id=? AND voided_at IS NULL', [m.id]);
        let home = 0, away = 0;
        for (const e of events) {
            const homeGoal = e.kind === 'own_goal'
                ? e.entry_id === m.away_entry_id
                : e.entry_id === m.home_entry_id;
            if (homeGoal)
                home++;
            else
                away++;
        }
        await tx.query('UPDATE smc_matches SET home_score=?,away_score=? WHERE id=?', [home, away, m.id]);
    }
    async goal(actor, id, key, d) {
        return this.run(actor, id, key, 'match.goal', d, false, async (tx, m) => {
            (0, store_1.need)(!m.confirmed &&
                ['live', 'half_time', 'paused', 'finished'].includes(m.status), 'Inicia el partido o reabre el resultado antes de registrar goles.');
            (0, store_1.need)(m.home_entry_id && m.away_entry_id, 'Faltan participantes.');
            (0, store_1.need)([m.home_entry_id, m.away_entry_id].includes(d.entryId), 'El equipo no pertenece al partido.');
            if (d.rosterId) {
                const [r] = await tx.query('SELECT r.id FROM smc_rosters r JOIN smc_players p ON p.id=r.player_id WHERE r.id=? AND r.entry_id=? AND p.archived=0', [d.rosterId, d.entryId]);
                (0, store_1.need)(r, 'El autor no pertenece a la plantilla seleccionada.');
            }
            await tx.query('INSERT INTO smc_events(id,match_id,competition_id,entry_id,roster_id,kind,minute,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3))', [
                (0, node_crypto_1.randomUUID)(),
                id,
                m.competition_id,
                d.entryId,
                d.rosterId ?? null,
                d.kind,
                d.minute,
                actor.id,
            ]);
            await this.rescore(tx, m);
        });
    }
    async voidEvent(actor, id, eventId, key, d) {
        return this.run(actor, id, key, 'match.void', { ...d, eventId }, false, async (tx, m) => {
            (0, store_1.need)(!m.confirmed, 'Reabre el resultado antes de corregirlo.');
            const [event] = await tx.query('SELECT * FROM smc_events WHERE id=? AND match_id=?', [eventId, id]);
            (0, store_1.need)(event && !event.voided_at, 'El evento no está disponible.');
            await tx.query('UPDATE smc_events SET voided_at=UTC_TIMESTAMP(3),voided_by=?,reason=? WHERE id=?', [actor.id, d.reason, eventId]);
            await this.rescore(tx, m);
        });
    }
    async confirm(actor, id, key, d) {
        return this.run(actor, id, key, 'match.confirm', d, true, async (tx, m) => {
            (0, store_1.need)(m.status === 'finished' &&
                !m.confirmed &&
                m.home_entry_id &&
                m.away_entry_id, 'Finaliza un partido con ambos equipos antes de confirmar.');
            let winner = null, hp = null, ap = null;
            if (m.home_score !== m.away_score) {
                (0, store_1.need)(d.homePenalties === undefined && d.awayPenalties === undefined, 'Los penales solo resuelven eliminatorias empatadas.');
                winner =
                    m.home_score > m.away_score ? m.home_entry_id : m.away_entry_id;
            }
            else if (m.stage === 'knockout') {
                (0, store_1.need)(d.homePenalties !== undefined &&
                    d.awayPenalties !== undefined &&
                    d.homePenalties !== d.awayPenalties, 'Indica penales distintos para resolver la eliminatoria.');
                hp = d.homePenalties;
                ap = d.awayPenalties;
                winner = hp > ap ? m.home_entry_id : m.away_entry_id;
            }
            else
                (0, store_1.need)(d.homePenalties === undefined && d.awayPenalties === undefined, 'Los partidos de grupo no se resuelven por penales.');
            await tx.query('UPDATE smc_matches SET confirmed=1,winner_entry_id=?,home_penalties=?,away_penalties=? WHERE id=?', [winner, hp, ap, id]);
            await this.competitions.advance(tx, m.competition_id);
        });
    }
    async reopen(actor, id, key, d) {
        return this.run(actor, id, key, 'match.reopen', d, true, async (tx, m) => {
            (0, store_1.need)(m.confirmed && m.home_entry_id && m.away_entry_id, 'Este partido no se puede reabrir.');
            const [dependent] = await tx.query('SELECT id FROM smc_matches WHERE source_home_id=? OR source_away_id=? LIMIT 1', [id, id]);
            (0, store_1.need)(!dependent, 'Retira primero las rondas posteriores no iniciadas.');
            if (m.stage === 'group') {
                const [knockout] = await tx.query("SELECT id FROM smc_matches WHERE competition_id=? AND stage='knockout' LIMIT 1", [m.competition_id]);
                (0, store_1.need)(!knockout, 'Retira primero las eliminatorias dependientes.');
            }
            await tx.query('UPDATE smc_matches SET confirmed=0,winner_entry_id=NULL,home_penalties=NULL,away_penalties=NULL WHERE id=?', [id]);
        });
    }
};
exports.MatchService = MatchService;
exports.MatchService = MatchService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(store_1.SportsStore)),
    __param(1, (0, common_1.Inject)(competition_service_1.CompetitionService)),
    __metadata("design:paramtypes", [store_1.SportsStore,
        competition_service_1.CompetitionService])
], MatchService);
