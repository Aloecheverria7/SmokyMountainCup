<?php
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../app/rules.php';
require __DIR__.'/guard.php';
$checks=0;
function check_unit(bool $value,string $label):void{global $checks;if(!$value)throw new RuntimeException('FAIL '.$label);$checks++;echo 'PASS '.$label."\n";}
$base=['group_id'=>1,'points'=>3,'gd'=>2,'gf'=>4,'name'=>'Alpha'];
check_unit(compare_standing($base,$base)===0,'equal standing compares equal');
foreach(['points','gd','gf'] as $key){$better=$base;$better[$key]++;check_unit(compare_standing($better,$base)<0,'higher '.$key.' ranks first');check_unit(compare_standing($base,$better)>0,'comparison symmetric for '.$key);}
$lower=$base;$lower['points']=2;$lower['gf']=100;check_unit(compare_standing($base,$lower)<0,'points take precedence over goals');
$tie=$base;$tie['name']='Zulu';check_unit(compare_standing($base,$tie)<0,'exact sporting ties have deterministic display order');
$group=$base;$group['group_id']=2;$group['points']=100;check_unit(compare_standing($base,$group)<0,'groups remain separated');
check_unit(knockout_pairs([1,2])===[[1,2]],'two teams produce one final');
check_unit(knockout_pairs([1,2,3])===[[1,null],[2,3]],'three teams produce one explicit bye');
foreach([[],[1],[1,1],range(1,513)] as $invalid){try{knockout_pairs($invalid);check_unit(false,'reject invalid seeds');}catch(InvalidArgumentException $e){check_unit(true,'reject invalid seed count or duplicates');}}
for($n=2;$n<=512;$n++){
    $pairs=knockout_pairs(range(1,$n));$seen=[];$byes=0;
    foreach($pairs as [$home,$away]){$seen[]=$home;if($away!==null)$seen[]=$away;else $byes++;}
    sort($seen);if($seen!==range(1,$n)||$byes!==2*count($pairs)-$n)throw new RuntimeException('Invalid bracket for '.$n);
}
check_unit(true,'all bracket sizes 2..512 preserve entrants and correct bye count');
$m=['elapsed_seconds'=>120,'status'=>'live','clock_started_at'=>'2026-01-01 12:00:00'];$at=strtotime('2026-01-01 12:01:30 UTC');
check_unit(clock_seconds($m,$at)===210,'running clock adds elapsed server seconds');
check_unit(clock_seconds($m,$at-200)===120,'clock never subtracts time for future start');
foreach(['scheduled','paused','half_time','finished','suspended'] as $status){$m['status']=$status;check_unit(clock_seconds($m,$at)===120,'clock remains stopped: '.$status);}
$m['status']='live';$m['clock_started_at']=null;check_unit(clock_seconds($m,$at)===120,'missing start leaves persisted elapsed time');
echo "$checks unit checks passed; no database or browser used.\n";
foreach(['mysql:host=127.0.0.1;dbname=smokydev','mysql:dbname=cup_test_ok;dbname=smokydev','sqlite:cup_test_file','mysql:dbname=other_cup_test_db'] as $dsn){try{test_mysql_dsn($dsn);check_unit(false,'reject unsafe test DSN');}catch(RuntimeException $e){if(str_starts_with($e->getMessage(),'FAIL'))throw $e;check_unit(true,'reject unsafe test DSN');}}
test_mysql_dsn('mysql:host=127.0.0.1;dbname=cup_test_safe;charset=utf8mb4');check_unit(true,'accept isolated MySQL test database');
echo "$checks total unit checks passed.\n";
