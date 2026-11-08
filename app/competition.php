<?php
declare(strict_types=1);

function competition(int $id): array {
    $c=row('SELECT c.*,s.archived,s.active,s.timezone,s.name AS season_name,k.name AS category_name FROM cup_competitions c JOIN cup_seasons s ON s.id=c.season_id JOIN cup_categories k ON k.id=c.category_id WHERE c.id=?',[$id]);
    need((bool)$c,'Competición no encontrada.'); return $c;
}
function editable_competition(int $id): array { $c=competition($id); need(!$c['historical']&&!$c['archived'],'El historial es de solo lectura.'); return $c; }
function standings(int $competitionId,bool $provisional=false): array {
    $c=competition($competitionId);
    $list=rows('SELECT e.id,e.team_id,t.name,t.crest,g.id AS group_id,g.name AS group_name FROM cup_entries e JOIN cup_teams t ON t.id=e.team_id LEFT JOIN cup_group_entries ge ON ge.entry_id=e.id LEFT JOIN cup_groups g ON g.id=ge.group_id WHERE e.competition_id=? ORDER BY t.name',[$competitionId]);
    $table=[];
    foreach($list as $e) $table[$e['id']]=$e+array_fill_keys(['played','wins','draws','losses','gf','ga','gd','points','goals'],0);
    $matches=rows("SELECT * FROM cup_matches WHERE competition_id=? AND stage='group' AND ".($provisional?"status IN ('live','half_time','paused','finished')":"confirmed=1 AND status='finished'"),[$competitionId]);
    foreach($matches as $m) {
        $home=(int)$m['home_entry_id']; $away=(int)$m['away_entry_id'];
        if(!isset($table[$home],$table[$away])) continue;
        foreach([[$home,$m['home_score'],$m['away_score']],[$away,$m['away_score'],$m['home_score']]] as [$id,$gf,$ga]) {
            $r=&$table[$id]; $r['played']++; $r['gf']+=(int)$gf; $r['ga']+=(int)$ga; $r['gd']=$r['gf']-$r['ga'];
            $result=$gf>$ga?'wins':($gf==$ga?'draws':'losses'); $r[$result]++;
            $r['points']+=(int)$c[$gf>$ga?'win_points':($gf==$ga?'draw_points':'loss_points')]; unset($r);
        }
    }
    $list=array_values($table);
    usort($list,'compare_standing');
    return $list;
}
function draw_preview(int $id,bool $random,array $order=[]): array {
    $c=editable_competition($id);
    need(!row("SELECT id FROM cup_matches WHERE competition_id=? AND status<>'scheduled' AND NOT (stage='knockout' AND away_entry_id IS NULL AND source_home_id IS NULL AND confirmed=1)",[$id]),'No puedes sortear después de iniciar partidos.');
    need(!row('SELECT id FROM cup_matches WHERE competition_id=? AND (field_id IS NOT NULL OR scheduled_at IS NOT NULL)',[$id]),'Retira la programación antes de reemplazar el sorteo.');
    $ids=array_map('intval',array_column(rows('SELECT id FROM cup_entries WHERE competition_id=? ORDER BY id',[$id]),'id'));
    need(count($ids)>=2 && count($ids)<=512,'Inscribe entre dos y 512 equipos.');
    if($random) { for($i=count($ids)-1;$i>0;$i--){$j=random_int(0,$i);[$ids[$i],$ids[$j]]=[$ids[$j],$ids[$i]];} }
    else { $sorted=$ids; sort($sorted); $test=$order; sort($test); need($test===$sorted,'El orden manual debe incluir cada inscripción exactamente una vez.'); $ids=$order; }
    $groups=[];
    if($c['format']==='groups') {
        $count=(int)$c['group_count'];
        need($count>0 && count($ids)>=$count*2 && count($ids)<=$count*(int)$c['group_capacity'],'Cada grupo necesita al menos dos equipos y capacidad suficiente.');
        foreach($ids as $i=>$entry) $groups[$i%$count][]=$entry;
        foreach($groups as $g) need((int)$c['qualifiers']<count($g),'Deben clasificar menos equipos que los inscritos en cada grupo.');
    }
    return ['competition_id'=>$id,'entries'=>$ids,'groups'=>$groups,'fingerprint'=>hash('sha256',json_encode([$c,rows('SELECT id,team_id FROM cup_entries WHERE competition_id=? ORDER BY id',[$id])]))];
}
function new_match(int $cid,?int $home,?int $away,array $extra=[]): int {
    return insert('matches',$extra+['competition_id'=>$cid,'home_entry_id'=>$home,'away_entry_id'=>$away,'updated_at'=>now()]);
}
function create_knockout(int $cid,array $ids): void {
    need(count($ids)>=2 && count(array_unique($ids))===count($ids),'Clasificados inválidos.');
    $previous=[];
    foreach(knockout_pairs($ids) as $p=>[$home,$away]) {
        $extra=['stage'=>'knockout','round_no'=>1,'position_no'=>$p+1];
        if(!$away) $extra+=['status'=>'finished','confirmed'=>1,'winner_entry_id'=>$home];
        $previous[]=new_match($cid,$home,$away,$extra);
    }
    $round=2;
    while(count($previous)>1) {
        $next=[];
        for($i=0;$i<count($previous);$i+=2) $next[]=new_match($cid,null,null,['stage'=>'knockout','round_no'=>$round,'position_no'=>intdiv($i,2)+1,'source_home_id'=>$previous[$i],'source_away_id'=>$previous[$i+1]]);
        $previous=$next; $round++;
    }
    advance_winners($cid);
}
function advance_winners(int $cid): void {
    foreach(rows("SELECT * FROM cup_matches WHERE competition_id=? AND stage='knockout' ORDER BY round_no,position_no",[$cid]) as $m) {
        foreach(['home','away'] as $side) {
            if(!$m['source_'.$side.'_id']) continue;
            $source=row('SELECT confirmed,winner_entry_id FROM cup_matches WHERE id=?',[$m['source_'.$side.'_id']]);
            if($source['confirmed']) execute('UPDATE cup_matches SET '.$side.'_entry_id=?,updated_at=? WHERE id=?',[$source['winner_entry_id'],now(),$m['id']]);
        }
    }
}
function commit_draw(array $preview,int $uid): void {
    transaction(function()use($preview,$uid){
        $cid=(int)$preview['competition_id']; $c=editable_competition($cid);
        $fresh=draw_preview($cid,false,$preview['entries']);
        need(hash_equals($fresh['fingerprint'],$preview['fingerprint']),'Los equipos o reglas cambiaron. Genera otra vista previa.');
        foreach(rows('SELECT id FROM cup_matches WHERE competition_id=?',[$cid]) as $m) {
            execute('DELETE FROM cup_assignments WHERE match_id=?',[$m['id']]);
        }
        execute('UPDATE cup_matches SET source_home_id=NULL,source_away_id=NULL WHERE competition_id=?',[$cid]);
        execute('DELETE FROM cup_matches WHERE competition_id=?',[$cid]);
        execute('DELETE FROM cup_group_entries WHERE group_id IN (SELECT id FROM cup_groups WHERE competition_id=?)',[$cid]);
        execute('DELETE FROM cup_groups WHERE competition_id=?',[$cid]);
        if($c['format']==='groups') {
            foreach($preview['groups'] as $i=>$ids) {
                $gid=insert('groups',['competition_id'=>$cid,'name'=>'Group '.($i+1)]);
                foreach($ids as $entry) insert('group_entries',['group_id'=>$gid,'entry_id'=>$entry]);
                for($a=0;$a<count($ids);$a++) for($b=$a+1;$b<count($ids);$b++) new_match($cid,$ids[$a],$ids[$b],['group_id'=>$gid]);
            }
        } else create_knockout($cid,$preview['entries']);
        execute('UPDATE cup_competitions SET published=1 WHERE id=?',[$cid]);
        audit($uid,'draw.publish','competition',$cid,$preview);
    });
}
function qualify(int $cid,array $ids,int $uid): void {
    transaction(function()use($cid,$ids,$uid){
        $c=editable_competition($cid);
        need($c['format']==='groups','Esta competición no tiene grupos.');
        need(!row("SELECT id FROM cup_matches WHERE competition_id=? AND stage='knockout'",[$cid]),'Las llaves ya están creadas.');
        need((bool)row("SELECT id FROM cup_matches WHERE competition_id=? AND stage='group'",[$cid]),'Primero genera los grupos.');
        need(!row("SELECT id FROM cup_matches WHERE competition_id=? AND stage='group' AND confirmed=0",[$cid]),'Confirma todos los resultados de grupos.');
        $groups=[]; foreach(standings($cid) as $entry) $groups[$entry['group_id']][]=$entry;
        need(count($ids)===count($groups)*(int)$c['qualifiers'] && count(array_unique($ids))===count($ids),'Cantidad de clasificados incorrecta.');
        foreach($groups as $entries) {
            $chosen=array_values(array_filter($entries,fn($e)=>in_array((int)$e['id'],$ids,true)));
            need(count($chosen)===(int)$c['qualifiers'],'Selecciona los clasificados de cada grupo.');
            $cutoff=$entries[(int)$c['qualifiers']-1];
            foreach($entries as $e) {
                $rank=[$e['points'],$e['gd'],$e['gf']]; $cut=[$cutoff['points'],$cutoff['gd'],$cutoff['gf']];
                if($rank>$cut) need(in_array((int)$e['id'],$ids,true),'No puedes excluir un equipo mejor clasificado.');
                if(in_array((int)$e['id'],$ids,true)) need($rank>=$cut,'Ese equipo no alcanza la posición clasificatoria.');
            }
        }
        create_knockout($cid,$ids); audit($uid,'qualifiers.confirm','competition',$cid,['seed_order'=>$ids]);
    });
}
function schedule_match(int $id,?int $field,?string $date,int $uid): void {
    transaction(function()use($id,$field,$date,$uid){
        $m=locked_match($id); editable_competition((int)$m['competition_id']);
        need($m['status']==='scheduled','Solo puedes programar partidos pendientes.');
        if($field) need((bool)row('SELECT id FROM cup_fields WHERE id=? AND archived=0',[$field]),'Cancha no disponible.');
        if($date) {
            need((bool)preg_match('/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/',$date) && strtotime($date.' UTC')!==false,'Fecha inválida.');
            $start=strtotime($date.' UTC'); $end=$start+(int)competition((int)$m['competition_id'])['duration']*60;
            // Serialize scheduling across competitions and fields on MySQL.
            if(db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql') rows('SELECT id FROM cup_seasons ORDER BY id FOR UPDATE');
            $others=rows("SELECT m.*,c.duration FROM cup_matches m JOIN cup_competitions c ON c.id=m.competition_id WHERE m.id<>? AND m.scheduled_at IS NOT NULL AND m.status<>'suspended' AND c.historical=0",[$id]);
            foreach($others as $other) {
                $a=strtotime($other['scheduled_at'].' UTC'); $b=$a+(int)$other['duration']*60;
                if($a>=$end || $b<=$start) continue;
                need(!$field || (int)$other['field_id']!==$field,'La cancha tiene otro partido a esa hora.');
                foreach(['home_entry_id','away_entry_id'] as $side) if($m[$side]) {
                    $team=row('SELECT team_id FROM cup_entries WHERE id=?',[$m[$side]])['team_id'];
                    $opponents=rows('SELECT team_id FROM cup_entries WHERE id IN (?,?)',[$other['home_entry_id'],$other['away_entry_id']]);
                    need(!in_array($team,array_column($opponents,'team_id')),'Un equipo ya tiene otro partido a esa hora.');
                }
            }
        }
        execute('UPDATE cup_matches SET field_id=?,scheduled_at=?,updated_at=? WHERE id=?',[$field,$date,now(),$id]);
        audit($uid,'schedule','match',$id,['field'=>$field,'date'=>$date]);
    });
}
