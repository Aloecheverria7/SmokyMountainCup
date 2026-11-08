<?php
declare(strict_types=1);

function locked_match(int $id): array {
    $suffix=db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':'';
    $m=row('SELECT * FROM cup_matches WHERE id=?'.$suffix,[$id]); need((bool)$m,'Partido no encontrado.'); return $m;
}
function match_permission(array $m,array $u): void {
    editable_competition((int)$m['competition_id']);
    if($u['role']!=='admin') need((bool)row('SELECT id FROM cup_assignments WHERE match_id=? AND user_id=?',[$m['id'],$u['id']]),'No tienes asignado este partido.');
}
function elapsed(array $m): int {
    return clock_seconds($m,time());
}
function score_match(int $id): void {
    $m=row('SELECT * FROM cup_matches WHERE id=?',[$id]); $scores=[(int)$m['home_entry_id']=>0,(int)$m['away_entry_id']=>0];
    foreach(rows('SELECT entry_id,kind FROM cup_events WHERE match_id=? AND voided=0',[$id]) as $e) {
        $entry=(int)$e['entry_id'];
        if($e['kind']==='own_goal') $entry=$entry===(int)$m['home_entry_id']?(int)$m['away_entry_id']:(int)$m['home_entry_id'];
        $scores[$entry]++;
    }
    execute('UPDATE cup_matches SET home_score=?,away_score=?,updated_at=?,version=version+1 WHERE id=?',[$scores[(int)$m['home_entry_id']],$scores[(int)$m['away_entry_id']],now(),$id]);
}
function match_action(array $data,array $u): array {
    $id=positive($data['match_id']??0); $action=(string)($data['action']??'');
    $key=text($data['request_key']??'',80); need((bool)preg_match('/^[a-zA-Z0-9_-]{16,80}$/',$key),'Clave de operación inválida.');
    $hash=hash('sha256',json_encode($data));
    return transaction(function()use($data,$u,$id,$action,$key,$hash){
        $m=locked_match($id); match_permission($m,$u);
        $old=row('SELECT * FROM cup_requests WHERE request_key=?',[$key]);
        if($old) { need((int)$old['match_id']===$id && (int)$old['user_id']===(int)$u['id'] && hash_equals($old['payload_hash'],$hash),'Clave de operación reutilizada.'); return ['id'=>$id,'duplicate'=>true]; }
        need((int)($data['version']??-1)===(int)$m['version'],'El partido cambió en otro dispositivo. Actualiza antes de continuar.');
        $c=competition((int)$m['competition_id']);
        if(in_array($action,['goal','void','reopen'],true)) {
            need(!$m['confirmed'] || $action==='reopen','Reabre el resultado antes de corregirlo.');
        }
        if($action==='goal') {
            need(in_array($m['status'],['live','half_time','paused','finished'],true),'Inicia el partido antes de registrar goles.');
            need($m['home_entry_id'] && $m['away_entry_id'],'El partido no tiene ambos equipos.');
            $entry=positive($data['entry_id']??0); need(in_array($entry,[(int)$m['home_entry_id'],(int)$m['away_entry_id']],true),'Equipo ajeno al partido.');
            $kind=$data['kind']??'goal'; need(in_array($kind,['goal','own_goal'],true),'Tipo de gol inválido.');
            $minute=filter_var($data['minute']??null,FILTER_VALIDATE_INT); need($minute!==false && $minute>=0 && $minute<=300,'Minuto inválido.');
            $roster=!empty($data['roster_id'])?positive($data['roster_id']):null;
            if($roster) need((bool)row('SELECT r.id FROM cup_rosters r JOIN cup_players p ON p.id=r.player_id WHERE r.id=? AND r.entry_id=? AND p.archived=0',[$roster,$entry]),'Jugador ajeno a la plantilla.');
            insert('events',['match_id'=>$id,'entry_id'=>$entry,'roster_id'=>$roster,'kind'=>$kind,'minute'=>$minute,'request_key'=>$key,'created_by'=>$u['id'],'created_at'=>now()]); score_match($id);
        } elseif($action==='void') {
            $eid=positive($data['event_id']??0); $reason=text($data['reason']??'',255);
            need((bool)row('SELECT id FROM cup_events WHERE id=? AND match_id=? AND voided=0',[$eid,$id]),'Gol no disponible.');
            execute('UPDATE cup_events SET voided=1,reason=? WHERE id=?',[$reason,$eid]); score_match($id);
        } elseif($action==='confirm') {
            need($u['role']==='admin','Solo un administrador confirma resultados.'); need($m['status']==='finished' && !$m['confirmed'],'Finaliza el partido antes de confirmar.');
            $winner=null; $hp=null; $ap=null;
            if($m['home_score']!==$m['away_score']) $winner=$m['home_score']>$m['away_score']?$m['home_entry_id']:$m['away_entry_id'];
            elseif($m['stage']==='knockout') {
                $hp=filter_var($data['home_penalties']??null,FILTER_VALIDATE_INT); $ap=filter_var($data['away_penalties']??null,FILTER_VALIDATE_INT);
                need($hp!==false && $ap!==false && $hp>=0 && $ap>=0 && $hp<=100 && $ap<=100 && $hp!==$ap,'Indica penales válidos para resolver el empate.');
                $winner=$hp>$ap?$m['home_entry_id']:$m['away_entry_id'];
            }
            execute('UPDATE cup_matches SET confirmed=1,winner_entry_id=?,home_penalties=?,away_penalties=?,version=version+1,updated_at=? WHERE id=?',[$winner,$hp,$ap,now(),$id]); advance_winners((int)$m['competition_id']);
        } elseif($action==='reopen') {
            need($u['role']==='admin','Solo un administrador reabre resultados.'); $reason=text($data['reason']??'',255);
            need((bool)$m['confirmed'] && $m['home_entry_id'] && $m['away_entry_id'],'Este partido no se puede reabrir.');
            need(!row('SELECT id FROM cup_matches WHERE source_home_id=? OR source_away_id=?',[$id,$id]),'Hay rondas dependientes. Retira primero las rondas posteriores desde Organización.');
            need(!row("SELECT id FROM cup_matches WHERE competition_id=? AND stage='knockout'",[$m['competition_id']]) || $m['stage']==='knockout','Retira primero las eliminatorias dependientes.');
            execute('UPDATE cup_matches SET confirmed=0,winner_entry_id=NULL,home_penalties=NULL,away_penalties=NULL,version=version+1,updated_at=? WHERE id=?',[now(),$id]);
        } elseif($action==='status') {
            need(!$m['confirmed'],'Resultado confirmado.'); $to=$data['status']??'';
            $allowed=['scheduled'=>['live','suspended'],'live'=>['half_time','paused','finished','suspended'],'half_time'=>['live','finished','suspended'],'paused'=>['live','finished','suspended'],'suspended'=>['live','finished'],'finished'=>[]];
            need(in_array($to,$allowed[$m['status']]??[],true),'Cambio de estado no permitido.');
            need($m['home_entry_id'] && $m['away_entry_id'],'Faltan equipos por clasificar.');
            execute('UPDATE cup_matches SET status=?,elapsed_seconds=?,clock_started_at=?,version=version+1,updated_at=? WHERE id=?',[$to,elapsed($m),$to==='live'?now():null,now(),$id]);
        } else fail('Acción desconocida.');
        insert('requests',['request_key'=>$key,'match_id'=>$id,'user_id'=>$u['id'],'payload_hash'=>$hash,'created_at'=>now()]);
        audit((int)$u['id'],$action,'match',$id,array_diff_key($data,['csrf'=>1]));
        return ['id'=>$id,'duplicate'=>false];
    });
}
function match_list(?int $season=null,?int $cid=null): array {
    $where=[];$args=[];
    if($season){$where[]='c.season_id=?';$args[]=$season;}
    if($cid){$where[]='c.id=?';$args[]=$cid;}
    $sql='SELECT m.*,c.season_id,c.category_id,c.duration,c.historical,c.published,k.name AS category,s.name AS season,s.timezone,ht.name AS home,ht.crest AS home_crest,at.name AS away,at.crest AS away_crest,f.name AS field,v.name AS venue,g.name AS group_name FROM cup_matches m JOIN cup_competitions c ON c.id=m.competition_id JOIN cup_categories k ON k.id=c.category_id JOIN cup_seasons s ON s.id=c.season_id LEFT JOIN cup_entries he ON he.id=m.home_entry_id LEFT JOIN cup_teams ht ON ht.id=he.team_id LEFT JOIN cup_entries ae ON ae.id=m.away_entry_id LEFT JOIN cup_teams at ON at.id=ae.team_id LEFT JOIN cup_fields f ON f.id=m.field_id LEFT JOIN cup_venues v ON v.id=f.venue_id LEFT JOIN cup_groups g ON g.id=m.group_id';
    $list=rows($sql.($where?' WHERE '.implode(' AND ',$where):'').' ORDER BY m.scheduled_at,m.id',$args);
    foreach($list as &$m){ $m['elapsed']=elapsed($m); $m['scheduled_iso']=$m['scheduled_at']?str_replace(' ','T',$m['scheduled_at']).'Z':null; $m['home']=$m['home']??'To be decided'; $m['away']=$m['away']??($m['confirmed'] && !$m['source_home_id']?'BYE':'To be decided'); }
    return $list;
}
function public_feed(?int $competitionId=null): array {
    $season=row('SELECT * FROM cup_seasons WHERE active=1 AND archived=0 ORDER BY id DESC LIMIT 1');
    $matches=$season?array_values(array_filter(match_list((int)$season['id']),fn($m)=>(bool)$m['published'])):[];
    $posters=rows('SELECT id,title,alt,image,link FROM cup_posters WHERE active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>=?) ORDER BY sort_order,id',[now(),now()]);
    $payload=['server_time'=>gmdate('c'),'season'=>$season,'matches'=>$matches,'posters'=>$posters];
    if($competitionId){$c=competition($competitionId);need((bool)$c['published'],'Competition not published.');if(!$c['historical'])$payload['standings']=['official'=>standings($competitionId),'provisional'=>standings($competitionId,true)];}
    return $payload;
}
