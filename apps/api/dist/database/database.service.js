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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
exports.databaseType = databaseType;
exports.createDataSource = createDataSource;
exports.audit = audit;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const _1794225800000_imports_1 = require("./migrations/1794225800000-imports");
const _1794225700000_sports_1 = require("./migrations/1794225700000-sports");
const _1794225600000_foundation_1 = require("./migrations/1794225600000-foundation");
function databaseType(env = process.env) {
    const type = env.APP_DB_TYPE || 'mysql';
    if (type !== 'mysql' && type !== 'mariadb')
        throw Error('APP_DB_TYPE must be mysql or mariadb.');
    return type;
}
function createDataSource() {
    if (!process.env.APP_DB_NAME)
        throw new common_1.ServiceUnavailableException('La base del sistema no está configurada.');
    if (process.env.APP_DB_NAME === process.env.LEGACY_DB_NAME &&
        (process.env.APP_DB_HOST || '127.0.0.1') ===
            (process.env.LEGACY_DB_HOST || '127.0.0.1') &&
        (process.env.APP_DB_PORT || '3306') ===
            (process.env.LEGACY_DB_PORT || '3306'))
        throw new Error('Use a separate database for the new system.');
    return new typeorm_1.DataSource({
        type: databaseType(),
        host: process.env.APP_DB_HOST || '127.0.0.1',
        port: Number(process.env.APP_DB_PORT || 3306),
        username: process.env.APP_DB_USER,
        password: process.env.APP_DB_PASSWORD,
        database: process.env.APP_DB_NAME,
        charset: 'utf8mb4',
        timezone: 'Z',
        synchronize: false,
        migrationsRun: false,
        migrations: [
            _1794225600000_foundation_1.Foundation1794225600000,
            _1794225700000_sports_1.Sports1794225700000,
            _1794225800000_imports_1.Imports1794225800000,
        ],
        migrationsTableName: 'smc_migrations',
        migrationsTransactionMode: 'none',
        extra: { connectionLimit: 5, multipleStatements: false },
    });
}
let DatabaseService = class DatabaseService {
    connection;
    async get() {
        this.connection ??= Promise.resolve()
            .then(async () => {
            const source = createDataSource();
            try {
                return await source.initialize();
            }
            catch {
                throw new common_1.ServiceUnavailableException('La base del sistema no está disponible.');
            }
        })
            .catch((e) => {
            this.connection = undefined;
            throw e;
        });
        return this.connection;
    }
    async query(sql, params = []) {
        return (await this.get()).query(sql, params);
    }
    async transaction(fn) {
        return (await this.get()).transaction('READ COMMITTED', fn);
    }
    async snapshot(fn) {
        return (await this.get()).transaction('REPEATABLE READ', fn);
    }
    async onModuleDestroy() {
        if (this.connection) {
            try {
                const source = await this.connection;
                if (source.isInitialized)
                    await source.destroy();
            }
            catch { }
        }
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = __decorate([
    (0, common_1.Injectable)()
], DatabaseService);
async function audit(tx, actorId, action, entity, id, details = {}) {
    const { randomUUID } = await Promise.resolve().then(() => __importStar(require('node:crypto')));
    await tx.query('INSERT INTO smc_audit(id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(3))', [randomUUID(), actorId, action, entity, id, JSON.stringify(details)]);
}
