<?php
function test_mysql_dsn(string $dsn): void {
    preg_match_all('/(?:^|;)dbname=([^;]*)/',substr($dsn,6),$names);
    if(!str_starts_with($dsn,'mysql:') || count($names[1])!==1 || !preg_match('/^cup_test_[a-z0-9_]+$/D',$names[1][0]))throw new RuntimeException('Tests require a disposable database named cup_test_*. Never use smokydev.');
}
