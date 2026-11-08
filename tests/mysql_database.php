<?php
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/guard.php';require __DIR__.'/../app/bootstrap.php';
$dsn=(string)config('dsn','');
if(!str_starts_with($dsn,'mysql:'))throw new RuntimeException('Configure a MySQL server for database tests.');
$serverDsn=preg_replace('/;?dbname=[^;]*/','',$dsn);
$server=new PDO($serverDsn,(string)config('db_user',''),(string)config('db_password',''),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
if(($argv[1]??'')==='create'){
    $name='cup_test_'.gmdate('Ymdhis').'_'.bin2hex(random_bytes(6));
    $server->exec('CREATE DATABASE `'.$name.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    echo json_encode(['name'=>$name,'dsn'=>$serverDsn.';dbname='.$name]);
}elseif(($argv[1]??'')==='drop'){
    $name=$argv[2]??'';
    if(!preg_match('/^cup_test_[0-9]{14}_[a-f0-9]{12}$/',$name))throw new RuntimeException('Only generated test databases may be removed.');
    $server->exec('DROP DATABASE `'.$name.'`');echo "Temporary database removed.\n";
}else throw new RuntimeException('Expected create or drop.');
