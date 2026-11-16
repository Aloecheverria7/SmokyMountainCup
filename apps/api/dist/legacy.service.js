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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyService = void 0;
const common_1 = require("@nestjs/common");
const promise_1 = require("mysql2/promise");
let LegacyService = class LegacyService {
    pool;
    constructor() {
        if (process.env.LEGACY_DB_NAME)
            this.pool = (0, promise_1.createPool)({
                host: process.env.LEGACY_DB_HOST || '127.0.0.1',
                port: Number(process.env.LEGACY_DB_PORT || 3306),
                database: process.env.LEGACY_DB_NAME,
                user: process.env.LEGACY_DB_USER,
                password: process.env.LEGACY_DB_PASSWORD,
                timezone: 'Z',
                connectionLimit: 4,
                multipleStatements: false,
            });
    }
    async feed() {
        if (!this.pool)
            throw new common_1.ServiceUnavailableException('Results temporarily unavailable.');
        try {
            const [games] = await this.pool.query(`SELECT g.*,h.name AS home,a.name AS away FROM games g JOIN teams h ON h.id=g.home_team_id JOIN teams a ON a.id=g.guest_team_id ORDER BY g.id`);
            const [memberships] = await this.pool.query(`SELECT gt.team_id,gr.id AS group_id,gr.name AS group_name,c.id AS category_id,c.name AS category FROM group_teams gt JOIN \`groups\` gr ON gr.id=gt.group_id JOIN categories c ON c.id=gr.category_id`);
            const states = {
                'not started': 'scheduled',
                'in progress': 'live',
                'half-time': 'half_time',
                paused: 'paused',
                ended: 'finished',
                finished: 'finished',
            };
            const matches = games.map((g) => {
                const home = memberships.filter((m) => m.team_id === g.home_team_id), away = memberships.filter((m) => m.team_id === g.guest_team_id);
                const common = [
                    ...new Set(home
                        .filter((h) => away.some((a) => a.category_id === h.category_id))
                        .map((h) => h.category_id)),
                ];
                if (common.length !== 1 || !states[g.status])
                    throw Error('Ambiguous legacy data');
                const h = home.find((m) => m.category_id === common[0]);
                const shared = home.filter((m) => away.some((a) => a.group_id === m.group_id));
                return {
                    id: g.id,
                    category_id: h.category_id,
                    category: h.category,
                    group_name: shared.length === 1 ? shared[0].group_name : null,
                    status: states[g.status],
                    elapsed: g.current_minute * 60,
                    home: g.home,
                    away: g.away,
                    home_score: g.home_score,
                    away_score: g.guest_score,
                    home_crest: null,
                    away_crest: null,
                    field: g.field,
                    scheduled_iso: null,
                    updated_at: g.last_update instanceof Date
                        ? g.last_update.toISOString().replace('T', ' ').slice(0, 19)
                        : String(g.last_update),
                    timezone: 'America/New_York',
                };
            });
            return {
                server_time: new Date().toISOString(),
                season: null,
                matches,
                posters: [],
                data_origin: 'legacy_read_only',
            };
        }
        catch {
            throw new common_1.ServiceUnavailableException('Results temporarily unavailable.');
        }
    }
    async onModuleDestroy() {
        await this.pool?.end();
    }
};
exports.LegacyService = LegacyService;
exports.LegacyService = LegacyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], LegacyService);
