import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Sports1794225700000 implements MigrationInterface {
  transaction = false;
  async up(q: QueryRunner) {
    for (const [table, index, columns] of [
      ['smc_entries', 'entry_comp', 'id,competition_id'],
      ['smc_groups', 'group_comp', 'id,competition_id'],
    ]) {
      const indexes = await q.query(
        'SELECT INDEX_NAME FROM information_schema.statistics WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?',
        [table, index],
      );
      if (!indexes.length)
        await q.query(
          `ALTER TABLE ${table} ADD UNIQUE INDEX ${index} (${columns})`,
        );
    }
    const tables = [
      `smc_players (id CHAR(36) PRIMARY KEY,name VARCHAR(120) NOT NULL,birth_date DATE,contact VARCHAR(160),archived BOOLEAN NOT NULL DEFAULT 0,version INT NOT NULL DEFAULT 0,created_at DATETIME(3) NOT NULL)`,
      `smc_rosters (id CHAR(36) PRIMARY KEY,entry_id CHAR(36) NOT NULL,competition_id CHAR(36) NOT NULL,player_id CHAR(36) NOT NULL,number INT NOT NULL,version INT NOT NULL DEFAULT 0,FOREIGN KEY(entry_id,competition_id) REFERENCES smc_entries(id,competition_id),FOREIGN KEY(player_id) REFERENCES smc_players(id),UNIQUE(competition_id,player_id),UNIQUE(entry_id,number),UNIQUE(id,entry_id),CHECK(number BETWEEN 0 AND 999))`,
      `smc_venues (id CHAR(36) PRIMARY KEY,name VARCHAR(120) NOT NULL,address VARCHAR(255),archived BOOLEAN NOT NULL DEFAULT 0,version INT NOT NULL DEFAULT 0)`,
      `smc_fields (id CHAR(36) PRIMARY KEY,venue_id CHAR(36) NOT NULL,name VARCHAR(120) NOT NULL,archived BOOLEAN NOT NULL DEFAULT 0,version INT NOT NULL DEFAULT 0,FOREIGN KEY(venue_id) REFERENCES smc_venues(id))`,
      `smc_group_entries (id CHAR(36) PRIMARY KEY,group_id CHAR(36) NOT NULL,entry_id CHAR(36) NOT NULL,competition_id CHAR(36) NOT NULL,FOREIGN KEY(group_id,competition_id) REFERENCES smc_groups(id,competition_id),FOREIGN KEY(entry_id,competition_id) REFERENCES smc_entries(id,competition_id),UNIQUE(competition_id,entry_id))`,
      `smc_matches (id CHAR(36) PRIMARY KEY,competition_id CHAR(36) NOT NULL,group_id CHAR(36),stage VARCHAR(20) NOT NULL DEFAULT 'group',round_no INT NOT NULL DEFAULT 0,position_no INT NOT NULL DEFAULT 0,home_entry_id CHAR(36),away_entry_id CHAR(36),source_home_id CHAR(36),source_away_id CHAR(36),field_id CHAR(36),scheduled_at DATETIME(3),status VARCHAR(20) NOT NULL DEFAULT 'scheduled',elapsed_seconds INT NOT NULL DEFAULT 0,clock_started_at DATETIME(3),home_score INT NOT NULL DEFAULT 0,away_score INT NOT NULL DEFAULT 0,home_penalties INT,away_penalties INT,confirmed BOOLEAN NOT NULL DEFAULT 0,winner_entry_id CHAR(36),version INT NOT NULL DEFAULT 0,updated_at DATETIME(3) NOT NULL,knockout_slot VARCHAR(30) GENERATED ALWAYS AS (CASE WHEN stage='knockout' THEN CONCAT(round_no,':',position_no) ELSE NULL END) VIRTUAL,UNIQUE(id,competition_id),UNIQUE(competition_id,knockout_slot),FOREIGN KEY(competition_id) REFERENCES smc_competitions(id),FOREIGN KEY(group_id,competition_id) REFERENCES smc_groups(id,competition_id),FOREIGN KEY(home_entry_id,competition_id) REFERENCES smc_entries(id,competition_id),FOREIGN KEY(away_entry_id,competition_id) REFERENCES smc_entries(id,competition_id),FOREIGN KEY(winner_entry_id,competition_id) REFERENCES smc_entries(id,competition_id),FOREIGN KEY(source_home_id,competition_id) REFERENCES smc_matches(id,competition_id),FOREIGN KEY(source_away_id,competition_id) REFERENCES smc_matches(id,competition_id),FOREIGN KEY(field_id) REFERENCES smc_fields(id),CHECK(stage IN ('group','knockout')),CHECK(status IN ('scheduled','live','half_time','paused','finished','suspended')),CHECK(home_entry_id IS NULL OR away_entry_id IS NULL OR home_entry_id<>away_entry_id),CHECK(elapsed_seconds>=0 AND home_score>=0 AND away_score>=0),INDEX match_comp(competition_id,status),INDEX match_schedule(scheduled_at,field_id))`,
      `smc_assignments (match_id CHAR(36) PRIMARY KEY,user_id CHAR(36) NOT NULL,FOREIGN KEY(match_id) REFERENCES smc_matches(id),FOREIGN KEY(user_id) REFERENCES smc_users(id),INDEX assigned_user(user_id))`,
      `smc_events (id CHAR(36) PRIMARY KEY,match_id CHAR(36) NOT NULL,competition_id CHAR(36) NOT NULL,entry_id CHAR(36) NOT NULL,roster_id CHAR(36),kind VARCHAR(15) NOT NULL,minute INT NOT NULL,created_by CHAR(36) NOT NULL,created_at DATETIME(3) NOT NULL,voided_at DATETIME(3),voided_by CHAR(36),reason VARCHAR(255),FOREIGN KEY(match_id,competition_id) REFERENCES smc_matches(id,competition_id),FOREIGN KEY(entry_id,competition_id) REFERENCES smc_entries(id,competition_id),FOREIGN KEY(roster_id,entry_id) REFERENCES smc_rosters(id,entry_id),FOREIGN KEY(created_by) REFERENCES smc_users(id),FOREIGN KEY(voided_by) REFERENCES smc_users(id),CHECK(kind IN ('goal','own_goal')),CHECK(minute BETWEEN 0 AND 300),INDEX events_match(match_id,voided_at))`,
      `smc_operations (request_key VARCHAR(80) PRIMARY KEY,actor_id CHAR(36) NOT NULL,action VARCHAR(80) NOT NULL,aggregate_id CHAR(36) NOT NULL,payload_hash CHAR(64) NOT NULL,response JSON NOT NULL,created_at DATETIME(3) NOT NULL,FOREIGN KEY(actor_id) REFERENCES smc_users(id))`,
      `smc_draw_previews (id CHAR(36) PRIMARY KEY,competition_id CHAR(36) NOT NULL,actor_id CHAR(36) NOT NULL,fingerprint CHAR(64) NOT NULL,payload JSON NOT NULL,expires_at DATETIME(3) NOT NULL,consumed BOOLEAN NOT NULL DEFAULT 0,FOREIGN KEY(competition_id) REFERENCES smc_competitions(id),FOREIGN KEY(actor_id) REFERENCES smc_users(id))`,
    ];
    for (const table of tables)
      await q.query(
        'CREATE TABLE IF NOT EXISTS ' +
          table +
          ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      );
  }
  async down(): Promise<void> {
    throw Error(
      'Restore a verified backup into a separate database; destructive rollback is disabled.',
    );
  }
}
