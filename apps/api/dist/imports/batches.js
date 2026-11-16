"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportBatches = void 0;
exports.requireIsolatedTarget = requireIsolatedTarget;
exports.chosenStats = chosenStats;
const node_crypto_1 = require("node:crypto");
const database_service_1 = require("../database/database.service");
const legacy_1 = require("./legacy");
const decode = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const stable = (v) => v && typeof v === 'object'
    ? Array.isArray(v)
        ? '[' + v.map(stable).join(',') + ']'
        : '{' +
            Object.keys(v)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + stable(v[k]))
                .join(',') +
            '}'
    : JSON.stringify(v);
const hash = (v) => (0, node_crypto_1.createHash)('sha256').update(stable(v)).digest('hex');
function check(value, message) {
    if (!value)
        throw Error(message);
}
function requireIsolatedTarget(options, env = process.env) {
    check(env.NODE_ENV === 'test' &&
        env.LEGACY_IMPORT_ISOLATED === '1' &&
        ['127.0.0.1', '::1', 'localhost'].includes(options.host || '') &&
        /^smoky_(?:system|import)_test_[a-f0-9]{10}$/.test(String(options.database)), 'Importación habilitada únicamente en una base local aislada de prueba.');
}
const statKeys = [
    'games_played',
    'wins',
    'draws',
    'losses',
    'goals_scored',
    'goals_conceded',
    'goal_difference',
    'points',
];
function chosenStats(original, decision) {
    check(decision &&
        Object.keys(decision).every((k) => [
            'sourceTeamId',
            'expectedRevision',
            'mode',
            'values',
            'reason',
        ].includes(k)), 'Campos de decisión no admitidos.');
    check(Number.isSafeInteger(decision.sourceTeamId) &&
        decision.sourceTeamId > 0 &&
        Number.isSafeInteger(decision.expectedRevision) &&
        decision.expectedRevision >= 0, 'ID o revisión inválidos.');
    check(typeof decision.reason === 'string' &&
        decision.reason.trim().length >= 10 &&
        decision.reason.length <= 1000, 'Cada decisión requiere un motivo de 10 a 1000 caracteres.');
    check(['preserve', 'correct'].includes(decision.mode), 'Modo no admitido.');
    if (decision.mode === 'preserve') {
        check(decision.values === undefined, 'Conservar no admite valores sustitutos.');
        return { ...original };
    }
    const v = decision.values;
    check(v &&
        Object.keys(v).length === statKeys.length &&
        statKeys.every((k) => Number.isSafeInteger(v[k]) && Math.abs(v[k]) <= 2147483647), 'Corregir requiere las ocho métricas enteras.');
    check(statKeys
        .filter((k) => !['goal_difference', 'points'].includes(k))
        .every((k) => v[k] >= 0), 'Contadores negativos no admitidos.');
    check(v.games_played === v.wins + v.draws + v.losses &&
        v.goal_difference === v.goals_scored - v.goals_conceded, 'La corrección debe conciliar PJ y DG. Los puntos requieren revisión del reglamento.');
    return { ...original, ...v };
}
class ImportBatches {
    db;
    constructor(db) {
        this.db = db;
        requireIsolatedTarget(db.options);
    }
    async write(actor, fn) {
        requireIsolatedTarget(this.db.options);
        return this.db.transaction('READ COMMITTED', async (tx) => {
            await tx.query('SELECT id FROM smc_mutex WHERE id=1 FOR UPDATE');
            const [user] = await tx.query('SELECT * FROM smc_users WHERE id=?', [
                actor,
            ]);
            check(user?.active && user.role === 'admin' && !user.must_change_password, 'Se requiere un administrador activo con contraseña actualizada.');
            return fn(tx);
        });
    }
    async batch(tx, id) {
        const [b] = await tx.query('SELECT * FROM smc_import_batches WHERE id=?', [
            id,
        ]);
        check(b, 'Lote no encontrado.');
        b.plan = decode(b.plan);
        return b;
    }
    async stage(actor, tables, sourceHash, mapping = legacy_1.DEFAULT_MAPPING) {
        check(/^[a-f0-9]{64}$/.test(sourceHash), 'SHA-256 inválido.');
        const plan = (0, legacy_1.buildPlan)(tables, sourceHash, mapping);
        return this.write(actor, async (tx) => {
            const [old] = await tx.query('SELECT * FROM smc_import_batches WHERE id=?', [plan.planId]);
            if (old && old.status !== 'failed') {
                check(hash(decode(old.plan)) === hash(plan), 'El lote existente no coincide con el contenido.');
                return {
                    batchId: plan.planId,
                    status: old.status,
                    rows: plan.totalRows,
                    reused: true,
                };
            }
            if (old) {
                check(hash(decode(old.plan)) === hash(plan), 'El lote fallido no coincide con el contenido.');
                await tx.query('UPDATE smc_import_batches SET status=?,error_code=NULL WHERE id=?', ['staged', plan.planId]);
                const [stored] = await tx.query('SELECT COUNT(*) AS n FROM smc_legacy_records WHERE batch_id=?', [plan.planId]);
                if (Number(stored.n) === plan.totalRows)
                    return {
                        batchId: plan.planId,
                        status: 'staged',
                        rows: plan.totalRows,
                        reused: true,
                    };
                check(Number(stored.n) === 0, 'Staging incompleto: revisar integridad.');
            }
            else
                await tx.query('INSERT INTO smc_import_batches(id,source_hash,status,plan,created_by,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(3))', [plan.planId, sourceHash, 'staged', JSON.stringify(plan), actor]);
            for (const table of legacy_1.TABLES)
                for (const [i, row] of tables[table].entries())
                    await tx.query('INSERT INTO smc_legacy_records(batch_id,source_table,row_no,source_id,payload,payload_hash) VALUES (?,?,?,?,?,?)', [
                        plan.planId,
                        table,
                        i,
                        table === 'team_stats' ? row.team_id : row.id,
                        JSON.stringify(row),
                        hash(row),
                    ]);
            await (0, database_service_1.audit)(tx, actor, 'import.stage', 'import', (0, node_crypto_1.randomUUID)(), {
                batchId: plan.planId,
                sourceHash,
                totalRows: plan.totalRows,
            });
            return {
                batchId: plan.planId,
                status: 'staged',
                rows: plan.totalRows,
                reused: false,
            };
        });
    }
    async decide(actor, id, decisions) {
        check(Array.isArray(decisions) &&
            decisions.length > 0 &&
            decisions.length <= 10000 &&
            new Set(decisions.map((d) => d.sourceTeamId)).size === decisions.length, 'Lista de decisiones inválida o repetida.');
        return this.write(actor, async (tx) => {
            const b = await this.batch(tx, id);
            check(b.status !== 'promoted', 'El lote promovido es inmutable.');
            for (const decision of decisions) {
                const original = b.plan.originalRecords.team_stats.find((r) => r.team_id === decision.sourceTeamId);
                check(original, 'La estadística no pertenece al lote.');
                const values = chosenStats(original, decision);
                const [last] = await tx.query('SELECT revision FROM smc_import_decisions WHERE batch_id=? AND source_team_id=? ORDER BY revision DESC LIMIT 1', [id, decision.sourceTeamId]);
                check((last?.revision || 0) === decision.expectedRevision, 'La resolución cambió. Actualiza la revisión.');
                const decisionId = (0, node_crypto_1.randomUUID)();
                await tx.query('INSERT INTO smc_import_decisions(id,batch_id,source_team_id,revision,mode,chosen_values,reason,actor_id,created_at) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3))', [
                    decisionId,
                    id,
                    decision.sourceTeamId,
                    decision.expectedRevision + 1,
                    decision.mode,
                    JSON.stringify(values),
                    decision.reason.trim(),
                    actor,
                ]);
                await (0, database_service_1.audit)(tx, actor, 'import.decide', 'import', decisionId, {
                    batchId: id,
                    sourceTeamId: decision.sourceTeamId,
                    revision: decision.expectedRevision + 1,
                    mode: decision.mode,
                    reason: decision.reason.trim(),
                });
            }
            return { batchId: id, decisions: decisions.length };
        });
    }
    async inspect(tx, id) {
        const b = await this.batch(tx, id);
        const records = await tx.query('SELECT * FROM smc_legacy_records WHERE batch_id=? ORDER BY source_table,row_no', [id]);
        check(records.length === b.plan.totalRows, 'Conteo de staging incompatible.');
        for (const r of records) {
            const expected = b.plan.originalRecords[r.source_table]?.[r.row_no];
            check(expected &&
                hash(decode(r.payload)) === hash(expected) &&
                r.payload_hash === hash(expected), 'La integridad de las filas originales no coincide.');
        }
        const decisions = await tx.query('SELECT d.* FROM smc_import_decisions d WHERE batch_id=? AND revision=(SELECT MAX(x.revision) FROM smc_import_decisions x WHERE x.batch_id=d.batch_id AND x.source_team_id=d.source_team_id) ORDER BY source_team_id', [id]);
        for (const d of decisions)
            d.source_team_id = Number(d.source_team_id);
        const pending = b.plan.originalRecords.team_stats
            .filter((r) => !decisions.some((d) => d.source_team_id === r.team_id))
            .map((r) => r.team_id);
        const mappings = await tx.query('SELECT * FROM smc_legacy_mappings WHERE batch_id=?', [id]);
        if (b.status === 'promoted') {
            const snapshots = await tx.query('SELECT * FROM smc_legacy_stats WHERE batch_id=?', [id]);
            check(snapshots.length === b.plan.originalRecords.team_stats.length, 'Conteo de snapshots incompatible.');
            for (const snapshot of snapshots) {
                const original = b.plan.originalRecords.team_stats.find((r) => r.team_id === Number(snapshot.source_team_id));
                const decision = decisions.find((d) => d.id === snapshot.decision_id);
                check(original &&
                    decision &&
                    hash(original) === hash(decode(snapshot.original_values)) &&
                    hash(decode(snapshot.reviewed_values)) ===
                        hash(decode(decision.chosen_values)), 'La integridad de las estadísticas originales o revisadas no coincide.');
            }
            const allowed = [
                'smc_categories',
                'smc_groups',
                'smc_teams',
                'smc_group_entries',
                'smc_matches',
                'smc_legacy_stats',
            ];
            for (const m of mappings) {
                check(allowed.includes(m.target_table), 'Destino de mapping no admitido.');
                const [target] = await tx.query(`SELECT id FROM ${m.target_table} WHERE id=?`, [m.target_id]);
                check(target, 'Destino importado no encontrado.');
            }
            const mapped = new Set(mappings.map((m) => m.source_table + ':' + m.source_id));
            const expected = new Set(records.map((r) => r.source_table + ':' + r.source_id));
            check(mapped.size === expected.size &&
                [...expected].every((k) => mapped.has(k)), 'Faltan correspondencias de origen.');
        }
        return { batch: b, decisions, pending, mappings };
    }
    async report(actor, id) {
        return this.write(actor, async (tx) => {
            const r = await this.inspect(tx, id);
            return {
                batchId: id,
                status: r.batch.status,
                sourceSha256: r.batch.source_hash,
                rows: r.batch.plan.totalRows,
                counts: r.batch.plan.counts,
                mappingComplete: r.batch.plan.mappingComplete,
                issues: r.batch.plan.issues,
                pendingStatistics: r.pending,
                reconciliation: r.batch.plan.reconciliation,
                decisions: r.decisions.map((d) => ({
                    ...d,
                    chosen_values: decode(d.chosen_values),
                })),
                mappings: r.mappings.length,
                seasonId: r.batch.season_id,
            };
        });
    }
    async promote(actor, id, config) {
        check(config &&
            Object.keys(config).length === 3 &&
            config.statisticsPolicy === 'reviewed-initial' &&
            typeof config.name === 'string' &&
            config.name.trim().length > 0 &&
            config.name.length <= 120 &&
            typeof config.timezone === 'string' &&
            config.timezone.length <= 80, 'Indica nombre y zona horaria de la edición.');
        new Intl.DateTimeFormat('en', { timeZone: config.timezone }).format();
        const promotionHash = hash(config);
        try {
            return await this.write(actor, async (tx) => {
                const r = await this.inspect(tx, id), b = r.batch, p = b.plan;
                if (b.status === 'promoted') {
                    check(b.promotion_hash === promotionHash, 'La promoción previa usó otra configuración.');
                    return { batchId: id, seasonId: b.season_id, reused: true };
                }
                check(p.mappingComplete &&
                    !p.issues.some((i) => i.severity === 'blocker'), 'El lote tiene incidencias bloqueantes.');
                check(!r.pending.length, 'Todas las estadísticas necesitan una decisión explícita.');
                check(p.originalRecords.goals.length === 0 &&
                    p.matches.every((m) => m.status === 'scheduled' &&
                        m.homeScore === 0 &&
                        m.awayScore === 0 &&
                        m.elapsedSeconds === 0), 'Este importador promueve solo partidos sin iniciar, 0–0 y sin goles. Los demás permanecen en staging.');
                for (const table of ['smc_seasons', 'smc_teams', 'smc_matches']) {
                    const [row] = await tx.query(`SELECT COUNT(*) AS n FROM ${table}`);
                    check(Number(row.n) === 0, 'La promoción inicial requiere un destino deportivo vacío.');
                }
                const season = (0, node_crypto_1.randomUUID)();
                await tx.query('INSERT INTO smc_seasons(id,name,timezone,created_at) VALUES (?,?,?,UTC_TIMESTAMP(3))', [season, config.name.trim(), config.timezone]);
                const comp = new Map(), groups = new Map(), teams = new Map(), entries = new Map(), member = new Map();
                const mapping = async (table, source, targetTable, target) => tx.query('INSERT INTO smc_legacy_mappings(batch_id,source_table,source_id,target_table,target_id) VALUES (?,?,?,?,?)', [id, table, source, targetTable, target]);
                for (const c of p.competitions) {
                    check(c.minimumGroupCapacity <= 32, 'La capacidad importada excede el máximo.');
                    const [category] = await tx.query('SELECT id FROM smc_categories WHERE slug=?', [c.slug]);
                    check(category, 'Catálogo destino incompleto.');
                    const cid = (0, node_crypto_1.randomUUID)();
                    comp.set(c.slug, cid);
                    await tx.query('INSERT INTO smc_competitions(id,season_id,category_id,group_capacity) VALUES (?,?,?,?)', [cid, season, category.id, Math.max(4, c.minimumGroupCapacity)]);
                    for (const name of ['A', 'B']) {
                        const gid = (0, node_crypto_1.randomUUID)();
                        groups.set(c.slug + ':' + name, gid);
                        await tx.query('INSERT INTO smc_groups(id,competition_id,name) VALUES (?,?,?)', [gid, cid, name]);
                    }
                }
                // A source category may map to multiple target categories (Juvenil). Keep one mapping per destination table/category.
                for (const source of p.originalRecords.categories) {
                    const slugs = [
                        ...new Set(p.entries
                            .filter((e) => e.sourceGroupIds.some((gid) => p.originalRecords.groups.some((g) => g.id === gid && g.category_id === source.id)))
                            .map((e) => e.competition)),
                    ];
                    for (const slug of slugs) {
                        const [cat] = await tx.query('SELECT id FROM smc_categories WHERE slug=?', [slug]);
                        await mapping('categories', source.id, 'smc_categories', cat.id);
                    }
                }
                for (const source of p.originalRecords.groups) {
                    const e = p.entries.find((x) => x.sourceGroupIds.includes(source.id));
                    check(e, 'Grupo sin equipos: requiere transformación explícita.');
                    await mapping('groups', source.id, 'smc_groups', groups.get(e.competition + ':' + e.targetGroup));
                }
                for (const t of p.originalRecords.teams) {
                    const tid = (0, node_crypto_1.randomUUID)();
                    teams.set(t.id, tid);
                    await tx.query('INSERT INTO smc_teams(id,name,created_at) VALUES (?,?,UTC_TIMESTAMP(3))', [tid, t.name]);
                    await mapping('teams', t.id, 'smc_teams', tid);
                }
                for (const e of p.entries) {
                    const eid = (0, node_crypto_1.randomUUID)(), mid = (0, node_crypto_1.randomUUID)(), cid = comp.get(e.competition);
                    entries.set(e.competition + ':' + e.sourceTeamId, eid);
                    member.set(e.competition + ':' + e.sourceTeamId, mid);
                    await tx.query('INSERT INTO smc_entries(id,competition_id,team_id,created_at) VALUES (?,?,?,UTC_TIMESTAMP(3))', [eid, cid, teams.get(e.sourceTeamId)]);
                    await tx.query('INSERT INTO smc_group_entries(id,group_id,entry_id,competition_id) VALUES (?,?,?,?)', [mid, groups.get(e.competition + ':' + e.targetGroup), eid, cid]);
                }
                for (const s of p.originalRecords.group_teams) {
                    const e = p.entries.find((e) => e.sourceTeamId === s.team_id &&
                        e.sourceGroupIds.includes(s.group_id));
                    check(e, 'Membresía sin destino.');
                    await mapping('group_teams', s.id, 'smc_group_entries', member.get(e.competition + ':' + e.sourceTeamId));
                }
                const fields = new Map();
                const labels = [
                    ...new Set(p.matches
                        .map((m) => m.fieldLabel)
                        .filter((v) => v !== null && v !== '')),
                ];
                if (labels.length) {
                    const venue = (0, node_crypto_1.randomUUID)();
                    await tx.query('INSERT INTO smc_venues(id,name) VALUES (?,?)', [
                        venue,
                        'Sede importada · pendiente de completar',
                    ]);
                    for (const label of labels) {
                        check(typeof label === 'string' && label.length <= 120, 'Etiqueta de cancha inválida.');
                        const fid = (0, node_crypto_1.randomUUID)();
                        fields.set(label, fid);
                        await tx.query('INSERT INTO smc_fields(id,venue_id,name) VALUES (?,?,?)', [fid, venue, label]);
                    }
                }
                for (const m of p.matches) {
                    const mid = (0, node_crypto_1.randomUUID)();
                    await tx.query('INSERT INTO smc_matches(id,competition_id,group_id,home_entry_id,away_entry_id,field_id,updated_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(3))', [
                        mid,
                        comp.get(m.competition),
                        groups.get(m.competition + ':' + m.targetGroup),
                        entries.get(m.competition + ':' + m.source.home_team_id),
                        entries.get(m.competition + ':' + m.source.guest_team_id),
                        fields.get(m.fieldLabel) || null,
                    ]);
                    await mapping('games', m.sourceId, 'smc_matches', mid);
                }
                for (const s of p.originalRecords.team_stats) {
                    const scope = p.entries.filter((e) => e.sourceTeamId === s.team_id);
                    check(scope.length === 1, 'La estadística inicial necesita una única inscripción de destino.');
                    const d = r.decisions.find((d) => d.source_team_id === s.team_id), sid = (0, node_crypto_1.randomUUID)();
                    await tx.query('INSERT INTO smc_legacy_stats(id,batch_id,source_team_id,team_id,entry_id,original_values,reviewed_values,decision_id) VALUES (?,?,?,?,?,?,?,?)', [
                        sid,
                        id,
                        s.team_id,
                        teams.get(s.team_id),
                        entries.get(scope[0].competition + ':' + s.team_id),
                        JSON.stringify(s),
                        JSON.stringify(decode(d.chosen_values)),
                        d.id,
                    ]);
                    await mapping('team_stats', s.team_id, 'smc_legacy_stats', sid);
                }
                await tx.query('UPDATE smc_import_batches SET status=?,season_id=?,promotion_hash=?,baseline_policy=?,error_code=NULL WHERE id=?', ['promoted', season, promotionHash, 'reviewed-initial', id]);
                await this.inspect(tx, id);
                await (0, database_service_1.audit)(tx, actor, 'import.promote', 'season', season, {
                    batchId: id,
                    sourceHash: b.source_hash,
                    rows: p.totalRows,
                    active: false,
                    published: false,
                    statsOrigin: 'reviewed_initial_plus_native',
                });
                return { batchId: id, seasonId: season, reused: false };
            });
        }
        catch (error) {
            await this.write(actor, async (tx) => {
                const [b] = await tx.query('SELECT status FROM smc_import_batches WHERE id=?', [id]);
                if (b && b.status !== 'promoted') {
                    await tx.query('UPDATE smc_import_batches SET status=?,error_code=? WHERE id=?', ['failed', 'PROMOTION_REJECTED', id]);
                    await (0, database_service_1.audit)(tx, actor, 'import.failed', 'import', (0, node_crypto_1.randomUUID)(), {
                        batchId: id,
                        code: 'PROMOTION_REJECTED',
                    });
                }
            });
            throw error;
        }
    }
}
exports.ImportBatches = ImportBatches;
