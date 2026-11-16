import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Imports1794225800000 implements MigrationInterface {
  transaction = false;
  async up(q: QueryRunner) {
    const tables = [
      `smc_import_batches (id CHAR(64) PRIMARY KEY,source_hash CHAR(64) NOT NULL,status VARCHAR(15) NOT NULL,plan JSON NOT NULL,created_by CHAR(36) NOT NULL,created_at DATETIME(3) NOT NULL,error_code VARCHAR(40),season_id CHAR(36),promotion_hash CHAR(64),baseline_policy VARCHAR(30),FOREIGN KEY(created_by) REFERENCES smc_users(id),FOREIGN KEY(season_id) REFERENCES smc_seasons(id),CHECK(status IN ('staged','failed','promoted')),INDEX import_source(source_hash))`,
      `smc_legacy_records (batch_id CHAR(64) NOT NULL,source_table VARCHAR(20) NOT NULL,row_no INT NOT NULL,source_id BIGINT NOT NULL,payload JSON NOT NULL,payload_hash CHAR(64) NOT NULL,PRIMARY KEY(batch_id,source_table,row_no),FOREIGN KEY(batch_id) REFERENCES smc_import_batches(id))`,
      `smc_import_decisions (id CHAR(36) PRIMARY KEY,batch_id CHAR(64) NOT NULL,source_team_id BIGINT NOT NULL,revision INT NOT NULL,mode VARCHAR(15) NOT NULL,chosen_values JSON NOT NULL,reason VARCHAR(1000) NOT NULL,actor_id CHAR(36) NOT NULL,created_at DATETIME(3) NOT NULL,UNIQUE(batch_id,source_team_id,revision),FOREIGN KEY(batch_id) REFERENCES smc_import_batches(id),FOREIGN KEY(actor_id) REFERENCES smc_users(id),CHECK(mode IN ('preserve','correct')))`,
      `smc_legacy_mappings (batch_id CHAR(64) NOT NULL,source_table VARCHAR(20) NOT NULL,source_id BIGINT NOT NULL,target_table VARCHAR(30) NOT NULL,target_id CHAR(36) NOT NULL,PRIMARY KEY(batch_id,source_table,source_id,target_table,target_id),FOREIGN KEY(batch_id) REFERENCES smc_import_batches(id))`,
      `smc_legacy_stats (id CHAR(36) PRIMARY KEY,batch_id CHAR(64) NOT NULL,source_team_id BIGINT NOT NULL,team_id CHAR(36) NOT NULL,entry_id CHAR(36) NOT NULL UNIQUE,original_values JSON NOT NULL,reviewed_values JSON NOT NULL,decision_id CHAR(36) NOT NULL,UNIQUE(batch_id,source_team_id),FOREIGN KEY(batch_id) REFERENCES smc_import_batches(id),FOREIGN KEY(team_id) REFERENCES smc_teams(id),FOREIGN KEY(entry_id) REFERENCES smc_entries(id),FOREIGN KEY(decision_id) REFERENCES smc_import_decisions(id))`,
    ];
    for (const table of tables)
      await q.query(
        'CREATE TABLE IF NOT EXISTS ' +
          table +
          ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      );
  }
  async down(): Promise<void> {
    throw Error('Restore a verified backup into a separate database.');
  }
}
