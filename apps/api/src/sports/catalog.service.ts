import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { audit, type DbContext } from '../database/database.service';
import { pageParams } from '../admin/admin.service';
import type { Principal } from '../auth/auth.service';
import { SportsStore, need, version } from './store';
import type {
  PlayerDto,
  PlayerEditDto,
  VenueDto,
  VenueEditDto,
  FieldDto,
  FieldEditDto,
  RosterDto,
  RosterEditDto,
} from './dto';
export function paged(
  rows: any[],
  limit: number,
  map: (row: any) => any = (r) => r,
) {
  const visible = rows.slice(0, limit);
  return {
    data: visible.map(map),
    page: { nextCursor: rows.length > limit ? visible.at(-1).id : null },
  };
}
const playerSelect =
  "SELECT id,name,DATE_FORMAT(birth_date,'%Y-%m-%d') AS birthDate,contact,archived,version FROM smc_players";
@Injectable()
export class CatalogService {
  constructor(@Inject(SportsStore) private store: SportsStore) {}
  private async row(
    tx: DbContext,
    table:
      | 'smc_players'
      | 'smc_rosters'
      | 'smc_entries'
      | 'smc_venues'
      | 'smc_fields',
    id: string,
  ) {
    const [r] = await tx.query(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`, [
      id,
    ]);
    if (!r) throw new NotFoundException('Registro no encontrado.');
    return r;
  }
  async list(
    kind: 'players' | 'venues' | 'fields',
    query: Record<string, unknown>,
  ) {
    const { limit, cursor } = pageParams(query);
    const sql =
      kind === 'players'
        ? playerSelect
        : kind === 'venues'
          ? 'SELECT id,name,address,archived,version FROM smc_venues'
          : 'SELECT f.id,f.name,f.venue_id AS venueId,v.name AS venue,f.archived,f.version,v.archived AS venueArchived FROM smc_fields f JOIN smc_venues v ON v.id=f.venue_id';
    const id = kind === 'fields' ? 'f.id' : 'id';
    return paged(
      await this.store.db.query(
        sql + ` WHERE (? IS NULL OR ${id}>?) ORDER BY ${id} LIMIT ?`,
        [cursor ?? null, cursor ?? null, limit + 1],
      ),
      limit,
      (r) => ({
        ...r,
        archived: !!r.archived,
        ...(kind === 'fields' ? { venueArchived: !!r.venueArchived } : {}),
      }),
    );
  }
  async player(actor: Principal, d: PlayerDto | PlayerEditDto, id?: string) {
    if (d.birthDate) {
      const date = DateTime.fromISO(d.birthDate, { zone: 'UTC' });
      need(
        /^\d{4}-\d{2}-\d{2}$/.test(d.birthDate) &&
          date.isValid &&
          date.toISODate() === d.birthDate &&
          d.birthDate <= DateTime.utc().toISODate()!,
        'Fecha de nacimiento inválida.',
      );
    }
    return this.store.write(actor, true, async (tx) => {
      if (id) {
        const p = await this.row(tx, 'smc_players', id);
        version(p, (d as PlayerEditDto).expectedVersion);
        need(!p.archived, 'El jugador está archivado.');
        await tx.query(
          'UPDATE smc_players SET name=?,birth_date=?,contact=?,version=version+1 WHERE id=?',
          [d.name, d.birthDate ?? null, d.contact ?? null, id],
        );
      } else {
        id = randomUUID();
        await tx.query(
          'INSERT INTO smc_players(id,name,birth_date,contact,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP(3))',
          [id, d.name, d.birthDate ?? null, d.contact ?? null],
        );
      }
      await audit(tx, actor.id, 'player.save', 'player', id, { name: d.name });
      const [row] = await tx.query(playerSelect + ' WHERE id=?', [id]);
      return { data: { ...row, archived: !!row.archived } };
    });
  }
  async archive(
    actor: Principal,
    kind: 'players' | 'venues' | 'fields',
    id: string,
    expected: number,
  ) {
    return this.store.write(actor, true, async (tx) => {
      const table =
        kind === 'players'
          ? 'smc_players'
          : kind === 'venues'
            ? 'smc_venues'
            : 'smc_fields';
      const row = await this.row(tx, table, id);
      version(row, expected);
      need(!row.archived, 'El registro ya está archivado.');
      await tx.query(
        `UPDATE ${table} SET archived=1,version=version+1 WHERE id=?`,
        [id],
      );
      await audit(tx, actor.id, kind + '.archive', kind, id);
      return { data: { id, archived: true, version: row.version + 1 } };
    });
  }
  async venue(actor: Principal, d: VenueDto | VenueEditDto, id?: string) {
    return this.store.write(actor, true, async (tx) => {
      if (id) {
        const old = await this.row(tx, 'smc_venues', id);
        version(old, (d as VenueEditDto).expectedVersion);
        need(!old.archived, 'La sede está archivada.');
        await tx.query(
          'UPDATE smc_venues SET name=?,address=?,version=version+1 WHERE id=?',
          [d.name, d.address ?? '', id],
        );
      } else {
        id = randomUUID();
        await tx.query(
          'INSERT INTO smc_venues(id,name,address) VALUES (?,?,?)',
          [id, d.name, d.address ?? ''],
        );
      }
      await audit(tx, actor.id, 'venue.save', 'venue', id, { name: d.name });
      return { data: await this.row(tx, 'smc_venues', id) };
    });
  }
  async field(actor: Principal, d: FieldDto | FieldEditDto, id?: string) {
    return this.store.write(actor, true, async (tx) => {
      if (id) {
        const old = await this.row(tx, 'smc_fields', id);
        version(old, (d as FieldEditDto).expectedVersion);
        need(!old.archived, 'La cancha está archivada.');
        const venue = await this.row(tx, 'smc_venues', old.venue_id);
        need(!venue.archived, 'La sede está archivada.');
        await tx.query(
          'UPDATE smc_fields SET name=?,version=version+1 WHERE id=?',
          [d.name, id],
        );
      } else {
        const v = await this.row(tx, 'smc_venues', (d as FieldDto).venueId);
        need(!v.archived, 'La sede está archivada.');
        id = randomUUID();
        await tx.query(
          'INSERT INTO smc_fields(id,venue_id,name) VALUES (?,?,?)',
          [id, v.id, d.name],
        );
      }
      await audit(tx, actor.id, 'field.save', 'field', id, { name: d.name });
      const row = await this.row(tx, 'smc_fields', id);
      return {
        data: {
          id: row.id,
          name: row.name,
          venueId: row.venue_id,
          archived: !!row.archived,
          version: row.version,
        },
      };
    });
  }
  async roster(entryId: string) {
    const [entry] = await this.store.db.query(
      'SELECT id FROM smc_entries WHERE id=?',
      [entryId],
    );
    if (!entry) throw new NotFoundException('Inscripción no encontrada.');
    return {
      data: await this.store.db.query(
        'SELECT r.id,r.entry_id AS entryId,r.player_id AS playerId,r.number,r.version,p.name,p.archived FROM smc_rosters r JOIN smc_players p ON p.id=r.player_id WHERE r.entry_id=? ORDER BY r.number,r.id',
        [entryId],
      ),
    };
  }
  async saveRoster(
    actor: Principal,
    d: RosterDto | RosterEditDto,
    entryId?: string,
    id?: string,
  ) {
    return this.store.write(actor, true, async (tx) => {
      let row: any;
      if (id) {
        row = await this.row(tx, 'smc_rosters', id);
        version(row, (d as RosterEditDto).expectedVersion);
        entryId = row.entry_id;
      }
      const entry = await this.row(tx, 'smc_entries', entryId!);
      await this.store.competition(tx, entry.competition_id, true);
      if (id)
        await tx.query(
          'UPDATE smc_rosters SET number=?,version=version+1 WHERE id=?',
          [d.number, id],
        );
      else {
        const player = await this.row(
          tx,
          'smc_players',
          (d as RosterDto).playerId,
        );
        need(!player.archived, 'El jugador está archivado.');
        id = randomUUID();
        await tx.query(
          'INSERT INTO smc_rosters(id,entry_id,competition_id,player_id,number) VALUES (?,?,?,?,?)',
          [id, entryId, entry.competition_id, player.id, d.number],
        );
      }
      await audit(tx, actor.id, 'roster.save', 'roster', id, {
        entryId,
        number: d.number,
      });
      row = await this.row(tx, 'smc_rosters', id);
      return {
        data: {
          id: row.id,
          entryId: row.entry_id,
          competitionId: row.competition_id,
          playerId: row.player_id,
          number: row.number,
          version: row.version,
        },
      };
    });
  }
}
