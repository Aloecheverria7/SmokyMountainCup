<?php
require __DIR__.'/../app/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='GET'){json_response(['error'=>'Read only.'],405);}
try {json_response(public_feed(!empty($_GET['competition'])?positive($_GET['competition']):null));}
catch(Throwable $e){error_log('Cup feed unavailable: '.get_class($e));json_response(['error'=>'Results temporarily unavailable.'],503);}
