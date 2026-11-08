<?php
// Development server: php -S 127.0.0.1:8080 tools/router.php
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
if(preg_match('~(?:^|/)\.(?!well-known/)~',$path)){http_response_code(404);exit;}
if(preg_match('~(?:^|/)(?:app|config|storage|tools|tests|docs|php|\.git)(?:/|$)|^/plugins/.*\.php$|\.(?:sql|sqlite|log|env|bak)$|\.\.~i',$path)) {http_response_code(404);exit;}
if(str_starts_with($path,'/upload/managed/') && !preg_match('~\.(jpg|png|webp)$~i',$path)){http_response_code(404);exit;}
return false;
