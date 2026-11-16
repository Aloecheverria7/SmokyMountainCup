"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Foundation1794225600000 = void 0;
const node_crypto_1 = require("node:crypto");
/** MariaDB DDL commits implicitly; each statement is restartable. Never touches legacy tables. */
class Foundation1794225600000 {
    transaction = false;
    async up(runner) {
        const suffix = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        const tables = [
            `smc_mutex (id INT PRIMARY KEY)`,
            `smc_users (id CHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(160) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(15) NOT NULL, active BOOLEAN NOT NULL DEFAULT 1, must_change_password BOOLEAN NOT NULL DEFAULT 0, auth_version INT NOT NULL DEFAULT 0, version INT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL, CHECK (role IN ('admin','scorer')))`,
            `smc_sessions (token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL, auth_version INT NOT NULL, created_at DATETIME(3) NOT NULL, last_seen_at DATETIME(3) NOT NULL, expires_at DATETIME(3) NOT NULL, FOREIGN KEY (user_id) REFERENCES smc_users(id), INDEX sessions_user(user_id), INDEX sessions_expiry(expires_at))`,
            `smc_seasons (id CHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, timezone VARCHAR(80) NOT NULL, active BOOLEAN NOT NULL DEFAULT 0, archived BOOLEAN NOT NULL DEFAULT 0, version INT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL, active_slot INT GENERATED ALWAYS AS (CASE WHEN active=1 THEN 1 ELSE NULL END) VIRTUAL, UNIQUE(active_slot), CHECK (NOT (active=1 AND archived=1)))`,
            `smc_categories (id CHAR(36) PRIMARY KEY, slug VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL)`,
            `smc_competitions (id CHAR(36) PRIMARY KEY, season_id CHAR(36) NOT NULL, category_id CHAR(36) NOT NULL, format VARCHAR(20) NOT NULL DEFAULT 'groups', group_count INT NOT NULL DEFAULT 2, duration INT NOT NULL DEFAULT 90, win_points INT NOT NULL DEFAULT 3, draw_points INT NOT NULL DEFAULT 1, loss_points INT NOT NULL DEFAULT 0, group_capacity INT NOT NULL DEFAULT 4, qualifiers INT NOT NULL DEFAULT 2, rules_confirmed BOOLEAN NOT NULL DEFAULT 0, published BOOLEAN NOT NULL DEFAULT 0, version INT NOT NULL DEFAULT 0, FOREIGN KEY (season_id) REFERENCES smc_seasons(id), FOREIGN KEY (category_id) REFERENCES smc_categories(id), UNIQUE(season_id,category_id), CHECK (format='groups' AND group_count=2), CHECK (duration BETWEEN 10 AND 180), CHECK (group_capacity BETWEEN 2 AND 32), CHECK (qualifiers>=1 AND qualifiers<group_capacity))`,
            `smc_groups (id CHAR(36) PRIMARY KEY, competition_id CHAR(36) NOT NULL, name VARCHAR(10) NOT NULL, FOREIGN KEY (competition_id) REFERENCES smc_competitions(id), UNIQUE(competition_id,name), CHECK (name IN ('A','B')))`,
            `smc_teams (id CHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, archived BOOLEAN NOT NULL DEFAULT 0, version INT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL)`,
            `smc_entries (id CHAR(36) PRIMARY KEY, competition_id CHAR(36) NOT NULL, team_id CHAR(36) NOT NULL, created_at DATETIME(3) NOT NULL, FOREIGN KEY (competition_id) REFERENCES smc_competitions(id), FOREIGN KEY (team_id) REFERENCES smc_teams(id), UNIQUE(competition_id,team_id))`,
            `smc_audit (id CHAR(36) PRIMARY KEY, seq BIGINT NOT NULL AUTO_INCREMENT UNIQUE, actor_id CHAR(36), action VARCHAR(80) NOT NULL, entity VARCHAR(40) NOT NULL, entity_id CHAR(36) NOT NULL, details JSON NOT NULL, created_at DATETIME(3) NOT NULL, FOREIGN KEY (actor_id) REFERENCES smc_users(id), INDEX audit_time(created_at,id))`,
        ];
        for (const table of tables)
            await runner.query('CREATE TABLE IF NOT EXISTS ' + table + suffix);
        await runner.query('INSERT IGNORE INTO smc_mutex(id) VALUES (1)');
        for (const [slug, name] of [
            ['infantil', 'Infantil'],
            ['junior', 'Junior'],
            ['adulto', 'Adulto'],
            ['femenino', 'Femenino'],
        ]) {
            await runner.query('INSERT IGNORE INTO smc_categories(id,slug,name) VALUES (?,?,?)', [(0, node_crypto_1.randomUUID)(), slug, name]);
        }
    }
    async down() {
        throw new Error('Destructive rollback is disabled. Restore a verified backup into a separate database.');
    }
}
exports.Foundation1794225600000 = Foundation1794225600000;
