<?php
// One-time local onboarding; never runs over HTTP or against a MySQL database.
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../app/admin.php';
need(db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite','Esta herramienta solo prepara el acceso local SQLite.');
need(!row('SELECT id FROM cup_users LIMIT 1'),'Ya existe un usuario. Usa tools/cup.php admin para restablecerlo.');
$password=bin2hex(random_bytes(12));$email='admin@smokymountaincup.local';
save_entity('users',['name'=>'Organización','email'=>$email,'password'=>$password,'role'=>'admin','active'=>1],0);
$file=CUP_ROOT.'/storage/ACCESO_LOCAL.md';
file_put_contents($file,"# Acceso local a Smoky Mountain Cup\n\nPanel: http://127.0.0.1:8080/admin/\n\nCorreo: `$email`\n\nContraseña inicial única: `$password`\n\nCambia la contraseña en Mi contraseña después de entrar. Este acceso pertenece exclusivamente a la copia SQLite local y no se publica.\n");
echo "Administrador local creado con contraseña aleatoria. Datos de acceso guardados en storage/ACCESO_LOCAL.md\n";
