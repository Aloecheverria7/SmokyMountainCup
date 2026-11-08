<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../app/migrations.php';
require __DIR__.'/../app/legacy.php';
try {
    $command=$argv[1]??'help';
    if($command==='migrate'){migrate();echo "Migraciones aplicadas.\n";}
    elseif($command==='import'){need(isset($argv[2]),'Indica la ruta al SQL.');echo json_encode(import_legacy($argv[2]),JSON_PRETTY_PRINT)."\n";}
    elseif($command==='admin') {
        require __DIR__.'/../app/admin.php';
        need(isset($argv[2]),'Indica el correo del administrador.');
        fwrite(STDOUT,"Contraseña nueva (mínimo 12 caracteres; entrada por stdin): ");$password=trim((string)fgets(STDIN));
        $existing=row('SELECT id FROM cup_users WHERE email=?',[strtolower($argv[2])]);
        $id=save_entity('users',['id'=>$existing['id']??null,'email'=>$argv[2],'name'=>$argv[3]??'Administrador','role'=>'admin','active'=>1,'password'=>$password],0);
        echo "Administrador preparado: $id\n";
    } else echo "php tools/cup.php migrate | import <ruta.sql> | admin <correo> [nombre]\nConfigura APP_DSN/APP_DB_USER/APP_DB_PASSWORD o config/local.php. Sin DSN usa SQLite local.\n";
} catch(Throwable $e){fwrite(STDERR,$e instanceof DomainException?$e->getMessage()."\n":"No se completó la operación. Comprueba la configuración y la base de datos.\n");exit(1);}
