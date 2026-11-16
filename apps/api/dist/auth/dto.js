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
exports.PasswordDto = exports.LoginDto = exports.Trim = void 0;
exports.parseDto = parseDto;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const Trim = () => (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value));
exports.Trim = Trim;
function parseDto(type, value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new common_1.BadRequestException('Solicitud inválida.');
    const dto = (0, class_transformer_1.plainToInstance)(type, value);
    if ((0, class_validator_1.validateSync)(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
    }).length)
        throw new common_1.BadRequestException('Comprueba los campos y sus límites.');
    return dto;
}
class LoginDto {
    email;
    password;
}
exports.LoginDto = LoginDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(160),
    (0, exports.Trim)(),
    __metadata("design:type", String)
], LoginDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 128),
    __metadata("design:type", String)
], LoginDto.prototype, "password", void 0);
class PasswordDto {
    currentPassword;
    newPassword;
}
exports.PasswordDto = PasswordDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 128),
    __metadata("design:type", String)
], PasswordDto.prototype, "currentPassword", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(12, 128),
    __metadata("design:type", String)
], PasswordDto.prototype, "newPassword", void 0);
