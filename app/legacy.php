<?php
require_once __DIR__.'/bootstrap.php';
function parse_legacy_dump(string $path): array {
    $sql=file_get_contents($path); need($sql!==false,'No se pudo leer el SQL.');$tables=[];
    // Only extract literal INSERT data from known tables. Never execute supplied SQL.
    preg_match_all('/INSERT INTO `(categories|groups|group_teams|teams|games|goals|team_stats)`\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*?);/',$sql,$sets,PREG_SET_ORDER);
    foreach($sets as $set) {
        preg_match_all('/`([^`]+)`/',$set[2],$cols);preg_match_all("/\(((?:'(?:[^'\\\\]|\\\\.|'')*'|[^()])*)\)/s",$set[3],$tuples);
        foreach($tuples[1] as $tuple) {
            $vals=str_getcsv($tuple,',',"'",'\\');
            $vals=array_map(function($x){$x=trim($x);return $x==='NULL'?null:str_replace(["\\'",'\\\\'],["'",'\\'],$x);},$vals);
            need(count($vals)===count($cols[1]),'Fila SQL no reconocida.');$tables[$set[1]][]=array_combine($cols[1],$vals);
        }
    }
    need(!empty($tables['teams'])&&!empty($tables['categories']),'El archivo no contiene la estructura esperada.');return $tables;
}
function import_legacy(string $path): array {
    $tables=parse_legacy_dump($path);
    return transaction(function()use($tables){
        need(!row('SELECT id FROM cup_legacy LIMIT 1'),'El historial ya está importado.');
        $sid=insert('seasons',['name'=>'Historical import','archived'=>1,'active'=>0]);$map=[];
        foreach($tables['categories'] as $r){$id=insert('categories',['name'=>$r['name']]);$map['categories'][$r['id']]=$id;$map['competitions'][$r['id']]=insert('competitions',['season_id'=>$sid,'category_id'=>$id,'historical'=>1,'published'=>1]);}
        foreach($tables['teams'] as $r)$map['teams'][$r['id']]=insert('teams',['name'=>$r['name']]);
        foreach($tables['groups']??[] as $r)$map['groups'][$r['id']]=insert('groups',['competition_id'=>$map['competitions'][$r['category_id']],'name'=>$r['name']]);
        foreach($tables['group_teams']??[] as $r){
            $g=row('SELECT competition_id FROM cup_groups WHERE id=?',[$map['groups'][$r['group_id']]]);$cid=$g['competition_id'];$tid=$map['teams'][$r['team_id']];
            $entry=row('SELECT id FROM cup_entries WHERE competition_id=? AND team_id=?',[$cid,$tid]);
            $eid=$entry?(int)$entry['id']:insert('entries',['competition_id'=>$cid,'team_id'=>$tid]);
            insert('group_entries',['group_id'=>$map['groups'][$r['group_id']],'entry_id'=>$eid]);$map['entries'][$r['team_id']][$cid]=$eid;
        }
        $ambiguous=0;
        foreach($tables['games']??[] as $r){
            $home=$map['entries'][$r['home_team_id']]??[];$away=$map['entries'][$r['guest_team_id']]??[];$common=array_intersect(array_keys($home),array_keys($away));
            if(count($common)!==1){$ambiguous++;continue;}$cid=(int)array_values($common)[0];
            $groups=rows('SELECT a.group_id FROM cup_group_entries a JOIN cup_group_entries b ON b.group_id=a.group_id WHERE a.entry_id=? AND b.entry_id=?',[$home[$cid],$away[$cid]]);
            $field=null;
            if(!empty($r['field'])){
                $venue=$map['venue']??=insert('venues',['name'=>'Imported venue']);
                $field=$map['fields'][$r['field']]??=insert('fields',['venue_id'=>$venue,'name'=>$r['field']]);
            }
            $status=['not started'=>'scheduled','in progress'=>'live','ended'=>'finished','finished'=>'finished','half-time'=>'half_time','paused'=>'paused'][$r['status']]??'scheduled';
            $map['games'][$r['id']]=new_match($cid,$home[$cid],$away[$cid],['group_id'=>count($groups)===1?$groups[0]['group_id']:null,'home_score'=>(int)$r['home_score'],'away_score'=>(int)$r['guest_score'],'status'=>$status,'elapsed_seconds'=>(int)$r['current_minute']*60,'field_id'=>$field,'historical_note'=>'Imported: no reliable scheduled time or event reconciliation; original data retained.']);
        }
        foreach($tables as $table=>$records)foreach($records as $r){$sourceId=(int)($r['id']??$r['team_id']);insert('legacy',['source_table'=>$table,'source_id'=>$sourceId,'payload'=>json_encode($r,JSON_UNESCAPED_UNICODE),'note'=>json_encode(['target_id'=>$map[$table][$sourceId]??null])]);}
        return ['season_id'=>$sid,'teams'=>count($tables['teams']),'matches'=>count($map['games']??[]),'ambiguous_matches'=>$ambiguous];
    });
}
