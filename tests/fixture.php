<?php
if(PHP_SAPI!=='cli')exit;
$dir=__DIR__.'/artifacts';if(!is_dir($dir))mkdir($dir,0770,true);
$file=$dir.'/browser.sqlite';if(is_file($file))unlink($file);
putenv('APP_DSN=sqlite:'.$file);
require __DIR__.'/../app/migrations.php';require __DIR__.'/../app/admin.php';migrate();
$uid=save_entity('users',['name'=>'Test organizer','email'=>'browser@example.test','password'=>'Browser-test-only-2026','role'=>'admin','active'=>1],0);
$sid=save_entity('seasons',['name'=>'Browser test season','active'=>1,'timezone'=>'America/New_York'],$uid);
$venue=save_entity('venues',['name'=>'Test stadium'],$uid);
$fixtures=[];
foreach(['Division A','Women'] as $n=>$name){
    $category=save_entity('categories',['name'=>$name],$uid);$cid=save_entity('competitions',['season_id'=>$sid,'category_id'=>$category,'format'=>'knockout'],$uid);$entries=[];
    foreach(['Home','Away'] as $side){$tid=save_entity('teams',['name'=>$name.' '.$side],$uid);$entries[]=save_entity('entries',['competition_id'=>$cid,'team_id'=>$tid],$uid);}
    commit_draw(draw_preview($cid,false,$entries),$uid);$m=row('SELECT id FROM cup_matches WHERE competition_id=?',[$cid]);$field=save_entity('fields',['name'=>'Field '.($n+1),'venue_id'=>$venue],$uid);schedule_match((int)$m['id'],$field,gmdate('Y-m-d H:i:s'),$uid);
    $u=row('SELECT * FROM cup_users WHERE id=?',[$uid]);match_action(['action'=>'status','match_id'=>$m['id'],'version'=>0,'request_key'=>bin2hex(random_bytes(16)),'status'=>'live'],$u);
    $fixtures[]=$m['id'];
}
insert('posters',['title'=>'Matchday poster','alt'=>'Tournament poster for browser test','image'=>'images/optimized/1-550.jpg','active'=>1]);
$scorer=save_entity('users',['name'=>'Test scorer','email'=>'scorer@example.test','password'=>'Browser-test-only-2026','role'=>'scorer','active'=>1],$uid);
insert('assignments',['match_id'=>$fixtures[0],'user_id'=>$scorer]);
$category=save_entity('categories',['name'=>'Draw test'],$uid);$cid=save_entity('competitions',['season_id'=>$sid,'category_id'=>$category,'format'=>'groups','group_count'=>2,'group_capacity'=>2,'qualifiers'=>1],$uid);
foreach(['One','Two','Three','Four'] as $label){$team=save_entity('teams',['name'=>'Draw '.$label],$uid);save_entity('entries',['competition_id'=>$cid,'team_id'=>$team],$uid);}
echo json_encode(['matches'=>$fixtures,'database'=>$file]);
