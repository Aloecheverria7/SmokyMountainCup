<?php
require_once __DIR__.'/bootstrap.php';

function save_entity(string $type,array $d,int $uid): int {
    $allowed=['seasons','categories','competitions','teams','entries','players','rosters','venues','fields','users','posters'];
    need(in_array($type,$allowed,true),'Recurso no permitido.');
    $id=!empty($d['id'])?positive($d['id']):null;
    return transaction(function()use($type,$d,$uid,$id){
        $old=$id?row('SELECT * FROM cup_'.$type.' WHERE id=?',[$id]):null;
        need(!$id || (bool)$old,'Registro no encontrado.'); $data=[];
        $int=static function($key,$default,$min,$max)use($d){$n=filter_var($d[$key]??$default,FILTER_VALIDATE_INT);need($n!==false && $n>=$min && $n<=$max,'Número inválido: '.$key);return $n;};
        $flag=static fn($key)=>(int)!empty($d[$key]);
        if(in_array($type,['seasons','categories','teams','players','venues','fields','users'],true)) $data['name']=text($d['name']??'',120);
        if(in_array($type,['seasons','categories','teams','players','venues','fields'],true)) $data['archived']=$flag('archived');
        if($type==='seasons') {
            $tz=text($d['timezone']??'America/New_York',80); need(in_array($tz,DateTimeZone::listIdentifiers(),true),'Zona horaria inválida.');
            need(!$old || !$old['archived'] || !$flag('active'),'No actives una temporada histórica.');
            $data+=['timezone'=>$tz,'active'=>$flag('active')]; need(!$data['active']||!$data['archived'],'Una temporada archivada no puede estar activa.');
            if($data['active']) execute('UPDATE cup_seasons SET active=0');
        } elseif($type==='categories') {
            $data+=['min_age'=>($d['min_age']??'')!==''?$int('min_age',0,0,100):null,'max_age'=>($d['max_age']??'')!==''?$int('max_age',100,0,100):null];
            need($data['min_age']===null||$data['max_age']===null||$data['min_age']<=$data['max_age'],'Edades incompatibles.');
        } elseif($type==='competitions') {
            $season=positive($d['season_id']??0); $category=positive($d['category_id']??0);
            need((bool)row('SELECT id FROM cup_seasons WHERE id=? AND archived=0',[$season]),'Temporada no disponible.');
            need((bool)row('SELECT id FROM cup_categories WHERE id=? AND archived=0',[$category]),'Categoría no disponible.');
            if($id) { editable_competition($id); need(!row('SELECT id FROM cup_matches WHERE competition_id=?',[$id]),'Retira la programación para cambiar las reglas.'); need((int)$old['season_id']===$season && (int)$old['category_id']===$category,'La temporada y categoría no pueden cambiarse.'); }
            $format=$d['format']??'groups';need(in_array($format,['groups','knockout'],true),'Formato inválido.');
            $data=['season_id'=>$season,'category_id'=>$category,'format'=>$format,'duration'=>$int('duration',90,10,180),'win_points'=>$int('win_points',3,0,20),'draw_points'=>$int('draw_points',1,0,20),'loss_points'=>$int('loss_points',0,0,20),'group_count'=>$int('group_count',2,1,32),'group_capacity'=>$int('group_capacity',4,2,32),'qualifiers'=>$int('qualifiers',2,1,16)];
            need($format!=='groups'||$data['qualifiers']<$data['group_capacity'],'Clasifican menos equipos que la capacidad del grupo.');
        } elseif($type==='teams') {
            if(!empty($d['crest'])) $data['crest']=managed_image($d['crest']);
        } elseif($type==='entries') {
            need(!$id,'Las inscripciones no se reasignan; conserva el historial.');
            $cid=positive($d['competition_id']??0);editable_competition($cid); $team=positive($d['team_id']??0);
            need(!row('SELECT id FROM cup_matches WHERE competition_id=?',[$cid]),'Retira el sorteo antes de agregar equipos.');
            need((bool)row('SELECT id FROM cup_teams WHERE id=? AND archived=0',[$team]),'Equipo no disponible.');
            $data=['competition_id'=>$cid,'team_id'=>$team];
        } elseif($type==='players') {
            $date=trim((string)($d['birth_date']??''));
            need(!$date || (preg_match('/^\d{4}-\d\d-\d\d$/',$date) && DateTimeImmutable::createFromFormat('!Y-m-d',$date)?->format('Y-m-d')===$date && $date<=gmdate('Y-m-d')),'Fecha de nacimiento inválida.');
            $data+=['birth_date'=>$date?:null,'contact'=>mb_substr(trim((string)($d['contact']??'')),0,160)];
        } elseif($type==='rosters') {
            $entry=positive($d['entry_id']??0);$player=positive($d['player_id']??0);
            $e=row('SELECT competition_id FROM cup_entries WHERE id=?',[$entry]);need((bool)$e,'Inscripción inválida.');editable_competition((int)$e['competition_id']);
            need((bool)row('SELECT id FROM cup_players WHERE id=? AND archived=0',[$player]),'Jugador no disponible.');
            need(!row('SELECT r.id FROM cup_rosters r JOIN cup_entries e ON e.id=r.entry_id WHERE e.competition_id=? AND r.player_id=? AND r.id<>?',[$e['competition_id'],$player,$id??0]),'El jugador ya está inscrito en esta categoría.');
            if($id) need((int)$old['entry_id']===$entry && (int)$old['player_id']===$player,'No reasignes una plantilla; cambia solamente el dorsal.');
            $data=['entry_id'=>$entry,'player_id'=>$player,'number'=>$int('number',0,0,999)];
        } elseif($type==='venues') {
            $data['address']=mb_substr(trim((string)($d['address']??'')),0,255);
        } elseif($type==='fields') {
            $venue=positive($d['venue_id']??0);need((bool)row('SELECT id FROM cup_venues WHERE id=? AND archived=0',[$venue]),'Sede no disponible.');$data['venue_id']=$venue;
        } elseif($type==='users') {
            $email=strtolower(text($d['email']??'',160));need((bool)filter_var($email,FILTER_VALIDATE_EMAIL),'Correo inválido.');
            $role=$d['role']??'scorer';need(in_array($role,['admin','scorer'],true),'Rol inválido.');
            $data+=['email'=>$email,'role'=>$role,'active'=>$flag('active')];
            need($id!==$uid || ($role==='admin' && $data['active']),'No puedes desactivar o quitar permisos a tu propia cuenta.');
            if(!empty($d['password'])) {need(strlen($d['password'])>=12 && strlen($d['password'])<=128,'La contraseña debe tener entre 12 y 128 caracteres.');$data['password_hash']=password_hash($d['password'],PASSWORD_DEFAULT);}
            need($id!==null || isset($data['password_hash']),'Indica una contraseña inicial.');
        } elseif($type==='posters') {
            $link=trim((string)($d['link']??''));need(!$link || (filter_var($link,FILTER_VALIDATE_URL) && in_array(parse_url($link,PHP_URL_SCHEME),['http','https'],true)),'El enlace debe ser HTTP o HTTPS.');
            $data=['title'=>text($d['title']??'',120),'alt'=>text($d['alt']??'',255),'image'=>managed_image($d['image']??$old['image']??''),'link'=>$link?:null,'sort_order'=>$int('sort_order',0,0,999),'active'=>$flag('active')];
            foreach(['starts_at','ends_at'] as $key) $data[$key]=local_datetime($d[$key]??'');
            need(!$data['starts_at']||!$data['ends_at']||$data['starts_at']<$data['ends_at'],'Las fechas de publicación están invertidas.');
        }
        if($id) {
            execute('UPDATE cup_'.$type.' SET '.implode(',',array_map(fn($key)=>$key.'=?',array_keys($data))).' WHERE id=?',[...array_values($data),$id]);
        } else $id=insert($type,$data);
        $safe=$data;unset($safe['password_hash'],$safe['contact'],$safe['birth_date']); audit($uid,'save',$type,$id,$safe); return $id;
    });
}
function local_datetime(mixed $value,?string $timezone=null): ?string {
    if(!$value)return null;
    $value=str_replace('T',' ',text($value,19)); if(strlen($value)===16)$value.=':00';
    $d=DateTimeImmutable::createFromFormat('!Y-m-d H:i:s',$value,new DateTimeZone($timezone??(string)config('timezone','America/New_York')));
    need($d && $d->format('Y-m-d H:i:s')===$value,'Fecha u hora inválida.'); return $d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}
function managed_image(mixed $path): string {
    need(is_string($path) && preg_match('~^upload/managed/[a-f0-9]{32}\.(jpg|png|webp)$~',$path) && is_file(CUP_ROOT.'/'.$path),'Sube una imagen válida.'); return $path;
}
function upload_image(array $file,int $uid): string {
    need(($file['error']??1)===UPLOAD_ERR_OK && ($file['size']??0)<=8*1024*1024,'La imagen debe pesar menos de 8 MB.');
    $info=@getimagesize($file['tmp_name']); $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $types=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
    need($info && isset($types[$mime]) && $info[0]<=8000 && $info[1]<=8000 && $info[0]*$info[1]<=30000000,'Imagen no admitida o demasiado grande.');
    $path='upload/managed/'.bin2hex(random_bytes(16)).'.'.$types[$mime];
    need(move_uploaded_file($file['tmp_name'],CUP_ROOT.'/'.$path),'No se pudo guardar la imagen.');audit($uid,'upload','image',0,['path'=>$path]); return $path;
}
function remove_rounds(int $cid,int $from,int $uid,string $reason): void {
    transaction(function()use($cid,$from,$uid,$reason){
        editable_competition($cid);text($reason,255);
        $matches=rows("SELECT id FROM cup_matches WHERE competition_id=? AND stage='knockout' AND round_no>=?",[$cid,$from]);
        foreach($matches as $m) need(!row("SELECT id FROM cup_matches WHERE id=? AND status<>'scheduled' AND away_entry_id IS NOT NULL",[$m['id']]),'Hay partidos posteriores iniciados; conserva el historial y resuélvelos primero.');
        foreach(array_reverse($matches) as $m) {
            execute('DELETE FROM cup_assignments WHERE match_id=?',[$m['id']]);
            execute('UPDATE cup_matches SET source_home_id=NULL,source_away_id=NULL WHERE id=?',[$m['id']]);
        }
        foreach(array_reverse($matches) as $m) execute('DELETE FROM cup_matches WHERE id=?',[$m['id']]);
        audit($uid,'rounds.remove','competition',$cid,['from'=>$from,'reason'=>$reason]);
    });
}
