import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  DatabaseService,
  audit,
  type DbContext,
} from '../database/database.service';
import { passwordHash, passwordMatches, validatePassword } from './password';
export const sessionHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export interface Principal {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'scorer';
  active: boolean;
  mustChangePassword: boolean;
  version: number;
}
export const publicUser = (u: any): Principal => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: !!u.active,
  mustChangePassword: !!u.must_change_password,
  version: u.version,
});
@Injectable()
export class AuthService {
  private dummy = passwordHash(randomBytes(32).toString('hex'));
  constructor(@Inject(DatabaseService) private db: DatabaseService) {}
  async login(email: string, password: string, oldToken?: string) {
    const users = await this.db.query('SELECT * FROM smc_users WHERE email=?', [
      email.toLowerCase().trim(),
    ]);
    const account = users[0];
    const valid = await passwordMatches(
      account?.password_hash ?? (await this.dummy),
      password,
    );
    if (!account || !account.active || !valid)
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    return this.db.transaction(async (tx) => {
      const [current] = await tx.query(
        'SELECT * FROM smc_users WHERE id=? FOR UPDATE',
        [account.id],
      );
      if (
        !current?.active ||
        current.auth_version !== account.auth_version ||
        current.password_hash !== account.password_hash
      )
        throw new UnauthorizedException('Correo o contraseña incorrectos.');
      if (oldToken)
        await tx.query('DELETE FROM smc_sessions WHERE token_hash=?', [
          sessionHash(oldToken),
        ]);
      await tx.query(
        'DELETE FROM smc_sessions WHERE user_id=? AND (expires_at<=UTC_TIMESTAMP(3) OR last_seen_at<=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 HOUR))',
        [current.id],
      );
      const token = await this.mint(tx, current);
      await audit(tx, current.id, 'auth.login', 'user', current.id);
      return { token, user: publicUser(current) };
    });
  }
  private async mint(tx: DbContext, u: any) {
    const token = randomBytes(32).toString('hex');
    await tx.query(
      'INSERT INTO smc_sessions(token_hash,user_id,auth_version,created_at,last_seen_at,expires_at) VALUES (?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 24 HOUR))',
      [sessionHash(token), u.id, u.auth_version],
    );
    return token;
  }
  async resolve(token: unknown) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Inicia sesión.');
    const [account] = await this.db.query(
      'SELECT u.* FROM smc_sessions s JOIN smc_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.auth_version=u.auth_version AND u.active=1 AND s.expires_at>UTC_TIMESTAMP(3) AND s.last_seen_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 HOUR)',
      [sessionHash(token)],
    );
    if (!account)
      throw new UnauthorizedException('La sesión expiró. Inicia sesión.');
    await this.db.query(
      'UPDATE smc_sessions SET last_seen_at=UTC_TIMESTAMP(3) WHERE token_hash=?',
      [sessionHash(token)],
    );
    return publicUser(account);
  }
  async logout(token: string, user: Principal) {
    await this.db.transaction(async (tx) => {
      await tx.query('DELETE FROM smc_sessions WHERE token_hash=?', [
        sessionHash(token),
      ]);
      await audit(tx, user.id, 'auth.logout', 'user', user.id);
    });
  }
  async changePassword(
    user: Principal,
    currentPassword: string,
    newPassword: string,
  ) {
    validatePassword(newPassword);
    const [u] = await this.db.query('SELECT * FROM smc_users WHERE id=?', [
      user.id,
    ]);
    if (!u || !(await passwordMatches(u.password_hash, currentPassword)))
      throw new BadRequestException('La contraseña actual es incorrecta.');
    const hash = await passwordHash(newPassword);
    return this.db.transaction(async (tx) => {
      const [fresh] = await tx.query(
        'SELECT * FROM smc_users WHERE id=? FOR UPDATE',
        [user.id],
      );
      if (!fresh?.active || fresh.auth_version !== u.auth_version)
        throw new UnauthorizedException('La sesión cambió. Inicia sesión.');
      await tx.query(
        'UPDATE smc_users SET password_hash=?,must_change_password=0,auth_version=auth_version+1,version=version+1 WHERE id=?',
        [hash, user.id],
      );
      await tx.query('DELETE FROM smc_sessions WHERE user_id=?', [user.id]);
      fresh.auth_version++;
      fresh.version++;
      fresh.must_change_password = 0;
      const token = await this.mint(tx, fresh);
      await audit(tx, user.id, 'auth.password', 'user', user.id);
      return { token, user: publicUser(fresh) };
    });
  }
  async createInitialAdmin(name: string, email: string, password: string) {
    validatePassword(password);
    const hash = await passwordHash(password);
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM smc_mutex WHERE id=1 FOR UPDATE');
      const [existing] = await tx.query(
        "SELECT id FROM smc_users WHERE role='admin' AND active=1 LIMIT 1",
      );
      if (existing)
        throw new BadRequestException(
          'Ya existe un administrador activo. Crea usuarios desde el panel.',
        );
      const id = randomUUID();
      await tx.query(
        "INSERT INTO smc_users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,'admin',UTC_TIMESTAMP(3))",
        [id, name, email.toLowerCase().trim(), hash],
      );
      await audit(tx, null, 'user.bootstrap', 'user', id);
      return id;
    });
  }
}
