<?php
// Isolated, disposable database. No production writes or mail delivery.
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/guard.php';
if(!getenv('APP_TEST_MYSQL_DSN')) putenv('APP_DSN=sqlite::memory:');
else {test_mysql_dsn(getenv('APP_TEST_MYSQL_DSN'));putenv('APP_DSN='.getenv('APP_TEST_MYSQL_DSN'));}
require __DIR__.'/../app/migrations.php';require __DIR__.'/../app/admin.php';require __DIR__.'/../app/legacy.php';
$checks=0;
function need_test(bool $condition,string $label):void{global $checks;if(!$condition)throw new RuntimeException('FAIL: '.$label);$checks++;echo "PASS $label\n";}
function rejects(callable $fn,string $label):void{try{$fn();}catch(DomainException|PDOException $e){need_test(true,$label);return;}need_test(false,$label);}
function action(int $id,string $type,array $data=[],?array $as=null):array{
    global $admin;$m=row('SELECT * FROM cup_matches WHERE id=?',[$id]);return match_action($data+['action'=>$type,'match_id'=>$id,'version'=>$m['version'],'request_key'=>bin2hex(random_bytes(16))],$as??$admin);
}
migrate();migrate();need_test(count(rows('SELECT * FROM cup_migrations'))===2,'migrations are repeatable');
$uid=save_entity('users',['name'=>'Test Admin','email'=>'admin@example.test','password'=>'Test-only-password-2026','role'=>'admin','active'=>1],0);$admin=row('SELECT * FROM cup_users WHERE id=?',[$uid]);
$scorerId=save_entity('users',['name'=>'Scorer','email'=>'scorer@example.test','password'=>'Test-only-password-2026','role'=>'scorer','active'=>1],$uid);$scorer=row('SELECT * FROM cup_users WHERE id=?',[$scorerId]);
$sid=save_entity('seasons',['name'=>'Test season','active'=>1,'timezone'=>'America/New_York'],$uid);
$cat=save_entity('categories',['name'=>'Test A'],$uid);$cat2=save_entity('categories',['name'=>'Test women'],$uid);
$cid=save_entity('competitions',['season_id'=>$sid,'category_id'=>$cat,'format'=>'groups','group_count'=>2,'group_capacity'=>2,'qualifiers'=>1],$uid);
$cid2=save_entity('competitions',['season_id'=>$sid,'category_id'=>$cat2,'format'=>'knockout'],$uid);
$entries=[];$entries2=[];
for($i=1;$i<=4;$i++){$tid=save_entity('teams',['name'=>'Team '.$i],$uid);$entries[]=save_entity('entries',['competition_id'=>$cid,'team_id'=>$tid],$uid);if($i<=3)$entries2[]=save_entity('entries',['competition_id'=>$cid2,'team_id'=>$tid],$uid);}
$preview=draw_preview($cid,false,$entries);need_test(count($preview['groups'])===2 && count($preview['groups'][0])===2,'balanced manual groups');
rejects(fn()=>draw_preview($cid,false,[$entries[0],$entries[0]]),'reject duplicate or missing entries');
commit_draw($preview,$uid);need_test(count(rows('SELECT * FROM cup_matches WHERE competition_id=?',[$cid]))===2,'round robin pairings');
$preview2=draw_preview($cid2,true);commit_draw($preview2,$uid);$ko=rows('SELECT * FROM cup_matches WHERE competition_id=? ORDER BY round_no,position_no',[$cid2]);
need_test(count($ko)===3,'three-team knockout includes final');need_test(count(array_filter($ko,fn($m)=>(bool)$m['confirmed']))===1,'explicit bye is confirmed');
$m=row('SELECT * FROM cup_matches WHERE competition_id=? ORDER BY id',[$cid]);$mid=(int)$m['id'];
rejects(fn()=>action($mid,'status',['status'=>'live'],$scorer),'scorer denied unassigned match');
insert('assignments',['match_id'=>$mid,'user_id'=>$scorerId]);action($mid,'status',['status'=>'live'],$scorer);
rejects(fn()=>draw_preview($cid,true),'draw locked after kickoff');
$player=save_entity('players',['name'=>'Player <Test>','birth_date'=>'2002-01-01','contact'=>'private@example.test'],$uid);
$roster=save_entity('rosters',['entry_id'=>$m['home_entry_id'],'player_id'=>$player,'number'=>9],$uid);
rejects(fn()=>save_entity('rosters',['entry_id'=>$m['away_entry_id'],'player_id'=>$player,'number'=>8],$uid),'player cannot join two teams in same competition');
$m=row('SELECT * FROM cup_matches WHERE id=?',[$mid]);$goal=['action'=>'goal','match_id'=>$mid,'version'=>$m['version'],'request_key'=>bin2hex(random_bytes(16)),'entry_id'=>$m['home_entry_id'],'roster_id'=>$roster,'kind'=>'goal','minute'=>5];
match_action($goal,$scorer);$duplicate=match_action($goal,$scorer);need_test($duplicate['duplicate']===true && row('SELECT home_score FROM cup_matches WHERE id=?',[$mid])['home_score']==1,'goal reattempt is idempotent');
rejects(fn()=>match_action($goal+['minute'=>6],$admin),'operation token cannot be reused by another actor');
rejects(fn()=>action($mid,'goal',['entry_id'=>$m['away_entry_id'],'roster_id'=>$roster,'minute'=>6]),'scorer must belong to scoring team');
$stale=['action'=>'status','match_id'=>$mid,'version'=>0,'request_key'=>bin2hex(random_bytes(16)),'status'=>'paused'];rejects(fn()=>match_action($stale,$admin),'stale version rejected');
action($mid,'goal',['entry_id'=>$m['home_entry_id'],'kind'=>'own_goal','minute'=>7]);$scores=row('SELECT * FROM cup_matches WHERE id=?',[$mid]);need_test($scores['home_score']==1 && $scores['away_score']==1,'own goal credits opponent');
$own=row("SELECT id FROM cup_events WHERE match_id=? AND kind='own_goal'",[$mid]);action($mid,'void',['event_id'=>$own['id'],'reason'=>'Wrong team']);need_test(row('SELECT away_score FROM cup_matches WHERE id=?',[$mid])['away_score']==0,'void recalculates score');
$official=standings($cid);$provisional=standings($cid,true);need_test(array_sum(array_column($official,'played'))===0 && array_sum(array_column($provisional,'played'))===2,'provisional and official tables separated');
$other=array_values(array_filter($ko,fn($m)=>$m['round_no']==1 && $m['away_entry_id']))[0];action((int)$other['id'],'status',['status'=>'live']);
action($mid,'status',['status'=>'paused']);need_test(row('SELECT status FROM cup_matches WHERE id=?',[$other['id']])['status']==='live','simultaneous categories have independent state');
need_test(count(array_filter(public_feed()['matches'],fn($m)=>in_array($m['status'],['live','paused'],true)))===2,'public feed includes simultaneous categories');
action($mid,'status',['status'=>'finished']);rejects(fn()=>action($mid,'confirm',[],$scorer),'scorer cannot confirm official result');action($mid,'confirm');
need_test(array_sum(array_column(standings($cid),'played'))===2,'confirmed score updates official standings');
rejects(fn()=>action($mid,'goal',['entry_id'=>$m['home_entry_id'],'minute'=>8]),'confirmed games cannot receive goals');
$remaining=row("SELECT id FROM cup_matches WHERE competition_id=? AND status='scheduled'",[$cid]);action((int)$remaining['id'],'status',['status'=>'live']);action((int)$remaining['id'],'status',['status'=>'finished']);action((int)$remaining['id'],'confirm');
$stats=standings($cid);$qualifiers=[];$seen=[];foreach($stats as $e)if(!isset($seen[$e['group_id']])){$qualifiers[]=(int)$e['id'];$seen[$e['group_id']]=true;}
qualify($cid,$qualifiers,$uid);need_test((bool)row("SELECT id FROM cup_matches WHERE competition_id=? AND stage='knockout'",[$cid]),'group qualifiers generate knockout');
rejects(fn()=>action($mid,'reopen',['reason'=>'Correction']),'correction blocked while dependent bracket exists');
remove_rounds($cid,1,$uid,'Correct source score');action($mid,'reopen',['reason'=>'Correction']);need_test(!row('SELECT confirmed FROM cup_matches WHERE id=?',[$mid])['confirmed'],'result can reopen after dependencies removed');
action((int)$other['id'],'status',['status'=>'finished']);rejects(fn()=>action((int)$other['id'],'confirm',['home_penalties'=>2,'away_penalties'=>2]),'tied penalty shootout rejected');action((int)$other['id'],'confirm',['home_penalties'=>4,'away_penalties'=>3]);
$final=row('SELECT * FROM cup_matches WHERE competition_id=? AND round_no=2',[$cid2]);need_test($final['home_entry_id'] && $final['away_entry_id'],'confirmed winners and byes advance');
$venue=save_entity('venues',['name'=>'Test Stadium'],$uid);$field=save_entity('fields',['name'=>'Field 1','venue_id'=>$venue],$uid);
schedule_match((int)$final['id'],$field,'2027-06-01 12:00:00',$uid);
$another=new_match($cid,$entries[0],$entries[1]);rejects(fn()=>schedule_match($another,$field,'2027-06-01 12:30:00',$uid),'field overlap rejected');
schedule_match($another,$field,'2027-06-01 14:00:00',$uid);need_test(row('SELECT field_id FROM cup_matches WHERE id=?',[$another])['field_id']==$field,'non-overlapping scheduling accepted');
rejects(fn()=>managed_image('../config/local.php'),'image path traversal rejected');
rejects(fn()=>save_entity('users',['id'=>$uid,'name'=>'Admin','email'=>'admin@example.test','role'=>'scorer','active'=>1],$uid),'admin cannot remove own privileges');
rejects(fn()=>save_entity('posters',['title'=>'Bad','alt'=>'Bad','image'=>'upload/logo.png','link'=>'javascript:alert(1)'],$uid),'unsafe poster link rejected');
$dump=$argv[1]??null;if($dump){$result=import_legacy($dump);need_test($result['teams']===40 && $result['matches']===24,'historical import keeps 40 teams and 24 games');need_test(count(rows('SELECT id FROM cup_legacy'))===158,'all historical rows preserved');rejects(fn()=>editable_competition((int)row('SELECT id FROM cup_competitions WHERE historical=1')['id']),'historical competition is read only');rejects(fn()=>import_legacy($dump),'repeat historical import rejected');}
echo "\n$checks integration checks passed.\n";
