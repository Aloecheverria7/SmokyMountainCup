<?php
require __DIR__.'/../app/admin.php';
session_boot();
try {
    $method=$_SERVER['REQUEST_METHOD'];
    if($method==='GET') {
        $u=authorized();$payload=['user'=>$u,'csrf'=>csrf()];
        if($u['role']==='admin') {
            foreach(['seasons','categories','competitions','teams','entries','players','rosters','venues','fields','groups','group_entries','posters'] as $t) $payload[$t]=rows('SELECT * FROM cup_'.$t.' ORDER BY id DESC');
            $payload['users']=rows('SELECT id,name,email,role,active FROM cup_users ORDER BY id');
            $payload['assignments']=rows('SELECT * FROM cup_assignments');
            $payload['audit']=rows('SELECT a.*,u.name AS actor FROM cup_audit a LEFT JOIN cup_users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100');
            $payload['matches']=match_list();
        } else {
            $ids=array_column(rows('SELECT match_id FROM cup_assignments WHERE user_id=?',[$u['id']]),'match_id');
            $payload['matches']=array_values(array_filter(match_list(),fn($m)=>in_array($m['id'],$ids)));
        }
        if(!empty($_GET['match_id'])) {
            $m=locked_match(positive($_GET['match_id']));match_permission($m,$u);
            $payload['match']=array_values(array_filter($payload['matches'],fn($x)=>$x['id']==$m['id']))[0]??null;
            $payload['events']=rows('SELECT e.*,p.name AS player,r.number FROM cup_events e LEFT JOIN cup_rosters r ON r.id=e.roster_id LEFT JOIN cup_players p ON p.id=r.player_id WHERE e.match_id=? ORDER BY e.minute,e.id',[$m['id']]);
            $payload['roster']=rows('SELECT r.id,r.entry_id,r.number,p.name FROM cup_rosters r JOIN cup_players p ON p.id=r.player_id WHERE r.entry_id IN (?,?) AND p.archived=0 ORDER BY r.number',[$m['home_entry_id'],$m['away_entry_id']]);
        }
        if($u['role']==='admin' && !empty($_GET['competition_id'])) $payload['standings']=standings(positive($_GET['competition_id']));
        json_response($payload);
    }
    need($method==='POST','Método no permitido.');
    $d=str_contains($_SERVER['CONTENT_TYPE']??'','application/json')?json_decode(file_get_contents('php://input'),true):$_POST;
    need(is_array($d),'Solicitud inválida.');
    need(is_string($d['csrf']??null) && hash_equals(csrf(),$d['csrf']),'La sesión cambió. Recarga la página.');
    $action=$d['action']??'';
    if($action==='login') {
        $identity=hash('sha256',strtolower(trim((string)($d['email']??''))).'|'.($_SERVER['REMOTE_ADDR']??''));
        $cut=gmdate('Y-m-d H:i:s',time()-900);execute('DELETE FROM cup_login_attempts WHERE created_at<?',[gmdate('Y-m-d H:i:s',time()-86400)]);
        $ip=hash('sha256','ip|'.($_SERVER['REMOTE_ADDR']??''));
        need(count(rows('SELECT id FROM cup_login_attempts WHERE identity_hash IN (?,?) AND created_at>?',[$identity,$ip,$cut]))<20,'Demasiados intentos. Espera quince minutos.');
        $account=row('SELECT * FROM cup_users WHERE email=?',[strtolower(trim((string)($d['email']??'')))]);
        $valid=password_verify((string)($d['password']??''),$account['password_hash']??'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
        if(!$account || !$account['active'] || !$valid) {insert('login_attempts',['identity_hash'=>$identity,'created_at'=>now()]);insert('login_attempts',['identity_hash'=>$ip,'created_at'=>now()]);fail('Correo o contraseña incorrectos.',401);}
        session_regenerate_id(true);$_SESSION=['uid'=>$account['id'],'auth_hash'=>hash('sha256',$account['password_hash']),'csrf'=>bin2hex(random_bytes(32))];json_response(['ok'=>true]);
    }
    $u=authorized();
    if($action==='logout'){$_SESSION=[];session_destroy();json_response(['ok'=>true]);}
    if($action==='password') {
        $account=row('SELECT password_hash FROM cup_users WHERE id=?',[$u['id']]);need(password_verify((string)($d['current_password']??''),$account['password_hash']),'Contraseña actual incorrecta.');
        $pass=(string)($d['password']??'');need(strlen($pass)>=12 && strlen($pass)<=128,'Usa entre 12 y 128 caracteres.');$hash=password_hash($pass,PASSWORD_DEFAULT);
        execute('UPDATE cup_users SET password_hash=? WHERE id=?',[$hash,$u['id']]);$_SESSION['auth_hash']=hash('sha256',$hash);session_regenerate_id(true);audit((int)$u['id'],'password.change','users',(int)$u['id']);json_response(['ok'=>true]);
    }
    if($action==='match'){json_response(['ok'=>true]+match_action($d['data']??[],$u));}
    authorized(true);
    if($action==='save') json_response(['ok'=>true,'id'=>save_entity((string)($d['resource']??''),$d['data']??[],(int)$u['id'])]);
    if($action==='upload') json_response(['ok'=>true,'path'=>upload_image($_FILES['image']??[],(int)$u['id'])]);
    if($action==='preview') {
        $ids=array_map('intval',array_filter(preg_split('/[\s,]+/',trim((string)($d['order']??'')))));
        $preview=draw_preview(positive($d['competition_id']??0),($d['mode']??'random')==='random',$ids);
        $_SESSION['draw']=$preview;json_response(['ok'=>true,'preview'=>$preview]);
    }
    if($action==='publish_draw') {need(isset($_SESSION['draw']),'Genera una vista previa.');commit_draw($_SESSION['draw'],(int)$u['id']);unset($_SESSION['draw']);json_response(['ok'=>true]);}
    if($action==='qualify') {qualify(positive($d['competition_id']??0),array_map('intval',preg_split('/[\s,]+/',trim((string)($d['order']??'')))),(int)$u['id']);json_response(['ok'=>true]);}
    if($action==='schedule') {
        $id=positive($d['match_id']??0);$m=row('SELECT competition_id FROM cup_matches WHERE id=?',[$id]);need((bool)$m,'Partido no encontrado.');
        schedule_match($id,!empty($d['field_id'])?positive($d['field_id']):null,local_datetime($d['scheduled_at']??'',competition((int)$m['competition_id'])['timezone']),(int)$u['id']);json_response(['ok'=>true]);
    }
    if($action==='assign') {
        $id=positive($d['match_id']??0);$m=locked_match($id);editable_competition((int)$m['competition_id']);
        $scorer=!empty($d['user_id'])?positive($d['user_id']):null;
        if($scorer)need((bool)row("SELECT id FROM cup_users WHERE id=? AND active=1 AND role='scorer'",[$scorer]),'Anotador inválido.');
        transaction(function()use($id,$scorer,$u){execute('DELETE FROM cup_assignments WHERE match_id=?',[$id]);if($scorer)insert('assignments',['match_id'=>$id,'user_id'=>$scorer]);audit((int)$u['id'],'assign','match',$id,['user'=>$scorer]);});json_response(['ok'=>true]);
    }
    if($action==='remove_rounds'){remove_rounds(positive($d['competition_id']??0),positive($d['from_round']??0),(int)$u['id'],(string)($d['reason']??''));json_response(['ok'=>true]);}
    if($action==='rebuild_rounds') {
        $cid=positive($d['competition_id']??0);editable_competition($cid);
        transaction(function()use($cid,$u){
            $last=row("SELECT MAX(round_no) AS n FROM cup_matches WHERE competition_id=? AND stage='knockout'",[$cid]);need(!empty($last['n']),'Primero genera las eliminatorias.');
            $round=(int)$last['n'];$previous=array_column(rows('SELECT id FROM cup_matches WHERE competition_id=? AND round_no=? ORDER BY position_no',[$cid,$round]),'id');
            while(count($previous)>1){need(count($previous)%2===0,'La ronda no está completa.');$next=[];$round++;for($i=0;$i<count($previous);$i+=2)$next[]=new_match($cid,null,null,['stage'=>'knockout','round_no'=>$round,'position_no'=>intdiv($i,2)+1,'source_home_id'=>$previous[$i],'source_away_id'=>$previous[$i+1]]);$previous=$next;}
            advance_winners($cid);audit((int)$u['id'],'rounds.rebuild','competition',$cid);
        });json_response(['ok'=>true]);
    }
    if($action==='reset_draw') {
        $cid=positive($d['competition_id']??0);editable_competition($cid);
        transaction(function()use($cid,$u){
            need(!row("SELECT id FROM cup_matches WHERE competition_id=? AND status<>'scheduled' AND NOT (stage='knockout' AND away_entry_id IS NULL AND source_home_id IS NULL AND confirmed=1)",[$cid]),'Ya hay partidos iniciados.');
            foreach(rows('SELECT id FROM cup_matches WHERE competition_id=?',[$cid]) as $m)execute('DELETE FROM cup_assignments WHERE match_id=?',[$m['id']]);
            execute('UPDATE cup_matches SET source_home_id=NULL,source_away_id=NULL WHERE competition_id=?',[$cid]);execute('DELETE FROM cup_matches WHERE competition_id=?',[$cid]);execute('DELETE FROM cup_group_entries WHERE group_id IN (SELECT id FROM cup_groups WHERE competition_id=?)',[$cid]);execute('DELETE FROM cup_groups WHERE competition_id=?',[$cid]);execute('UPDATE cup_competitions SET published=0 WHERE id=?',[$cid]);audit((int)$u['id'],'draw.reset','competition',$cid);
        });json_response(['ok'=>true]);
    }
    fail('Acción desconocida.');
} catch(DomainException $e){json_response(['error'=>$e->getMessage()],in_array($e->getCode(),[401,403],true)?$e->getCode():422);}
catch(PDOException $e){error_log('Cup database operation failed: '.$e->getCode());json_response(['error'=>'No se pudo guardar. Comprueba duplicados, referencias y configuración de la base.'],409);}
catch(Throwable $e){error_log('Cup admin error: '.get_class($e));json_response(['error'=>'No se completó la operación. Revisa la instalación.'],500);}
