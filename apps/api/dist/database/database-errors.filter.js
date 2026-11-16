"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseErrorsFilter = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let DatabaseErrorsFilter = class DatabaseErrorsFilter {
    logger = new common_1.Logger('Database');
    catch(error, host) {
        const driver = error.driverError;
        const duplicate = driver.errno === 1062;
        this.logger.warn(`Database operation rejected (${driver.errno ?? 'unknown'}).`);
        host
            .switchToHttp()
            .getResponse()
            .status(duplicate ? 409 : 503)
            .json({
            message: duplicate
                ? 'El registro ya existe. Actualiza los datos.'
                : 'No se pudo completar la operación en la base del sistema.',
        });
    }
};
exports.DatabaseErrorsFilter = DatabaseErrorsFilter;
exports.DatabaseErrorsFilter = DatabaseErrorsFilter = __decorate([
    (0, common_1.Catch)(typeorm_1.QueryFailedError)
], DatabaseErrorsFilter);
