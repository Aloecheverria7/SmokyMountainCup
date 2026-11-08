<?php
require_once __DIR__.'/bootstrap.php';
function smtp_send(string $subject,string $body,string $reply): void {
    $host=(string)config('smtp_host','');$port=(int)config('smtp_port',587);$security=(string)config('smtp_security','tls');
    $from=(string)config('mail_from','');$to=(string)config('mail_to','smokymountaincup@yahoo.com');
    if($host==='' || !filter_var($from,FILTER_VALIDATE_EMAIL) || !filter_var($to,FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Mail delivery has not been configured.');
    need(!preg_match('/[\r\n]/',$host.$from.$to.$reply) && filter_var($reply,FILTER_VALIDATE_EMAIL),'Invalid email address.');
    need(in_array($security,['tls','ssl'],true) || ($security==='none' && in_array($host,['127.0.0.1','localhost'],true)),'SMTP requires TLS.');
    $context=stream_context_create(['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'peer_name'=>$host]]);
    $socket=stream_socket_client(($security==='ssl'?'ssl://':'tcp://').$host.':'.$port,$errno,$error,15,STREAM_CLIENT_CONNECT,$context);
    if(!$socket)throw new RuntimeException('SMTP connection failed.');stream_set_timeout($socket,15);
    $read=static function(array $codes)use($socket):void{
        $last='';$lines=0;do{$line=fgets($socket,4096);if($line===false||++$lines>100)throw new RuntimeException('SMTP response unavailable.');$last=$line;}while(isset($line[3])&&$line[3]==='-');
        if(!in_array((int)substr($last,0,3),$codes,true))throw new RuntimeException('SMTP rejected delivery.');
    };
    $command=static function(string $line,array $codes)use($socket,$read):void {
        $wire=$line."\r\n";$offset=0;
        while($offset<strlen($wire)){$written=fwrite($socket,substr($wire,$offset));if(!$written)throw new RuntimeException('SMTP write failed.');$offset+=$written;}
        $read($codes);
    };
    try {
        $read([220]);$command('EHLO smokymountaincup.local',[250]);
        if($security==='tls'){$command('STARTTLS',[220]);if(!stream_socket_enable_crypto($socket,true,STREAM_CRYPTO_METHOD_TLS_CLIENT))throw new RuntimeException('SMTP TLS failed.');$command('EHLO smokymountaincup.local',[250]);}
        if(config('smtp_user','')!==''){$command('AUTH LOGIN',[334]);$command(base64_encode((string)config('smtp_user')),[334]);$command(base64_encode((string)config('smtp_password','')),[235]);}
        $command('MAIL FROM:<'.$from.'>',[250]);$command('RCPT TO:<'.$to.'>',[250,251]);$command('DATA',[354]);
        $headers=['From: Smoky Mountain Cup <'.$from.'>','To: '.$to,'Reply-To: '.$reply,'Subject: =?UTF-8?B?'.base64_encode($subject).'?=','Date: '.gmdate('r'),'Message-ID: <'.bin2hex(random_bytes(16)).'@'.substr(strrchr($from,'@'),1).'>','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64'];
        $message=implode("\r\n",$headers)."\r\n\r\n".rtrim(chunk_split(base64_encode($body),76,"\r\n"));
        $command($message."\r\n.",[250]);
        // Acceptance above is success; a failed QUIT must not cause a duplicate retry.
        @fwrite($socket,"QUIT\r\n");
    } finally {fclose($socket);}
}
function handle_contact(string $kind): never {
    session_boot();
    try {
        need($_SERVER['REQUEST_METHOD']==='POST','Please submit the contact form.');
        need(is_string($_POST['csrf']??null) && hash_equals(csrf(),$_POST['csrf']),'Your session expired. Reload the form and try again.');
        need(empty($_POST['website']),'Invalid submission.');
        $key=hash('sha256','mail|'.($_SERVER['REMOTE_ADDR']??''));$cut=gmdate('Y-m-d H:i:s',time()-3600);
        need(count(rows('SELECT id FROM cup_login_attempts WHERE identity_hash=? AND created_at>?',[$key,$cut]))<5,'Please wait before sending another message.');
        $fields=match($kind){'registration'=>['team_name'=>120,'owner'=>120,'email'=>160,'phone'=>40,'players_to_enroll'=>6000],'vendor'=>['name'=>120,'email'=>160,'phone'=>40,'product'=>6000],default=>['name'=>120,'email'=>160,'message'=>6000]};
        $data=[];foreach($fields as $field=>$limit)$data[$field]=text($_POST[$field]??'',$limit);
        need((bool)filter_var($data['email'],FILTER_VALIDATE_EMAIL) && !preg_match('/[\r\n]/',$data['email']),'Invalid email address.');
        insert('login_attempts',['identity_hash'=>$key,'created_at'=>now()]);
        $body='Smoky Mountain Cup — '.$kind."\n\n";foreach($data as $key=>$value)$body.=str_replace('_',' ',ucfirst($key)).":\n".$value."\n\n";
        smtp_send('Smoky Mountain Cup: '.$kind,$body,$data['email']);header('Location: thank-you.php',true,303);exit;
    }catch(DomainException $e){http_response_code(422);$message=$e->getMessage();}
    catch(Throwable $e){error_log('Cup mail failed: '.get_class($e));http_response_code(503);$message='Your message could not be sent. Please contact smokymountaincup@yahoo.com or try again later.';}
    $pageTitle='Message not sent · Smoky Mountain Cup';require CUP_ROOT.'/php/secction/header.php';echo '<main id="main-content" class="cup-section"><h1>Message not sent</h1><p>'.h($message).'</p><a href="contact.php">Return to contact</a></main>';require CUP_ROOT.'/php/secction/footer.php';exit;
}
