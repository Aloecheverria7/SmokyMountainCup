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
exports.PublicSportsService = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const luxon_1 = require("luxon");
const database_service_1 = require("../database/database.service");
const admin_service_1 = require("../admin/admin.service");
const queries_1 = require("./queries");
const rules_1 = require("./rules");
const catalog_service_1 = require("./catalog.service");
let PublicSportsService = class PublicSportsService {
    db;
    constructor(db) {
        this.db = db;
    }
    async published(id, context = this.db) {
        const [c] = await context.query('SELECT c.*,s.timezone FROM smc_competitions c JOIN smc_seasons s ON s.id=c.season_id WHERE c.id=? AND c.published=1', [id]);
        if (!c)
            throw new common_1.NotFoundException('Competition not found.');
        return c;
    }
    async site() {
        return this.db.snapshot(async (tx) => {
            const [season] = await tx.query('SELECT id,name,timezone FROM smc_seasons WHERE active=1 AND archived=0');
            if (!season)
                return { season: null, competitions: [], matches: [], players: [] };
            const competitions = await tx.query("SELECT c.*,k.name,k.slug FROM smc_competitions c JOIN smc_categories k ON k.id=c.category_id WHERE c.season_id=? AND c.published=1 ORDER BY FIELD(k.slug,'infantil','junior','adulto','femenino')", [season.id]);
            if (!competitions.length)
                return { season: null, competitions: [], matches: [], players: [] };
            const matches = await tx.query(queries_1.matchSelect +
                ' WHERE c.season_id=? AND c.published=1 ORDER BY m.scheduled_at IS NULL,m.scheduled_at,m.id', [season.id]);
            const publicCompetitions = [];
            for (const c of competitions) {
                const groups = await tx.query('SELECT id,name FROM smc_groups WHERE competition_id=? ORDER BY name', [c.id]);
                const rows = (0, rules_1.standings)(await (0, queries_1.standingRows)(tx, c.id), matches.filter((m) => m.competition_id === c.id), c);
                publicCompetitions.push({
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    groups,
                    standings: rows.map((r) => ({
                        id: r.id,
                        teamId: r.teamId,
                        name: r.name,
                        groupId: r.group_id,
                        group: r.group_name,
                        played: r.played,
                        wins: r.wins,
                        draws: r.draws,
                        losses: r.losses,
                        gf: r.gf,
                        ga: r.ga,
                        gd: r.gd,
                        points: r.points,
                    })),
                });
            }
            // Public roster projection: never return birth dates, contacts, staff or import decisions.
            const players = await tx.query(`SELECT r.id AS rosterId,p.id,p.name,r.number,e.id AS entryId,t.name AS team,c.id AS competitionId,k.name AS category,g.name AS group_name,
          COALESCE(SUM(ev.kind='goal'),0) AS goals,COALESCE(SUM(ev.kind='own_goal'),0) AS ownGoals
         FROM smc_rosters r JOIN smc_players p ON p.id=r.player_id
         JOIN smc_entries e ON e.id=r.entry_id JOIN smc_teams t ON t.id=e.team_id
         JOIN smc_competitions c ON c.id=e.competition_id JOIN smc_categories k ON k.id=c.category_id
         LEFT JOIN smc_group_entries ge ON ge.entry_id=e.id LEFT JOIN smc_groups g ON g.id=ge.group_id
         LEFT JOIN (SELECT ev.* FROM smc_events ev JOIN smc_matches m ON m.id=ev.match_id
           WHERE m.confirmed=1 AND m.status='finished' AND ev.voided_at IS NULL) ev ON ev.roster_id=r.id
         WHERE c.season_id=? AND c.published=1
         GROUP BY r.id,p.id,p.name,r.number,e.id,t.name,c.id,k.name,g.name ORDER BY p.name,p.id,r.id`, [season.id]);
            return {
                season,
                competitions: publicCompetitions,
                matches: matches.map((m) => (0, queries_1.matchDto)(m)),
                players: players.map((p) => ({
                    ...p,
                    goals: Number(p.goals),
                    ownGoals: Number(p.ownGoals),
                })),
            };
        });
    }
    async feed() {
        return this.db.snapshot(async (tx) => {
            const [season] = await tx.query('SELECT id,name,timezone FROM smc_seasons WHERE active=1 AND archived=0');
            return {
                server_time: new Date().toISOString(),
                season: season ?? null,
                matches: season
                    ? (await tx.query(queries_1.matchSelect +
                        ' WHERE c.season_id=? AND c.published=1 ORDER BY m.scheduled_at,m.id', [season.id])).map((m) => (0, queries_1.matchDto)(m))
                    : [],
                posters: [],
                data_origin: 'native',
            };
        });
    }
    async seasons() {
        return {
            data: await this.db.query('SELECT s.id,s.name,s.timezone,s.active,s.archived FROM smc_seasons s WHERE EXISTS(SELECT 1 FROM smc_competitions c WHERE c.season_id=s.id AND c.published=1) ORDER BY s.active DESC,s.created_at DESC,s.id'),
        };
    }
    async competitions(seasonId) {
        return {
            data: await this.db.query("SELECT c.id,k.name,c.season_id AS seasonId FROM smc_competitions c JOIN smc_categories k ON k.id=c.category_id WHERE c.season_id=? AND c.published=1 ORDER BY FIELD(k.slug,'infantil','junior','adulto','femenino')", [seasonId]),
        };
    }
    async matches(cid, query) {
        const c = await this.published(cid);
        const { limit, cursor } = (0, admin_service_1.pageParams)(query);
        const where = ['m.competition_id=?', '(? IS NULL OR m.id>?)'], args = [cid, cursor ?? null, cursor ?? null];
        if (query.status) {
            if (![
                'scheduled',
                'live',
                'half_time',
                'paused',
                'finished',
                'suspended',
            ].includes(query.status))
                throw new common_1.BadRequestException('Invalid status.');
            where.push('m.status=?');
            args.push(query.status);
        }
        if (query.date) {
            if (typeof query.date !== 'string' ||
                !/^\d{4}-\d{2}-\d{2}$/.test(query.date))
                throw new common_1.BadRequestException('Invalid date.');
            const day = luxon_1.DateTime.fromISO(query.date, { zone: c.timezone });
            if (!day.isValid || day.toISODate() !== query.date)
                throw new common_1.BadRequestException('Invalid date.');
            where.push('m.scheduled_at>=? AND m.scheduled_at<?');
            args.push(day.startOf('day').toJSDate(), day.plus({ days: 1 }).startOf('day').toJSDate());
        }
        return (0, catalog_service_1.paged)(await this.db.query(queries_1.matchSelect +
            ' WHERE ' +
            where.join(' AND ') +
            ' ORDER BY m.id LIMIT ?', [...args, limit + 1]), limit, (m) => (0, queries_1.matchDto)(m));
    }
    async table(cid, provisional) {
        return this.db.snapshot(async (tx) => {
            const c = await this.published(cid, tx);
            return {
                data: (0, rules_1.standings)(await (0, queries_1.standingRows)(tx, cid), await tx.query('SELECT * FROM smc_matches WHERE competition_id=?', [
                    cid,
                ]), c, provisional),
                mode: provisional ? 'provisional' : 'official',
            };
        });
    }
    async bracket(cid) {
        await this.published(cid);
        return {
            data: (await this.db.query(queries_1.matchSelect +
                " WHERE m.competition_id=? AND m.stage='knockout' ORDER BY m.round_no,m.position_no", [cid])).map((m) => (0, queries_1.matchDto)(m)),
        };
    }
    async scorers(cid) {
        await this.published(cid);
        return {
            data: await this.db.query("SELECT p.id,p.name,t.name AS team,r.number,COUNT(e.id) AS goals FROM smc_events e JOIN smc_matches m ON m.id=e.match_id JOIN smc_rosters r ON r.id=e.roster_id JOIN smc_players p ON p.id=r.player_id JOIN smc_entries en ON en.id=e.entry_id JOIN smc_teams t ON t.id=en.team_id WHERE m.competition_id=? AND m.confirmed=1 AND m.status='finished' AND e.voided_at IS NULL AND e.kind='goal' GROUP BY p.id,p.name,t.id,t.name,r.number ORDER BY goals DESC,p.name,p.id", [cid]),
        };
    }
    async detail(id) {
        if (!(0, class_validator_1.isUUID)(id, '4'))
            throw new common_1.NotFoundException('Match not found.');
        return this.db.snapshot(async (tx) => {
            const [m] = await tx.query(queries_1.matchSelect + ' WHERE m.id=? AND c.published=1', [id]);
            if (!m)
                throw new common_1.NotFoundException('Match not found.');
            const events = await tx.query('SELECT e.id,e.minute,e.kind,e.entry_id AS entryId,p.name AS player,r.number,t.name AS team FROM smc_events e JOIN smc_entries en ON en.id=e.entry_id JOIN smc_teams t ON t.id=en.team_id LEFT JOIN smc_rosters r ON r.id=e.roster_id LEFT JOIN smc_players p ON p.id=r.player_id WHERE e.match_id=? AND e.voided_at IS NULL ORDER BY e.minute,e.created_at,e.id', [id]);
            return { data: (0, queries_1.matchDto)(m), events };
        });
    }
};
exports.PublicSportsService = PublicSportsService;
exports.PublicSportsService = PublicSportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_service_1.DatabaseService)),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], PublicSportsService);
