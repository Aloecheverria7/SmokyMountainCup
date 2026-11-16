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
exports.ResetPasswordDto = exports.UserEditDto = exports.UserCreateDto = exports.RulesDto = exports.EntryDto = exports.TeamEditDto = exports.TeamCreateDto = exports.SeasonEditDto = exports.SeasonCreateDto = exports.VersionDto = void 0;
const class_validator_1 = require("class-validator");
const dto_1 = require("../auth/dto");
const IfPresent = () => (0, class_validator_1.ValidateIf)((_object, value) => value !== undefined);
class VersionDto {
    expectedVersion;
}
exports.VersionDto = VersionDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], VersionDto.prototype, "expectedVersion", void 0);
class SeasonCreateDto {
    name;
    timezone;
}
exports.SeasonCreateDto = SeasonCreateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], SeasonCreateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 80),
    __metadata("design:type", String)
], SeasonCreateDto.prototype, "timezone", void 0);
class SeasonEditDto extends VersionDto {
    name;
    timezone;
}
exports.SeasonEditDto = SeasonEditDto;
__decorate([
    IfPresent(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], SeasonEditDto.prototype, "name", void 0);
__decorate([
    IfPresent(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 80),
    __metadata("design:type", String)
], SeasonEditDto.prototype, "timezone", void 0);
class TeamCreateDto {
    name;
}
exports.TeamCreateDto = TeamCreateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], TeamCreateDto.prototype, "name", void 0);
class TeamEditDto extends VersionDto {
    name;
}
exports.TeamEditDto = TeamEditDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], TeamEditDto.prototype, "name", void 0);
class EntryDto {
    teamId;
}
exports.EntryDto = EntryDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], EntryDto.prototype, "teamId", void 0);
class RulesDto extends VersionDto {
    duration;
    winPoints;
    drawPoints;
    lossPoints;
    groupCapacity;
    qualifiers;
    rulesConfirmed;
}
exports.RulesDto = RulesDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(10),
    (0, class_validator_1.Max)(180),
    __metadata("design:type", Number)
], RulesDto.prototype, "duration", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], RulesDto.prototype, "winPoints", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], RulesDto.prototype, "drawPoints", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], RulesDto.prototype, "lossPoints", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(2),
    (0, class_validator_1.Max)(32),
    __metadata("design:type", Number)
], RulesDto.prototype, "groupCapacity", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(16),
    __metadata("design:type", Number)
], RulesDto.prototype, "qualifiers", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RulesDto.prototype, "rulesConfirmed", void 0);
class UserCreateDto {
    name;
    email;
    role;
    password;
}
exports.UserCreateDto = UserCreateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], UserCreateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(160),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], UserCreateDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['admin', 'scorer']),
    __metadata("design:type", String)
], UserCreateDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(12, 128),
    __metadata("design:type", String)
], UserCreateDto.prototype, "password", void 0);
class UserEditDto extends VersionDto {
    name;
    email;
    role;
    active;
}
exports.UserEditDto = UserEditDto;
__decorate([
    IfPresent(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], UserEditDto.prototype, "name", void 0);
__decorate([
    IfPresent(),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(160),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], UserEditDto.prototype, "email", void 0);
__decorate([
    IfPresent(),
    (0, class_validator_1.IsIn)(['admin', 'scorer']),
    __metadata("design:type", String)
], UserEditDto.prototype, "role", void 0);
__decorate([
    IfPresent(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UserEditDto.prototype, "active", void 0);
class ResetPasswordDto extends VersionDto {
    password;
}
exports.ResetPasswordDto = ResetPasswordDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(12, 128),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "password", void 0);
