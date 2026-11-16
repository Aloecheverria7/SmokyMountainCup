"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompetitionService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const store_1 = require("./store");
const rules_1 = require("./rules");
const queries_1 = require("./queries");
let CompetitionService = class CompetitionService {
    store;
    constructor(store) {
        this.store = store;
    }
    async state(tx, c) {
        const entries = await tx.query('SELECT id,team_id FROM smc_entries WHERE competition_id=? ORDER BY id', [c.id]);
        return {
            entries,
            fingerprint: (0, rules_1.fingerprint)({
                version: c.version,
                duration: c.duration,
                capacity: c.group_capacity,
                qualifiers: c.qualifiers,
                rules: c.rules_confirmed,
                entries,
            }),
        };
    }
    async resettable(tx, id) {
        const [imported] = await tx.query('SELECT b.id FROM smc_import_batches b JOIN smc_competitions c ON c.season_id=b.season_id WHERE c.id=? LIMIT 1', [id]);
        (0, store_1.need)(!imported, 'Los grupos y partidos importados deben conservarse; no se pueden reemplazar mediante un sorteo.');
        const matches = await tx.query('SELECT * FROM smc_matches WHERE competition_id=?', [id]);
        (0, store_1.need)(matches.every((m) => m.status === 'scheduled' && !m.scheduled_at && !m.field_id), 'Retira los horarios y conserva los partidos iniciados; no se puede reemplazar el sorteo.');
        const [events] = await tx.query('SELECT COUNT(*) AS n FROM smc_events e JOIN smc_matches m ON m.id=e.match_id WHERE m.competition_id=?', [id]);
        (0, store_1.need)(Number(events.n) === 0, 'El sorteo tiene eventos registrados.');
    }
    async clear(tx, cid) {
        await tx.query('DELETE a FROM smc_assignments a JOIN smc_matches m ON m.id=a.match_id WHERE m.competition_id=?', [cid]);
        await tx.query('UPDATE smc_matches SET source_home_id=NULL,source_away_id=NULL WHERE competition_id=?', [cid]);
        await tx.query('DELETE FROM smc_matches WHERE competition_id=?', [cid]);
        await tx.query('DELETE FROM smc_group_entries WHERE competition_id=?', [
            cid,
        ]);
    }
    async preview(actor, cid, d) {
        return this.store.write(actor, true, async (tx) => {
            const c = await this.store.competition(tx, cid, true);
            (0, store_1.need)(c.rules_confirmed, 'Confirma el reglamento antes de generar el sorteo.');
            await this.resettable(tx, cid);
            const state = await this.state(tx, c);
            let ids = state.entries.map((e) => e.id);
            (0, store_1.need)(ids.length >= 4 && ids.length <= 2 * c.group_capacity, 'Se necesitan al menos dos equipos por grupo y capacidad suficiente.');
            if (d.mode === 'manual') {
                const order = d.entryIds ?? [];
                (0, store_1.need)(order.length === ids.length &&
                    new Set(order).size === ids.length &&
                    order.every((id) => ids.includes(id)), 'Incluye cada inscripción exactamente una vez.');
                ids = [...order];
            }
            else
                for (let i = ids.length - 1; i > 0; i--) {
                    const j = (0, node_crypto_1.randomInt)(i + 1);
                    [ids[i], ids[j]] = [ids[j], ids[i]];
                }
            const groups = [
                ids.filter((_, i) => i % 2 === 0),
                ids.filter((_, i) => i % 2 === 1),
            ];
            (0, store_1.need)(groups.every((g) => c.qualifiers < g.length), 'Cada grupo debe tener más equipos que plazas clasificatorias.');
            const id = (0, node_crypto_1.randomUUID)();
            await tx.query('INSERT INTO smc_draw_previews(id,competition_id,actor_id,fingerprint,payload,expires_at) VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 MINUTE))', [id, cid, actor.id, state.fingerprint, JSON.stringify({ groups })]);
            const teams = await tx.query('SELECT e.id,t.name FROM smc_entries e JOIN smc_teams t ON t.id=e.team_id WHERE e.competition_id=?', [cid]);
            return {
                data: {
                    id,
                    competitionId: cid,
                    fingerprint: state.fingerprint,
                    groups: groups.map((g, i) => ({
                        name: i === 0 ? 'A' : 'B',
                        entries: g.map((id) => teams.find((t) => t.id === id)),
                    })),
                    expiresInSeconds: 1800,
                },
            };
        });
    }
    async publish(actor, cid, key, d) {
        return this.store.operation(actor, true, 'draw.publish', cid, key, d, (tx) => this.store.competition(tx, cid), async (tx) => {
            const c = await this.store.competition(tx, cid, true);
            const [p] = await tx.query('SELECT * FROM smc_draw_previews WHERE id=? AND competition_id=? AND actor_id=? AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE', [d.previewId, cid, actor.id]);
            (0, store_1.need)(p && !p.consumed, 'La vista previa caducó o ya se publicó.');
            const state = await this.state(tx, c);
            (0, store_1.need)(state.fingerprint === p.fingerprint, 'Los equipos o las reglas cambiaron; genera otra vista previa.');
            await this.resettable(tx, cid);
            await this.clear(tx, cid);
            const groups = await tx.query('SELECT id,name FROM smc_groups WHERE competition_id=? ORDER BY name', [cid]);
            (0, store_1.need)(groups.length === 2, 'Se requieren grupos A y B.');
            const payload = (0, store_1.json)(p.payload);
            let count = 0;
            for (let i = 0; i < 2; i++) {
                const entries = payload.groups[i];
                for (const entry of entries)
                    await tx.query('INSERT INTO smc_group_entries(id,group_id,entry_id,competition_id) VALUES (?,?,?,?)', [(0, node_crypto_1.randomUUID)(), groups[i].id, entry, cid]);
                for (let a = 0; a < entries.length; a++)
                    for (let b = a + 1; b < entries.length; b++) {
                        await this.newMatch(tx, cid, entries[a], entries[b], {
                            groupId: groups[i].id,
                            position: ++count,
                        });
                    }
            }
            await tx.query('UPDATE smc_draw_previews SET consumed=1 WHERE id=?', [
                p.id,
            ]);
            await tx.query('UPDATE smc_competitions SET published=1,version=version+1 WHERE id=?', [cid]);
            return {
                data: {
                    id: cid,
                    version: c.version + 1,
                    matches: count,
                    published: true,
                },
            };
        });
    }
    async importedPublication(actor, cid, key, d) {
        return this.store.operation(actor, true, 'import.publication', cid, key, d, (tx) => this.store.competition(tx, cid), async (tx) => {
            const c = await this.store.competition(tx, cid, true);
            (0, store_1.need)(c.import_batch_id, 'La competición no pertenece a un lote importado.');
            (0, store_1.version)(c, d.expectedVersion);
            if (d.published) {
                (0, store_1.need)(c.rules_confirmed, 'Confirma las reglas antes de publicar los datos importados.');
                const [batch] = await tx.query('SELECT * FROM smc_import_batches WHERE id=?', [c.import_batch_id]);
                (0, store_1.need)(batch?.status === 'promoted' &&
                    batch.baseline_policy === 'reviewed-initial', 'El lote no tiene una base estadística revisada.');
                const plan = (0, store_1.json)(batch.plan);
                const records = await tx.query('SELECT * FROM smc_legacy_records WHERE batch_id=?', [batch.id]);
                (0, store_1.need)(records.length === plan.totalRows &&
                    records.every((r) => (0, rules_1.fingerprint)((0, store_1.json)(r.payload)) === r.payload_hash &&
                        plan.originalRecords[r.source_table]?.[r.row_no] &&
                        (0, rules_1.fingerprint)(plan.originalRecords[r.source_table][r.row_no]) === r.payload_hash), 'La integridad del origen importado no coincide.');
                const entries = await (0, queries_1.standingRows)(tx, cid);
                const groups = await tx.query('SELECT id,name FROM smc_groups WHERE competition_id=?', [cid]);
                (0, store_1.need)(groups.length === 2 &&
                    ['A', 'B'].every((name) => groups.some((g) => g.name === name)) &&
                    entries.length > 0 &&
                    entries.every((e) => e.group_id), 'Cada inscripción importada debe conservar su grupo A/B.');
                const slug = (await tx.query('SELECT slug FROM smc_categories WHERE id=?', [
                    c.category_id,
                ]))[0].slug;
                const expectedStats = plan.originalRecords.team_stats.filter((stat) => plan.entries.some((entry) => entry.competition === slug &&
                    entry.sourceTeamId === stat.team_id));
                const snapshots = await tx.query('SELECT ls.*,d.chosen_values FROM smc_legacy_stats ls JOIN smc_entries e ON e.id=ls.entry_id JOIN smc_import_decisions d ON d.id=ls.decision_id WHERE e.competition_id=?', [cid]);
                (0, store_1.need)(snapshots.length === expectedStats.length &&
                    snapshots.every((s) => s.batch_id === batch.id &&
                        expectedStats.some((original) => Number(s.source_team_id) === original.team_id &&
                            (0, rules_1.fingerprint)((0, store_1.json)(s.original_values)) ===
                                (0, rules_1.fingerprint)(original)) &&
                        (0, rules_1.fingerprint)((0, store_1.json)(s.reviewed_values)) ===
                            (0, rules_1.fingerprint)((0, store_1.json)(s.chosen_values))), 'Las estadísticas revisadas no coinciden con sus decisiones.');
                const mappedMatches = await tx.query("SELECT lm.target_id FROM smc_legacy_mappings lm JOIN smc_matches m ON m.id=lm.target_id WHERE lm.batch_id=? AND lm.source_table='games' AND lm.target_table='smc_matches' AND m.competition_id=?", [batch.id, cid]);
                (0, store_1.need)(mappedMatches.length ===
                    plan.competitions.find((p) => p.slug === slug)?.matches, 'Faltan partidos originales vinculados.');
            }
            await tx.query('UPDATE smc_competitions SET published=?,version=version+1 WHERE id=?', [d.published, cid]);
            const [count] = await tx.query('SELECT COUNT(*) AS n FROM smc_matches WHERE competition_id=?', [cid]);
            return {
                data: {
                    id: cid,
                    version: c.version + 1,
                    published: d.published,
                    imported: true,
                    matches: Number(count.n),
                },
            };
        });
    }
    async reset(actor, cid, key, d) {
        return this.store.operation(actor, true, 'draw.reset', cid, key, d, (tx) => this.store.competition(tx, cid), async (tx) => {
            const c = await this.store.competition(tx, cid, true);
            (0, store_1.version)(c, d.expectedVersion);
            await this.resettable(tx, cid);
            await this.clear(tx, cid);
            await tx.query('UPDATE smc_competitions SET published=0,version=version+1 WHERE id=?', [cid]);
            return { data: { id: cid, version: c.version + 1, published: false } };
        });
    }
    async newMatch(tx, cid, home, away, extra) {
        const id = (0, node_crypto_1.randomUUID)();
        await tx.query('INSERT INTO smc_matches(id,competition_id,group_id,stage,round_no,position_no,home_entry_id,away_entry_id,source_home_id,source_away_id,status,confirmed,winner_entry_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3))', [
            id,
            cid,
            extra.groupId ?? null,
            extra.groupId ? 'group' : 'knockout',
            extra.round ?? 0,
            extra.position,
            home,
            away,
            extra.sourceHome ?? null,
            extra.sourceAway ?? null,
            extra.bye ? 'finished' : 'scheduled',
            !!extra.bye,
            extra.bye ? home : null,
        ]);
        return id;
    }
    async knockout(tx, cid, ids) {
        const previous = [];
        for (const [index, [home, away]] of (0, rules_1.knockoutPairs)(ids).entries())
            previous.push(await this.newMatch(tx, cid, home, away, {
                round: 1,
                position: index + 1,
                bye: !away,
            }));
        await this.appendRounds(tx, cid, previous, 1);
        await this.advance(tx, cid);
    }
    async appendRounds(tx, cid, previous, round) {
        while (previous.length > 1) {
            (0, store_1.need)(previous.length % 2 === 0, 'La ronda no está completa.');
            const next = [];
            round++;
            for (let i = 0; i < previous.length; i += 2)
                next.push(await this.newMatch(tx, cid, null, null, {
                    round,
                    position: i / 2 + 1,
                    sourceHome: previous[i],
                    sourceAway: previous[i + 1],
                }));
            previous = next;
        }
    }
    async advance(tx, cid) {
        const c = await this.store.competition(tx, cid);
        const matches = await tx.query("SELECT * FROM smc_matches WHERE competition_id=? AND stage='knockout' ORDER BY round_no,position_no", [cid]);
        for (const m of matches) {
            let changed = false;
            for (const side of ['home', 'away'])
                if (m['source_' + side + '_id']) {
                    const [source] = await tx.query('SELECT confirmed,winner_entry_id FROM smc_matches WHERE id=?', [m['source_' + side + '_id']]);
                    if (source?.confirmed &&
                        m[side + '_entry_id'] !== source.winner_entry_id) {
                        (0, store_1.need)(m.status === 'scheduled', 'Una ronda posterior ya comenzó.');
                        m[side + '_entry_id'] = source.winner_entry_id;
                        changed = true;
                    }
                }
            if (changed) {
                if (m.scheduled_at) {
                    try {
                        await (0, queries_1.checkSchedule)(tx, m, m.field_id, (0, rules_1.dbDate)(m.scheduled_at), c.duration);
                    }
                    catch {
                        throw new common_1.UnprocessableEntityException('El avance genera un conflicto horario. Ajusta la programación de la siguiente ronda.');
                    }
                }
                await tx.query('UPDATE smc_matches SET home_entry_id=?,away_entry_id=?,version=version+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?', [m.home_entry_id, m.away_entry_id, m.id]);
            }
        }
    }
    async qualify(actor, cid, key, d) {
        return this.store.operation(actor, true, 'competition.qualify', cid, key, d, (tx) => this.store.competition(tx, cid), async (tx) => {
            const c = await this.store.competition(tx, cid, true);
            (0, store_1.version)(c, d.expectedVersion);
            const matches = await tx.query('SELECT * FROM smc_matches WHERE competition_id=?', [cid]);
            (0, store_1.need)(matches.length > 0 &&
                !matches.some((m) => m.stage === 'knockout'), 'Genera los grupos; no puede haber eliminatorias existentes.');
            (0, store_1.need)(matches.every((m) => m.status === 'finished' && m.confirmed), 'Finaliza y confirma todos los partidos de grupos.');
            const table = (0, rules_1.standings)(await (0, queries_1.standingRows)(tx, cid), matches, c);
            const groups = new Map();
            for (const e of table) {
                if (!groups.has(e.group_id))
                    groups.set(e.group_id, []);
                groups.get(e.group_id).push(e);
            }
            (0, store_1.need)(groups.size === 2 &&
                d.entryIds.length === groups.size * c.qualifiers &&
                new Set(d.entryIds).size === d.entryIds.length, 'Cantidad de clasificados incorrecta.');
            for (const entries of groups.values()) {
                const chosen = entries.filter((e) => d.entryIds.includes(e.id)), cutoff = entries[c.qualifiers - 1];
                (0, store_1.need)(cutoff && chosen.length === c.qualifiers, 'Selecciona el cupo de cada grupo.');
                for (const e of entries) {
                    if ((0, rules_1.sportingRank)(e, cutoff) < 0)
                        (0, store_1.need)(d.entryIds.includes(e.id), 'No puedes excluir a un equipo mejor clasificado.');
                    if (d.entryIds.includes(e.id))
                        (0, store_1.need)((0, rules_1.sportingRank)(e, cutoff) <= 0, 'Un equipo seleccionado no alcanza el corte.');
                }
                const tied = entries.filter((e) => (0, rules_1.sportingRank)(e, cutoff) === 0);
                if (tied.some((e) => !d.entryIds.includes(e.id)) &&
                    tied.some((e) => d.entryIds.includes(e.id)))
                    (0, store_1.need)(d.tieReason?.trim(), 'Indica el motivo para resolver el empate exacto.');
            }
            await this.knockout(tx, cid, d.entryIds);
            await tx.query('UPDATE smc_competitions SET version=version+1 WHERE id=?', [cid]);
            return { data: { id: cid, version: c.version + 1 } };
        });
    }
    async removeRounds(actor, cid, key, d) {
        return this.store.operation(actor, true, 'rounds.remove', cid, key, d, (tx) => this.store.competition(tx, cid), async (tx) => {
            const c = await this.store.competition(tx, cid, true);
            (0, store_1.version)(c, d.expectedVersion);
            const matches = await tx.query("SELECT * FROM smc_matches WHERE competition_id=? AND stage='knockout' AND round_no>=?", [cid, d.fromRound]);
            (0, store_1.need)(matches.length, 'No hay rondas que retirar.');
            (0, store_1.need)(matches.every((m) => m.status === 'scheduled' ||
                (m.confirmed && !m.away_entry_id && !m.source_home_id)), 'Hay rondas posteriores iniciadas; no se pueden borrar.');
            for (const m of matches) {
                const [e] = await tx.query('SELECT id FROM smc_events WHERE match_id=? LIMIT 1', [m.id]);
                (0, store_1.need)(!e, 'Una ronda tiene eventos registrados.');
                await tx.query('DELETE FROM smc_assignments WHERE match_id=?', [
                    m.id,
                ]);
                await tx.query('UPDATE smc_matches SET source_home_id=NULL,source_away_id=NULL WHERE id=?', [m.id]);
            }
            for (const m of matches)
                await tx.query('DELETE FROM smc_matches WHERE id=?', [m.id]);
            await tx.query('UPDATE smc_competitions SET version=version+1 WHERE id=?', [cid]);
            return {
                data: { id: cid, version: c.version + 1, removed: matches.length },
            };
        });
    }
    async rebuild(actor, cid, key, d) {
        return this.store.operation(actor, true, 'rounds.rebuild', cid, key, d, (tx) => this.store.competition(tx, cid), async (tx) => {
            const c = await this.store.competition(tx, cid, true);
            (0, store_1.version)(c, d.expectedVersion);
            const [last] = await tx.query("SELECT MAX(round_no) AS n FROM smc_matches WHERE competition_id=? AND stage='knockout'", [cid]);
            (0, store_1.need)(last.n, 'No hay eliminatorias que reconstruir.');
            const previous = await tx.query("SELECT id FROM smc_matches WHERE competition_id=? AND stage='knockout' AND round_no=? ORDER BY position_no", [cid, last.n]);
            (0, store_1.need)(previous.length > 1, 'Las llaves ya están completas.');
            await this.appendRounds(tx, cid, previous.map((m) => m.id), last.n);
            await this.advance(tx, cid);
            await tx.query('UPDATE smc_competitions SET version=version+1 WHERE id=?', [cid]);
            return { data: { id: cid, version: c.version + 1 } };
        });
    }
};
exports.CompetitionService = CompetitionService;
exports.CompetitionService = CompetitionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(store_1.SportsStore)),
    __metadata("design:paramtypes", [store_1.SportsStore])
], CompetitionService);
