<?php
require_once __DIR__.'/bootstrap.php';
function migrate(): void {
    $mysql=db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql';
    $id=$mysql?'INTEGER PRIMARY KEY AUTO_INCREMENT':'INTEGER PRIMARY KEY AUTOINCREMENT';
    $tables=[
      'seasons'=>"id $id, name VARCHAR(120) NOT NULL, active INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, timezone VARCHAR(80) NOT NULL DEFAULT 'America/New_York'",
      'categories'=>"id $id, name VARCHAR(120) NOT NULL, min_age INTEGER, max_age INTEGER, archived INTEGER NOT NULL DEFAULT 0",
      'competitions'=>"id $id, season_id INTEGER NOT NULL REFERENCES cup_seasons(id), category_id INTEGER NOT NULL REFERENCES cup_categories(id), format VARCHAR(20) NOT NULL DEFAULT 'groups', win_points INTEGER NOT NULL DEFAULT 3, draw_points INTEGER NOT NULL DEFAULT 1, loss_points INTEGER NOT NULL DEFAULT 0, duration INTEGER NOT NULL DEFAULT 90, group_count INTEGER NOT NULL DEFAULT 2, group_capacity INTEGER NOT NULL DEFAULT 4, qualifiers INTEGER NOT NULL DEFAULT 2, published INTEGER NOT NULL DEFAULT 0, historical INTEGER NOT NULL DEFAULT 0, UNIQUE(season_id,category_id)",
      'teams'=>"id $id, name VARCHAR(120) NOT NULL, crest VARCHAR(255), archived INTEGER NOT NULL DEFAULT 0",
      'entries'=>"id $id, competition_id INTEGER NOT NULL REFERENCES cup_competitions(id), team_id INTEGER NOT NULL REFERENCES cup_teams(id), UNIQUE(competition_id,team_id)",
      'players'=>"id $id, name VARCHAR(120) NOT NULL, birth_date VARCHAR(10), contact VARCHAR(160), archived INTEGER NOT NULL DEFAULT 0",
      'rosters'=>"id $id, entry_id INTEGER NOT NULL REFERENCES cup_entries(id), player_id INTEGER NOT NULL REFERENCES cup_players(id), number INTEGER NOT NULL, UNIQUE(entry_id,player_id), UNIQUE(entry_id,number)",
      'venues'=>"id $id, name VARCHAR(120) NOT NULL, address VARCHAR(255), archived INTEGER NOT NULL DEFAULT 0",
      'fields'=>"id $id, venue_id INTEGER NOT NULL REFERENCES cup_venues(id), name VARCHAR(120) NOT NULL, archived INTEGER NOT NULL DEFAULT 0",
      'groups'=>"id $id, competition_id INTEGER NOT NULL REFERENCES cup_competitions(id), name VARCHAR(80) NOT NULL, UNIQUE(competition_id,name)",
      'group_entries'=>"id $id, group_id INTEGER NOT NULL REFERENCES cup_groups(id), entry_id INTEGER NOT NULL REFERENCES cup_entries(id), UNIQUE(group_id,entry_id)",
      'users'=>"id $id, name VARCHAR(120) NOT NULL, email VARCHAR(160) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(15) NOT NULL, active INTEGER NOT NULL DEFAULT 1",
      'matches'=>"id $id, competition_id INTEGER NOT NULL REFERENCES cup_competitions(id), group_id INTEGER REFERENCES cup_groups(id), stage VARCHAR(20) NOT NULL DEFAULT 'group', round_no INTEGER NOT NULL DEFAULT 0, position_no INTEGER NOT NULL DEFAULT 0, home_entry_id INTEGER REFERENCES cup_entries(id), away_entry_id INTEGER REFERENCES cup_entries(id), field_id INTEGER REFERENCES cup_fields(id), scheduled_at VARCHAR(19), status VARCHAR(20) NOT NULL DEFAULT 'scheduled', elapsed_seconds INTEGER NOT NULL DEFAULT 0, clock_started_at VARCHAR(19), home_score INTEGER NOT NULL DEFAULT 0, away_score INTEGER NOT NULL DEFAULT 0, home_penalties INTEGER, away_penalties INTEGER, confirmed INTEGER NOT NULL DEFAULT 0, winner_entry_id INTEGER REFERENCES cup_entries(id), source_home_id INTEGER REFERENCES cup_matches(id), source_away_id INTEGER REFERENCES cup_matches(id), version INTEGER NOT NULL DEFAULT 0, updated_at VARCHAR(19) NOT NULL, historical_note TEXT",
      'assignments'=>"id $id, match_id INTEGER NOT NULL REFERENCES cup_matches(id), user_id INTEGER NOT NULL REFERENCES cup_users(id), UNIQUE(match_id,user_id)",
      'events'=>"id $id, match_id INTEGER NOT NULL REFERENCES cup_matches(id), entry_id INTEGER NOT NULL REFERENCES cup_entries(id), roster_id INTEGER REFERENCES cup_rosters(id), kind VARCHAR(15) NOT NULL, minute INTEGER NOT NULL, voided INTEGER NOT NULL DEFAULT 0, reason VARCHAR(255), request_key VARCHAR(80) NOT NULL UNIQUE, created_by INTEGER NOT NULL REFERENCES cup_users(id), created_at VARCHAR(19) NOT NULL",
      'requests'=>"id $id, request_key VARCHAR(80) NOT NULL UNIQUE, match_id INTEGER NOT NULL REFERENCES cup_matches(id), user_id INTEGER NOT NULL REFERENCES cup_users(id), payload_hash VARCHAR(64) NOT NULL, created_at VARCHAR(19) NOT NULL",
      'posters'=>"id $id, title VARCHAR(120) NOT NULL, alt VARCHAR(255) NOT NULL, image VARCHAR(255) NOT NULL, link VARCHAR(255), sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, starts_at VARCHAR(19), ends_at VARCHAR(19)",
      'audit'=>"id $id, user_id INTEGER REFERENCES cup_users(id), action VARCHAR(80) NOT NULL, entity VARCHAR(80) NOT NULL, entity_id INTEGER NOT NULL, details TEXT NOT NULL, created_at VARCHAR(19) NOT NULL",
      'legacy'=>"id $id, source_table VARCHAR(80) NOT NULL, source_id INTEGER NOT NULL, payload TEXT NOT NULL, note TEXT, UNIQUE(source_table,source_id)",
      'login_attempts'=>"id $id, identity_hash VARCHAR(64) NOT NULL, created_at VARCHAR(19) NOT NULL",
      'migrations'=>"id $id, version VARCHAR(80) NOT NULL UNIQUE, applied_at VARCHAR(19) NOT NULL",
    ];
    foreach($tables as $table=>$columns) {
        // MariaDB requires table-level foreign keys rather than inline REFERENCES.
        if ($mysql) {
            $fks=[];
            $columns=preg_replace_callback('/(\w+) INTEGER( NOT NULL)? REFERENCES (\w+)\(id\)/',function($m)use(&$fks){$fks[]='FOREIGN KEY ('.$m[1].') REFERENCES '.$m[3].'(id)'; return $m[1].' INTEGER'.($m[2]??'');},$columns);
            if($fks) $columns.=', '.implode(', ',$fks);
        }
        db()->exec('CREATE TABLE IF NOT EXISTS cup_'.$table.' ('.$columns.')'.($mysql?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci':''));
    }
    if(!row('SELECT id FROM cup_migrations WHERE version=?',['001_initial'])) insert('migrations',['version'=>'001_initial','applied_at'=>now()]);
    $indexes=[
      'cup_matches'=>['cup_matches_competition'=>['competition_id','stage','status'],'cup_matches_schedule'=>['scheduled_at','field_id']],
      'cup_events'=>['cup_events_match'=>['match_id','voided']],
      'cup_assignments'=>['cup_assignments_user'=>['user_id','match_id']],
      'cup_rosters'=>['cup_rosters_player'=>['player_id']],
      'cup_login_attempts'=>['cup_attempts_identity'=>['identity_hash','created_at']],
      'cup_audit'=>['cup_audit_created'=>['created_at']],
    ];
    foreach($indexes as $table=>$definitions){
        $existing=$mysql?array_column(rows('SHOW INDEX FROM '.$table),'Key_name'):array_column(rows('PRAGMA index_list('.$table.')'),'name');
        foreach($definitions as $name=>$columns)if(!in_array($name,$existing,true)) db()->exec('CREATE INDEX '.$name.' ON '.$table.' ('.implode(',',$columns).')');
    }
    if(!row('SELECT id FROM cup_migrations WHERE version=?',['002_query_indexes'])) insert('migrations',['version'=>'002_query_indexes','applied_at'=>now()]);
}
