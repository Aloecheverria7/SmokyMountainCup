"""Exercise SMTP against a loopback fake server. No external mail is sent."""
import base64
import os
import socket
import subprocess
import threading
from pathlib import Path
root = Path(__file__).resolve().parents[1]
listener = socket.socket()
listener.bind(('127.0.0.1', 0))
listener.listen(1)
listener.settimeout(15)
port = listener.getsockname()[1]
captured = []
def serve():
    conn, _ = listener.accept()
    conn.settimeout(10)
    with conn, conn.makefile('rb') as stream:
        conn.sendall(b'220 loopback test\r\n')
        while line := stream.readline():
            captured.append(line)
            if line.startswith(b'EHLO'):
                conn.sendall(b'250-loopback\r\n250 SIZE 100000\r\n')
            elif line.startswith((b'MAIL FROM:', b'RCPT TO:')):
                conn.sendall(b'250 OK\r\n')
            elif line == b'DATA\r\n':
                conn.sendall(b'354 Send data\r\n')
                while (part := stream.readline()) != b'.\r\n':
                    if not part:
                        raise RuntimeError('Unexpected disconnect')
                    captured.append(part)
                conn.sendall(b'250 Queued\r\n')
            elif line == b'QUIT\r\n':
                break
    listener.close()
thread = threading.Thread(target=serve, daemon=True)
thread.start()
env = dict(os.environ, APP_SMTP_HOST='127.0.0.1', APP_SMTP_PORT=str(port), APP_SMTP_SECURITY='none', APP_SMTP_USER='', APP_MAIL_FROM='sender@example.test', APP_MAIL_TO='recipient@example.test')
code = "require 'app/mail.php'; smtp_send('Prueba de inscripción', \"Texto de prueba\\n.Gol\\n\", 'reply@example.test'); try { smtp_send('Bad', 'Bad', \"bad@example.test\\r\\nBcc: other@example.test\"); exit(1); } catch (DomainException $e) { echo 'injection rejected'; }"
result = subprocess.run(['php', '-r', code], cwd=root, env=env, capture_output=True, text=True, timeout=20)
thread.join(2)
assert result.returncode == 0, result.stderr + result.stdout
wire = b''.join(captured)
assert b'MAIL FROM:<sender@example.test>' in wire
assert b'RCPT TO:<recipient@example.test>' in wire
assert b'Reply-To: reply@example.test' in wire
assert b'Content-Transfer-Encoding: base64' in wire
assert base64.b64encode('Texto de prueba\n.Gol\n'.encode()) in wire
assert result.stdout == 'injection rejected'
print('PASS SMTP multiline replies, envelope, Reply-To, UTF-8 body, and header-injection rejection; no external delivery.')
