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
exports.ConfirmDto = exports.GoalDto = exports.StatusDto = exports.AssignDto = exports.ScheduleDto = exports.QualifyDto = exports.RoundsDto = exports.ImportedPublicationDto = exports.ReasonDto = exports.DrawDto = exports.PreviewDto = exports.FieldEditDto = exports.FieldDto = exports.VenueEditDto = exports.VenueDto = exports.RosterEditDto = exports.RosterDto = exports.PlayerEditDto = exports.PlayerDto = void 0;
const class_validator_1 = require("class-validator");
const dto_1 = require("../auth/dto");
const dto_2 = require("../admin/dto");
const Present = () => (0, class_validator_1.ValidateIf)((_o, v) => v !== undefined);
class PlayerDto {
    name;
    birthDate;
    contact;
}
exports.PlayerDto = PlayerDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], PlayerDto.prototype, "name", void 0);
__decorate([
    Present(),
    (0, class_validator_1.ValidateIf)((_o, v) => v !== null && v !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 10),
    __metadata("design:type", Object)
], PlayerDto.prototype, "birthDate", void 0);
__decorate([
    Present(),
    (0, class_validator_1.ValidateIf)((_o, v) => v !== null && v !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 160),
    __metadata("design:type", Object)
], PlayerDto.prototype, "contact", void 0);
class PlayerEditDto extends PlayerDto {
    expectedVersion;
}
exports.PlayerEditDto = PlayerEditDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PlayerEditDto.prototype, "expectedVersion", void 0);
class RosterDto {
    playerId;
    number;
}
exports.RosterDto = RosterDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], RosterDto.prototype, "playerId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999),
    __metadata("design:type", Number)
], RosterDto.prototype, "number", void 0);
class RosterEditDto extends dto_2.VersionDto {
    number;
}
exports.RosterEditDto = RosterEditDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999),
    __metadata("design:type", Number)
], RosterEditDto.prototype, "number", void 0);
class VenueDto {
    name;
    address;
}
exports.VenueDto = VenueDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], VenueDto.prototype, "name", void 0);
__decorate([
    Present(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 255),
    __metadata("design:type", String)
], VenueDto.prototype, "address", void 0);
class VenueEditDto extends VenueDto {
    expectedVersion;
}
exports.VenueEditDto = VenueEditDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], VenueEditDto.prototype, "expectedVersion", void 0);
class FieldDto {
    name;
    venueId;
}
exports.FieldDto = FieldDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], FieldDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], FieldDto.prototype, "venueId", void 0);
class FieldEditDto extends dto_2.VersionDto {
    name;
}
exports.FieldEditDto = FieldEditDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], FieldEditDto.prototype, "name", void 0);
class PreviewDto {
    mode;
    entryIds;
}
exports.PreviewDto = PreviewDto;
__decorate([
    (0, class_validator_1.IsIn)(['random', 'manual']),
    __metadata("design:type", String)
], PreviewDto.prototype, "mode", void 0);
__decorate([
    Present(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(512),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], PreviewDto.prototype, "entryIds", void 0);
class DrawDto {
    previewId;
}
exports.DrawDto = DrawDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], DrawDto.prototype, "previewId", void 0);
class ReasonDto extends dto_2.VersionDto {
    reason;
}
exports.ReasonDto = ReasonDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], ReasonDto.prototype, "reason", void 0);
class ImportedPublicationDto extends ReasonDto {
    published;
}
exports.ImportedPublicationDto = ImportedPublicationDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ImportedPublicationDto.prototype, "published", void 0);
class RoundsDto extends ReasonDto {
    fromRound;
}
exports.RoundsDto = RoundsDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], RoundsDto.prototype, "fromRound", void 0);
class QualifyDto extends dto_2.VersionDto {
    entryIds;
    tieReason;
}
exports.QualifyDto = QualifyDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ArrayMaxSize)(512),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], QualifyDto.prototype, "entryIds", void 0);
__decorate([
    Present(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    (0, dto_1.Trim)(),
    __metadata("design:type", String)
], QualifyDto.prototype, "tieReason", void 0);
class ScheduleDto extends dto_2.VersionDto {
    fieldId;
    scheduledAt;
}
exports.ScheduleDto = ScheduleDto;
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== null),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", Object)
], ScheduleDto.prototype, "fieldId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== null),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(20, 40),
    __metadata("design:type", Object)
], ScheduleDto.prototype, "scheduledAt", void 0);
class AssignDto extends dto_2.VersionDto {
    scorerId;
}
exports.AssignDto = AssignDto;
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== null),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", Object)
], AssignDto.prototype, "scorerId", void 0);
class StatusDto extends dto_2.VersionDto {
    status;
}
exports.StatusDto = StatusDto;
__decorate([
    (0, class_validator_1.IsIn)(['scheduled', 'live', 'half_time', 'paused', 'finished', 'suspended']),
    __metadata("design:type", String)
], StatusDto.prototype, "status", void 0);
class GoalDto extends dto_2.VersionDto {
    entryId;
    rosterId;
    kind;
    minute;
}
exports.GoalDto = GoalDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], GoalDto.prototype, "entryId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_o, v) => v !== null && v !== undefined),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", Object)
], GoalDto.prototype, "rosterId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['goal', 'own_goal']),
    __metadata("design:type", String)
], GoalDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(300),
    __metadata("design:type", Number)
], GoalDto.prototype, "minute", void 0);
class ConfirmDto extends dto_2.VersionDto {
    homePenalties;
    awayPenalties;
}
exports.ConfirmDto = ConfirmDto;
__decorate([
    Present(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ConfirmDto.prototype, "homePenalties", void 0);
__decorate([
    Present(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ConfirmDto.prototype, "awayPenalties", void 0);
