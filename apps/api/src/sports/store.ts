import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  DatabaseService,
  audit,
  type DbContext,
} from '../database/database.service';
import type { Principal } from '../auth/auth.service';
import { fingerprint } from './rules';
export function need(condition: unknown, message: string): asserts condition {
  if (!condition) throw new UnprocessableEntityException(message);
}
export function version(row: any, expected: number) {
  if (row.version !== expected)
    throw new ConflictException({
      code: 'VERSION_CONFLICT',
      message: 'El registro cambió. Actualiza antes de guardar.',
      currentVersion: row.version,
    });
}
export function json(value: any) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}
@Injectable()
export class SportsStore {
  constructor(@Inject(DatabaseService) public db: DatabaseService) {}
  async write<T>(
    actor: Principal,
    admin: boolean,
    fn: (tx: DbContext) => Promise<T>,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM smc_mutex WHERE id=1 FOR UPDATE');
      const [u] = await tx.query('SELECT * FROM smc_users WHERE id=?', [
        actor.id,
      ]);
      if (
        !u?.active ||
        u.version !== actor.version ||
        u.must_change_password ||
        (admin && u.role !== 'admin')
      )
        throw new ForbiddenException(
          'Tu sesión o permisos cambiaron. Inicia sesión.',
        );
      return fn(tx);
    });
  }
  async operation(
    actor: Principal,
    admin: boolean,
    action: string,
    id: string,
    key: unknown,
    body: unknown,
    authorize: (tx: DbContext) => Promise<unknown>,
    fn: (tx: DbContext) => Promise<any>,
  ) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(key))
      throw new UnprocessableEntityException(
        'Se requiere una clave de operación válida.',
      );
    return this.write(actor, admin, async (tx) => {
      await authorize(tx);
      const hash = fingerprint({ action, id, body });
      const [old] = await tx.query(
        'SELECT * FROM smc_operations WHERE request_key=?',
        [key],
      );
      if (old) {
        if (
          old.actor_id !== actor.id ||
          old.payload_hash !== hash ||
          old.action !== action ||
          old.aggregate_id !== id
        )
          throw new ConflictException(
            'La clave de operación ya se utilizó con otros datos.',
          );
        return json(old.response);
      }
      const response = await fn(tx);
      await tx.query(
        'INSERT INTO smc_operations(request_key,actor_id,action,aggregate_id,payload_hash,response,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(3))',
        [key, actor.id, action, id, hash, JSON.stringify(response)],
      );
      await audit(
        tx,
        actor.id,
        action,
        'sports',
        id,
        body as Record<string, unknown>,
      );
      return response;
    });
  }
  async competition(tx: DbContext, id: string, editable = false) {
    const [c] = await tx.query(
      "SELECT c.*,s.archived,s.active,s.timezone,s.name AS season_name,k.name AS category,(SELECT b.id FROM smc_import_batches b WHERE b.season_id=c.season_id AND b.status='promoted' LIMIT 1) AS import_batch_id FROM smc_competitions c JOIN smc_seasons s ON s.id=c.season_id JOIN smc_categories k ON k.id=c.category_id WHERE c.id=? FOR UPDATE",
      [id],
    );
    if (!c) throw new NotFoundException('Competición no encontrada.');
    if (editable) need(!c.archived, 'La temporada está archivada.');
    return c;
  }
  async match(tx: DbContext, id: string) {
    const [m] = await tx.query(
      'SELECT * FROM smc_matches WHERE id=? FOR UPDATE',
      [id],
    );
    if (!m) throw new NotFoundException('Partido no encontrado.');
    return m;
  }
  async matchPermission(tx: DbContext, id: string, actor: Principal) {
    const m = await this.match(tx, id);
    if (actor.role !== 'admin') {
      const [a] = await tx.query(
        'SELECT match_id FROM smc_assignments WHERE match_id=? AND user_id=?',
        [id, actor.id],
      );
      if (!a) throw new ForbiddenException('No tienes asignado este partido.');
    }
    return m;
  }
}
