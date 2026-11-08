<?php
declare(strict_types=1);

const CUP_ROOT = __DIR__ . '/..';
function config(string $key, mixed $default = null): mixed {
    static $local;
    $local ??= is_file(CUP_ROOT . '/config/local.php') ? require CUP_ROOT . '/config/local.php' : [];
    $env = getenv('APP_' . strtoupper($key));
    return $env !== false ? $env : ($local[$key] ?? $default);
}
date_default_timezone_set((string)config('timezone', 'America/New_York'));
function db(): PDO {
    static $pdo;
    if (!$pdo) {
        $dsn = (string)config('dsn', 'sqlite:' . CUP_ROOT . '/storage/cup.sqlite');
        $pdo = new PDO($dsn, (string)config('db_user', ''), (string)config('db_password', ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
            $pdo->exec('PRAGMA foreign_keys=ON'); $pdo->exec('PRAGMA busy_timeout=5000');
        } else { $pdo->exec("SET time_zone = '+00:00'"); }
    }
    return $pdo;
}
function rows(string $sql, array $args = []): array { $s=db()->prepare($sql); $s->execute($args); return $s->fetchAll(); }
function row(string $sql, array $args = []): ?array { return rows($sql,$args)[0] ?? null; }
function execute(string $sql, array $args = []): void { $s=db()->prepare($sql); $s->execute($args); }
function insert(string $table, array $data): int {
    $keys=array_keys($data);
    execute('INSERT INTO cup_'.$table.' ('.implode(',',$keys).') VALUES ('.implode(',',array_fill(0,count($keys),'?')).')',array_values($data));
    return (int)db()->lastInsertId();
}
function now(): string { return gmdate('Y-m-d H:i:s'); }
function h(mixed $s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function fail(string $message, int $status = 422): never { throw new DomainException($message,$status); }
function need(bool $condition, string $message): void { if (!$condition) fail($message); }
function positive(mixed $value): int { need(filter_var($value,FILTER_VALIDATE_INT)!==false && (int)$value>0,'Identificador inválido.'); return (int)$value; }
function text(mixed $value, int $limit=160): string { need(is_string($value),'Texto inválido.'); $s=trim($value); need($s!=='' && mb_strlen($s)<=$limit,'Completa el texto (máximo '.$limit.' caracteres).'); return $s; }
function csrf(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); }
function session_boot(): void {
    if (session_status()===PHP_SESSION_NONE) {
        $sessionPath=(string)config('session_path',CUP_ROOT.'/storage/sessions');
        if(!is_dir($sessionPath) && !@mkdir($sessionPath,0700,true)) throw new RuntimeException('Private session directory unavailable.');
        session_save_path($sessionPath);session_name('SMOKYCUP');
        session_set_cookie_params(['httponly'=>true,'secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS']!=='off','samesite'=>'Lax','path'=>'/']);
        if(!session_start())throw new RuntimeException('Session unavailable.');
    }
}
function user(): ?array {
    session_boot();
    $u=isset($_SESSION['uid']) ? row('SELECT * FROM cup_users WHERE id=? AND active=1',[$_SESSION['uid']]) : null;
    if($u && !hash_equals(hash('sha256',$u['password_hash']),$_SESSION['auth_hash']??'')) return null;
    if($u) unset($u['password_hash']);return $u;
}
function authorized(bool $admin=false): array {
    $u=user(); if (!$u) fail('Inicia sesión.',401);
    if ($admin && $u['role']!=='admin') fail('Acceso reservado al administrador.',403);
    return $u;
}
function audit(int $userId,string $action,string $entity,int $id,array $details=[]): void {
    insert('audit',['user_id'=>$userId?:null,'action'=>$action,'entity'=>$entity,'entity_id'=>$id,'details'=>json_encode($details,JSON_UNESCAPED_UNICODE),'created_at'=>now()]);
}
function transaction(callable $callback): mixed {
    db()->beginTransaction();
    try { $result=$callback(); db()->commit(); return $result; }
    catch (Throwable $e) { if(db()->inTransaction()) db()->rollBack(); throw $e; }
}
function json_response(mixed $data,int $status=200): never {
    http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff'); echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE); exit;
}
require_once __DIR__.'/rules.php';
require_once __DIR__.'/competition.php';
require_once __DIR__.'/matches.php';
