<?php
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/guard.php';test_mysql_dsn((string)getenv('APP_TEST_MYSQL_DSN'));putenv('APP_DSN='.getenv('APP_TEST_MYSQL_DSN'));
require __DIR__.'/../app/migrations.php';
$mode=$argv[1]??'';
if($mode==='setup'){
    migrate();$uid=insert('users',['name'=>'Race test','email'=>'race@example.test','password_hash'=>password_hash(bin2hex(random_bytes(16)),PASSWORD_DEFAULT),'role'=>'admin']);
    $sid=insert('seasons',['name'=>'Race test','active'=>1]);$cat=insert('categories',['name'=>'Race category']);$cid=insert('competitions',['season_id'=>$sid,'category_id'=>$cat,'published'=>1]);$ids=[];
    for($i=0;$i<18;$i++){
        $home=insert('entries',['competition_id'=>$cid,'team_id'=>insert('teams',['name'=>'Home '.$i])]);$away=insert('entries',['competition_id'=>$cid,'team_id'=>insert('teams',['name'=>'Away '.$i])]);
        $ids[]=new_match($cid,$home,$away,['status'=>'live','clock_started_at'=>now()]);
    }
    echo json_encode(['user'=>$uid,'matches'=>$ids]);exit;
}
$input=json_decode(stream_get_contents(STDIN),true);
if($mode==='worker'){
    while(microtime(true)<$input['start'])usleep(1000);
    if(($input['kind']??'')==='read'){
        $times=[];for($i=0;$i<20;$i++){$t=microtime(true);$feed=public_feed();if(count($feed['matches'])!==18)throw new RuntimeException('Incomplete feed.');$times[]=(microtime(true)-$t)*1000;}echo json_encode(['ok'=>true,'times'=>$times]);exit;
    }
    $user=row('SELECT * FROM cup_users WHERE id=?',[$input['user']]);
    try{$result=match_action($input['data'],$user);echo json_encode(['ok'=>true]+$result);}
    catch(DomainException $e){echo json_encode(['ok'=>false,'conflict'=>true]);}exit;
}
if($mode==='state'){
    echo json_encode(['matches'=>rows('SELECT id,home_score,away_score,version FROM cup_matches ORDER BY id'),'events'=>(int)row('SELECT COUNT(*) AS n FROM cup_events')['n'],'requests'=>(int)row('SELECT COUNT(*) AS n FROM cup_requests')['n']]);exit;
}
throw new RuntimeException('Unknown concurrency mode.');
