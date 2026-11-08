<?php
// Preserve the existing local sign-in when switching development from SQLite to MySQL.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../app/bootstrap.php';
need(db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql' && row('SELECT DATABASE() AS name')['name']==='smokydev','Esta herramienta solo se usa con MySQL local smokydev.');
need(!row('SELECT id FROM cup_users LIMIT 1'),'Ya hay usuarios en MySQL; no se reemplazarán.');
$path=CUP_ROOT.'/storage/cup.sqlite';need(is_file($path),'No existe la copia local anterior.');
$source=new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$admin=$source->query("SELECT name,email,password_hash,role,active FROM cup_users WHERE role='admin' AND active=1 ORDER BY id LIMIT 1")->fetch();
need((bool)$admin,'No existe un administrador local para conservar.');
transaction(function()use($admin){$id=insert('users',$admin);audit(0,'local_admin.copy','users',$id);});
echo "Acceso administrativo local conservado en MySQL. No se cambiaron contraseñas.\n";
