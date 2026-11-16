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
exports.AdminModule = exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const guards_1 = require("../auth/guards");
const dto_1 = require("../auth/dto");
const admin_service_1 = require("./admin.service");
const dto_2 = require("./dto");
const common_2 = require("@nestjs/common");
const uuid = new common_1.ParseUUIDPipe({ version: '4' });
let AdminController = class AdminController {
    service;
    constructor(service) {
        this.service = service;
    }
    seasons(r) {
        return this.service.seasons(r.query);
    }
    createSeason(r) {
        return this.service.createSeason(r.principal, (0, dto_1.parseDto)(dto_2.SeasonCreateDto, r.body));
    }
    editSeason(r, id) {
        return this.service.editSeason(r.principal, id, (0, dto_1.parseDto)(dto_2.SeasonEditDto, r.body));
    }
    activate(r, id) {
        return this.service.activateSeason(r.principal, id, (0, dto_1.parseDto)(dto_2.VersionDto, r.body).expectedVersion);
    }
    archiveSeason(r, id) {
        return this.service.archiveSeason(r.principal, id, (0, dto_1.parseDto)(dto_2.VersionDto, r.body).expectedVersion);
    }
    competitions(id) {
        return this.service.competitions(id);
    }
    rules(r, id) {
        return this.service.rules(r.principal, id, (0, dto_1.parseDto)(dto_2.RulesDto, r.body));
    }
    teams(r) {
        return this.service.teams(r.query);
    }
    createTeam(r) {
        return this.service.createTeam(r.principal, (0, dto_1.parseDto)(dto_2.TeamCreateDto, r.body).name);
    }
    editTeam(r, id) {
        const d = (0, dto_1.parseDto)(dto_2.TeamEditDto, r.body);
        return this.service.editTeam(r.principal, id, d.name, d.expectedVersion);
    }
    archiveTeam(r, id) {
        return this.service.archiveTeam(r.principal, id, (0, dto_1.parseDto)(dto_2.VersionDto, r.body).expectedVersion);
    }
    entries(r, id) {
        return this.service.entries(id, r.query);
    }
    createEntry(r, id) {
        return this.service.createEntry(r.principal, id, (0, dto_1.parseDto)(dto_2.EntryDto, r.body).teamId);
    }
    users(r) {
        return this.service.users(r.query);
    }
    createUser(r) {
        return this.service.createUser(r.principal, (0, dto_1.parseDto)(dto_2.UserCreateDto, r.body));
    }
    editUser(r, id) {
        return this.service.editUser(r.principal, id, (0, dto_1.parseDto)(dto_2.UserEditDto, r.body));
    }
    resetPassword(r, id) {
        const d = (0, dto_1.parseDto)(dto_2.ResetPasswordDto, r.body);
        return this.service.resetPassword(r.principal, id, d.password, d.expectedVersion);
    }
    audit(r) {
        return this.service.auditLog(r.query);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('seasons'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "seasons", null);
__decorate([
    (0, common_1.Post)('seasons'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createSeason", null);
__decorate([
    (0, common_1.Patch)('seasons/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "editSeason", null);
__decorate([
    (0, common_1.Post)('seasons/:id/activate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "activate", null);
__decorate([
    (0, common_1.Post)('seasons/:id/archive'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "archiveSeason", null);
__decorate([
    (0, common_1.Get)('seasons/:id/competitions'),
    __param(0, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "competitions", null);
__decorate([
    (0, common_1.Patch)('competitions/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "rules", null);
__decorate([
    (0, common_1.Get)('teams'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "teams", null);
__decorate([
    (0, common_1.Post)('teams'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createTeam", null);
__decorate([
    (0, common_1.Patch)('teams/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "editTeam", null);
__decorate([
    (0, common_1.Post)('teams/:id/archive'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "archiveTeam", null);
__decorate([
    (0, common_1.Get)('competitions/:id/entries'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "entries", null);
__decorate([
    (0, common_1.Post)('competitions/:id/entries'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createEntry", null);
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "users", null);
__decorate([
    (0, common_1.Post)('users'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createUser", null);
__decorate([
    (0, common_1.Patch)('users/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "editUser", null);
__decorate([
    (0, common_1.Post)('users/:id/reset-password'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', uuid)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Get)('audit'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "audit", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('api/v1'),
    (0, common_1.UseGuards)(guards_1.SessionGuard, guards_1.AdminGuard, guards_1.CsrfGuard),
    __param(0, (0, common_1.Inject)(admin_service_1.AdminService)),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_2.Module)({
        imports: [auth_module_1.AuthModule],
        controllers: [AdminController],
        providers: [admin_service_1.AdminService],
    })
], AdminModule);
