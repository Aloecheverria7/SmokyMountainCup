"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SportsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const guards_1 = require("../auth/guards");
const dto_1 = require("../auth/dto");
const dto_2 = require("../admin/dto");
const store_1 = require("./store");
const catalog_service_1 = require("./catalog.service");
const competition_service_1 = require("./competition.service");
const match_service_1 = require("./match.service");
const public_service_1 = require("./public.service");
const queries_1 = require("./queries");
const rules_1 = require("./rules");
const D = __importStar(require("./dto"));
const uuid = new common_1.ParseUUIDPipe({ version: '4' });
let ReadyGuard = class ReadyGuard {
    canActivate(c) {
        if (c.switchToHttp().getRequest().principal.mustChangePassword)
            throw new common_1.ForbiddenException('Cambia tu contraseña antes de continuar.');
        return true;
    }
};
ReadyGuard = __decorate([
    (0, common_1.Injectable)()
], ReadyGuard);
let CatalogController = class CatalogController {
    service;
    constructor(service) {
        this.service = service;
    }
    players(r) {
        return this.service.list('players', r.query);
    }
    player(r) {
        return this.service.player(r.principal, (0, dto_1.parseDto)(D.PlayerDto, r.body));
    }
    editPlayer(r, id) {
        return this.service.player(r.principal, (0, dto_1.parseDto)(D.PlayerEditDto, r.body), id);
    }
    archivePlayer(r, id) {
        return this.service.archive(r.principal, 'players', id, (0, dto_1.parseDto)(dto_2.VersionDto, r.body).expectedVersion);
    }
    roster(id) {
        return this.service.roster(id);
    }
    addRoster(r, id) {
        return this.service.saveRoster(r.principal, (0, dto_1.parseDto)(D.RosterDto, r.body), id);
    }
    editRoster(r, id) {
        return this.service.saveRoster(r.principal, (0, dto_1.parseDto)(D.RosterEditDto, r.body), undefined, id);
    }
    venues(r) {
        return this.service.list('venues', r.query);
    }
    venue(r) {
        return this.service.venue(r.principal, (0, dto_1.parseDto)(D.VenueDto, r.body));
    }
    editVenue(r, id) {
        return this.service.venue(r.principal, (0, dto_1.parseDto)(D.VenueEditDto, r.body), id);
    }
    archiveVenue(r, id) {
        return this.service.archive(r.principal, 'venues', id, (0, dto_1.parseDto)(dto_2.VersionDto, r.body).expectedVersion);
    }
    fields(r) {
        return this.service.list('fields', r.query);
    }
    field(r) {
        return this.service.field(r.principal, (0, dto_1.parseDto)(D.FieldDto, r.body));
    }
    editField(r, id) {
        return this.service.field(r.principal, (0, dto_1.parseDto)(D.FieldEditDto, r.body), id);
    }
    archiveField(r, id) {
        return this.service.archive(r.principal, 'fields', id, (0, dto_1.parseDto)(dto_2.VersionDto, r.body).expectedVersion);
    }
};
__decorate([
    (0, common_1.Get)('players'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "players", null);
__decorate([
    (0, common_1.Post)('players'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "player", null);
__decorate([
    (0, common_1.Patch)('players/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "editPlayer", null);
__decorate([
    (0, common_1.Post)('players/:id/archive'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "archivePlayer", null);
__decorate([
    (0, common_1.Get)('entries/:id/roster'),
    __param(0, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "roster", null);
__decorate([
    (0, common_1.Post)('entries/:id/roster'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "addRoster", null);
__decorate([
    (0, common_1.Patch)('rosters/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "editRoster", null);
__decorate([
    (0, common_1.Get)('venues'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "venues", null);
__decorate([
    (0, common_1.Post)('venues'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "venue", null);
__decorate([
    (0, common_1.Patch)('venues/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "editVenue", null);
__decorate([
    (0, common_1.Post)('venues/:id/archive'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "archiveVenue", null);
__decorate([
    (0, common_1.Get)('fields'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "fields", null);
__decorate([
    (0, common_1.Post)('fields'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "field", null);
__decorate([
    (0, common_1.Patch)('fields/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "editField", null);
__decorate([
    (0, common_1.Post)('fields/:id/archive'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "archiveField", null);
CatalogController = __decorate([
    (0, common_1.Controller)('api/v1'),
    (0, common_1.UseGuards)(guards_1.SessionGuard, guards_1.AdminGuard, guards_1.CsrfGuard),
    __param(0, (0, common_1.Inject)(catalog_service_1.CatalogService)),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService])
], CatalogController);
let OrganizationController = class OrganizationController {
    service;
    store;
    constructor(service, store) {
        this.service = service;
        this.store = store;
    }
    state(id) {
        return this.store.db.transaction(async (tx) => {
            const c = await this.store.competition(tx, id);
            const matches = await tx.query('SELECT * FROM smc_matches WHERE competition_id=?', [id]);
            return {
                data: {
                    id: c.id,
                    version: c.version,
                    published: !!c.published,
                    archived: !!c.archived,
                    rulesConfirmed: !!c.rules_confirmed,
                    qualifiers: c.qualifiers,
                    imported: !!c.import_batch_id,
                },
                standings: (0, rules_1.standings)(await (0, queries_1.standingRows)(tx, id), matches, c),
                provisional: (0, rules_1.standings)(await (0, queries_1.standingRows)(tx, id), matches, c, true),
            };
        });
    }
    importedPublication(r, id) {
        return this.service.importedPublication(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.ImportedPublicationDto, r.body));
    }
    preview(r, id) {
        return this.service.preview(r.principal, id, (0, dto_1.parseDto)(D.PreviewDto, r.body));
    }
    publish(r, id) {
        return this.service.publish(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.DrawDto, r.body));
    }
    reset(r, id) {
        return this.service.reset(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.ReasonDto, r.body));
    }
    qualify(r, id) {
        return this.service.qualify(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.QualifyDto, r.body));
    }
    remove(r, id) {
        return this.service.removeRounds(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.RoundsDto, r.body));
    }
    rebuild(r, id) {
        return this.service.rebuild(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.ReasonDto, r.body));
    }
};
__decorate([
    (0, common_1.Get)(':id/sport-state'),
    __param(0, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "state", null);
__decorate([
    (0, common_1.Post)(':id/imported-publication'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "importedPublication", null);
__decorate([
    (0, common_1.Post)(':id/draw-previews'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)(':id/draw'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)(':id/reset-draw'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "reset", null);
__decorate([
    (0, common_1.Post)(':id/qualify'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "qualify", null);
__decorate([
    (0, common_1.Post)(':id/remove-rounds'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/rebuild-rounds'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrganizationController.prototype, "rebuild", null);
OrganizationController = __decorate([
    (0, common_1.Controller)('api/v1/competitions'),
    (0, common_1.UseGuards)(guards_1.SessionGuard, guards_1.AdminGuard, guards_1.CsrfGuard),
    __param(0, (0, common_1.Inject)(competition_service_1.CompetitionService)),
    __param(1, (0, common_1.Inject)(store_1.SportsStore)),
    __metadata("design:paramtypes", [competition_service_1.CompetitionService,
        store_1.SportsStore])
], OrganizationController);
let MatchesController = class MatchesController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(r) {
        return this.service.list(r.principal, r.query);
    }
    detail(r, id) {
        return this.service.detail(r.principal, id);
    }
    schedule(r, id) {
        return this.service.schedule(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.ScheduleDto, r.body));
    }
    assign(r, id) {
        return this.service.assign(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.AssignDto, r.body));
    }
    status(r, id) {
        return this.service.status(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.StatusDto, r.body));
    }
    goal(r, id) {
        return this.service.goal(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.GoalDto, r.body));
    }
    void(r, id, eventId) {
        return this.service.voidEvent(r.principal, id, eventId, r.get('idempotency-key'), (0, dto_1.parseDto)(D.ReasonDto, r.body));
    }
    confirm(r, id) {
        return this.service.confirm(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.ConfirmDto, r.body));
    }
    reopen(r, id) {
        return this.service.reopen(r.principal, id, r.get('idempotency-key'), (0, dto_1.parseDto)(D.ReasonDto, r.body));
    }
};
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':id/schedule'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "schedule", null);
__decorate([
    (0, common_1.Post)(':id/assignment'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "assign", null);
__decorate([
    (0, common_1.Post)(':id/status'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "status", null);
__decorate([
    (0, common_1.Post)(':id/events'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "goal", null);
__decorate([
    (0, common_1.Post)(':id/events/:eventId/void'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __param(2, (0, common_1.Param)('eventId', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "void", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)(':id/reopen'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "reopen", null);
MatchesController = __decorate([
    (0, common_1.Controller)('api/v1/matches'),
    (0, common_1.UseGuards)(guards_1.SessionGuard, ReadyGuard, guards_1.CsrfGuard),
    __param(0, (0, common_1.Inject)(match_service_1.MatchService)),
    __metadata("design:paramtypes", [match_service_1.MatchService])
], MatchesController);
let PublicTournamentController = class PublicTournamentController {
    service;
    constructor(service) {
        this.service = service;
    }
    site() {
        return this.service.site();
    }
    seasons() {
        return this.service.seasons();
    }
    competitions(id) {
        return this.service.competitions(id);
    }
    matches(r, id) {
        return this.service.matches(id, r.query);
    }
    table(r, id) {
        return this.service.table(id, r.query.mode === 'provisional');
    }
    bracket(id) {
        return this.service.bracket(id);
    }
    scorers(id) {
        return this.service.scorers(id);
    }
    match(id) {
        return this.service.detail(id);
    }
};
__decorate([
    (0, common_1.Get)('site'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicTournamentController.prototype, "site", null);
__decorate([
    (0, common_1.Get)('seasons'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicTournamentController.prototype, "seasons", null);
__decorate([
    (0, common_1.Get)('seasons/:id/competitions'),
    __param(0, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicTournamentController.prototype, "competitions", null);
__decorate([
    (0, common_1.Get)('competitions/:id/matches'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PublicTournamentController.prototype, "matches", null);
__decorate([
    (0, common_1.Get)('competitions/:id/standings'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PublicTournamentController.prototype, "table", null);
__decorate([
    (0, common_1.Get)('competitions/:id/bracket'),
    __param(0, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicTournamentController.prototype, "bracket", null);
__decorate([
    (0, common_1.Get)('competitions/:id/scorers'),
    __param(0, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicTournamentController.prototype, "scorers", null);
__decorate([
    (0, common_1.Get)('matches/:id'),
    __param(0, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicTournamentController.prototype, "match", null);
PublicTournamentController = __decorate([
    (0, common_1.Controller)('api/v1/public'),
    __param(0, (0, common_1.Inject)(public_service_1.PublicSportsService)),
    __metadata("design:paramtypes", [public_service_1.PublicSportsService])
], PublicTournamentController);
let SportsModule = class SportsModule {
};
exports.SportsModule = SportsModule;
exports.SportsModule = SportsModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        controllers: [
            CatalogController,
            OrganizationController,
            MatchesController,
            PublicTournamentController,
        ],
        providers: [
            store_1.SportsStore,
            catalog_service_1.CatalogService,
            competition_service_1.CompetitionService,
            match_service_1.MatchService,
            public_service_1.PublicSportsService,
            ReadyGuard,
        ],
        exports: [public_service_1.PublicSportsService],
    })
], SportsModule);
