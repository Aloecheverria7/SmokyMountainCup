"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MAPPING = exports.ANALYZER_VERSION = exports.TABLES = void 0;
exports.parseLegacy = parseLegacy;
exports.inspectLegacy = inspectLegacy;
exports.validateMapping = validateMapping;
exports.buildPlan = buildPlan;
const node_crypto_1 = require("node:crypto");
exports.TABLES = [
    'categories',
    'groups',
    'teams',
    'group_teams',
    'games',
    'goals',
    'team_stats',
];
exports.ANALYZER_VERSION = 2;
const required = {
    categories: ['id', 'name'],
    groups: ['id', 'name', 'category_id'],
    teams: ['id', 'name'],
    group_teams: ['id', 'group_id', 'team_id'],
    games: [
        'id',
        'home_team_id',
        'guest_team_id',
        'home_score',
        'guest_score',
        'status',
        'current_minute',
        'last_update',
        'field',
    ],
    goals: ['id', 'game_id', 'team_id', 'type', 'minute'],
    team_stats: [
        'team_id',
        'games_played',
        'wins',
        'draws',
        'losses',
        'goals_scored',
        'goals_conceded',
        'goal_difference',
        'points',
    ],
};
const escapes = {
    '0': '\0',
    b: '\b',
    n: '\n',
    r: '\r',
    t: '\t',
    Z: '\x1a',
};
/** Split only outside strings/comments. Input is never passed to a SQL engine. */
function statements(sql) {
    const result = [];
    let current = '', quote = '', i = 0;
    while (i < sql.length) {
        const c = sql[i];
        if (quote) {
            current += c;
            if (c === '\\' && quote !== '`') {
                if (i + 1 >= sql.length)
                    throw Error('Escape SQL incompleto.');
                current += sql[++i];
            }
            else if (c === quote) {
                if (sql[i + 1] === quote) {
                    current += sql[++i];
                }
                else
                    quote = '';
            }
            i++;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') {
            quote = c;
            current += c;
            i++;
            continue;
        }
        if ((c === '-' && sql[i + 1] === '-' && /\s/.test(sql[i + 2] ?? '')) ||
            c === '#') {
            while (i < sql.length && sql[i] !== '\n')
                i++;
            current += ' ';
            continue;
        }
        if (c === '/' && sql[i + 1] === '*') {
            const end = sql.indexOf('*/', i + 2);
            if (end < 0)
                throw Error('Comentario SQL incompleto.');
            if (/^!\d*\s*(INSERT|REPLACE|UPDATE|DELETE|LOAD|CALL|CREATE|WITH|TRUNCATE)\b/i.test(sql.slice(i + 2, end).trim()))
                throw Error('Datos SQL condicionales no admitidos; no se descartan silenciosamente.');
            i = end + 2;
            current += ' ';
            continue;
        }
        if (c === ';') {
            if (current.trim())
                result.push(current.trim());
            current = '';
        }
        else
            current += c;
        i++;
    }
    if (quote)
        throw Error('Literal SQL incompleto.');
    if (current.trim())
        result.push(current.trim());
    return result;
}
function tuples(text) {
    const rows = [];
    let at = 0;
    const space = () => {
        while (/\s/.test(text[at] ?? '') && at < text.length)
            at++;
    };
    const fail = () => {
        throw Error('VALUES debe contener únicamente literales; no se ejecutan expresiones SQL.');
    };
    while (at < text.length) {
        space();
        if (text[at++] !== '(')
            fail();
        const values = [];
        for (;;) {
            space();
            let value;
            if (text[at] === "'") {
                at++;
                let decoded = '', closed = false;
                while (at < text.length) {
                    const c = text[at++];
                    if (c === "'") {
                        if (text[at] === "'") {
                            decoded += "'";
                            at++;
                            continue;
                        }
                        closed = true;
                        break;
                    }
                    if (c === '\\') {
                        if (at >= text.length)
                            fail();
                        const escaped = text[at++];
                        if (!(escaped in escapes) && !['\\', "'", '"'].includes(escaped))
                            throw Error('Escape SQL no admitido; se requiere revisión del literal.');
                        decoded += escapes[escaped] ?? escaped;
                    }
                    else
                        decoded += c;
                }
                if (!closed)
                    fail();
                value = decoded;
            }
            else {
                const start = at;
                while (at < text.length && text[at] !== ',' && text[at] !== ')')
                    at++;
                const literal = text.slice(start, at).trim();
                if (/^NULL$/i.test(literal))
                    value = null;
                else if (/^-?\d+$/.test(literal)) {
                    value = Number(literal);
                    if (!Number.isSafeInteger(value))
                        throw Error('Entero SQL fuera del rango seguro.');
                }
                else {
                    fail();
                    value = null;
                }
            }
            values.push(value);
            space();
            const separator = text[at++];
            if (separator === ')')
                break;
            if (separator !== ',')
                fail();
        }
        rows.push(values);
        space();
        if (at === text.length)
            break;
        if (text[at++] !== ',')
            fail();
        space();
        if (at === text.length)
            fail();
    }
    return rows;
}
function parseLegacy(sql) {
    const tables = Object.fromEntries(exports.TABLES.map((t) => [t, []]));
    for (const statement of statements(sql.replace(/^\uFEFF/, ''))) {
        if (/^DELIMITER\b/i.test(statement) ||
            /^CREATE\s+(?!(TABLE|DATABASE|SCHEMA)\b)/i.test(statement))
            throw Error('El formato de dump no admite rutinas ni otros objetos SQL ejecutables.');
        if (!/^(INSERT|REPLACE|UPDATE|DELETE|LOAD|CALL|WITH|TRUNCATE|MERGE)\b/i.test(statement))
            continue;
        const match = /^INSERT\s+INTO\s+`([A-Za-z_][\w]*)`\s*\(([^)]+)\)\s+VALUES\s+([\s\S]+)$/i.exec(statement);
        if (!match)
            throw Error('Operación de datos SQL no admitida; el analizador solo acepta INSERT de literales.');
        if (!exports.TABLES.includes(match[1]))
            throw Error('Tabla de datos no admitida: ' + match[1]);
        const table = match[1];
        const cols = match[2].split(',').map((c) => {
            const m = /^\s*`([A-Za-z_]\w*)`\s*$/.exec(c);
            if (!m)
                throw Error('Columna SQL no reconocida.');
            return m[1];
        });
        if (new Set(cols).size !== cols.length ||
            required[table].some((c) => !cols.includes(c)))
            throw Error('Columnas incompletas o duplicadas en ' + table);
        for (const values of tuples(match[3])) {
            if (values.length !== cols.length)
                throw Error('Cantidad de valores incorrecta en ' + table);
            tables[table].push(Object.fromEntries(cols.map((c, i) => [c, values[i]])));
        }
    }
    if (!tables.categories.length || !tables.teams.length)
        throw Error('El archivo no contiene categorías y equipos reconocidos.');
    return tables;
}
const pk = (table, row) => row[table === 'team_stats' ? 'team_id' : 'id'];
function inspectLegacy(tables) {
    const issues = [];
    const index = {};
    const add = (table, row, code, message, severity = 'blocker') => issues.push({ code, severity, table, sourceId: pk(table, row), message });
    for (const table of exports.TABLES) {
        index[table] = new Map();
        for (const row of tables[table]) {
            const id = pk(table, row);
            if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)
                add(table, row, 'INVALID_PRIMARY_KEY', 'La clave original debe ser un entero positivo.');
            if (index[table].has(id))
                add(table, row, 'DUPLICATE_PRIMARY_KEY', 'Clave original repetida; conservar ambas filas para revisión.');
            else
                index[table].set(id, row);
        }
    }
    const foreign = (table, row, column, target, nullable = false) => {
        const value = row[column];
        if (value === null && nullable)
            return;
        if (!index[target].has(value))
            add(table, row, 'ORPHAN_REFERENCE', `${column} no referencia una fila de ${target}.`);
    };
    for (const r of tables.groups)
        foreign('groups', r, 'category_id', 'categories');
    for (const r of tables.group_teams) {
        foreign('group_teams', r, 'group_id', 'groups');
        foreign('group_teams', r, 'team_id', 'teams');
    }
    for (const table of ['categories', 'teams', 'groups'])
        for (const row of tables[table])
            if (typeof row.name !== 'string' || !row.name.trim())
                add(table, row, 'INVALID_NAME', 'El nombre original no es un texto válido.');
    const statuses = {
        'not started': 'scheduled',
        'in progress': 'live',
        'half-time': 'half_time',
        half_time: 'half_time',
        paused: 'paused',
        suspended: 'suspended',
        ended: 'finished',
        finished: 'finished',
    };
    for (const r of tables.games) {
        foreign('games', r, 'home_team_id', 'teams');
        foreign('games', r, 'guest_team_id', 'teams');
        if (r.home_team_id === r.guest_team_id)
            add('games', r, 'SAME_TEAM_MATCH', 'Un partido tiene el mismo equipo en ambos lados.');
        for (const key of ['home_score', 'guest_score', 'current_minute'])
            if (typeof r[key] !== 'number' || Number(r[key]) < 0)
                add('games', r, 'INVALID_GAME_NUMBER', 'Marcador o minuto inválido.');
        if (!statuses[String(r.status)])
            add('games', r, 'UNKNOWN_STATUS', 'Estado sin correspondencia explícita.');
        if (['live', 'half_time', 'paused', 'suspended'].includes(statuses[String(r.status)]))
            add('games', r, 'CLOCK_REVIEW', 'El reloj original necesita validación; nunca se reanuda al importar.');
    }
    for (const r of tables.goals) {
        foreign('goals', r, 'game_id', 'games');
        foreign('goals', r, 'team_id', 'teams');
        const game = index.games.get(r.game_id);
        if (game && ![game.home_team_id, game.guest_team_id].includes(r.team_id))
            add('goals', r, 'FOREIGN_GOAL_TEAM', 'El autor pertenece a un equipo ajeno al partido.');
        if (!['goal', 'own_goal'].includes(String(r.type)) ||
            typeof r.minute !== 'number' ||
            r.minute < 0 ||
            r.minute > 300)
            add('goals', r, 'INVALID_GOAL', 'Tipo o minuto de gol no admitido.');
    }
    const reconciliation = [];
    for (const r of tables.team_stats) {
        foreign('team_stats', r, 'team_id', 'teams');
        let numeric = true;
        for (const key of required.team_stats.filter((k) => k !== 'team_id'))
            if (typeof r[key] !== 'number') {
                numeric = false;
                add('team_stats', r, 'INVALID_STAT_NUMBER', 'Estadística no numérica.');
            }
        if (!numeric)
            continue;
        for (const key of [
            'games_played',
            'wins',
            'draws',
            'losses',
            'goals_scored',
            'goals_conceded',
        ])
            if (Number(r[key]) < 0)
                add('team_stats', r, 'NEGATIVE_STAT_COUNT', 'Un contador de resultados es negativo.');
        const played = Number(r.wins) + Number(r.draws) + Number(r.losses), difference = Number(r.goals_scored) - Number(r.goals_conceded);
        const disputed = [];
        if (played !== r.games_played) {
            add('team_stats', r, 'PLAYED_MISMATCH', 'PJ no coincide con G+E+P.', 'review');
            disputed.push('games_played');
        }
        if (difference !== r.goal_difference) {
            add('team_stats', r, 'GOAL_DIFFERENCE_MISMATCH', 'DG no coincide con GF−GC.', 'review');
            disputed.push('goal_difference');
        }
        reconciliation.push({
            sourceTeamId: r.team_id,
            original: { ...r },
            derived: {
                gamesPlayedFromResults: played,
                goalDifferenceFromGoals: difference,
                pointsFromRules: null,
            },
            disputedFields: disputed,
            resolution: { status: 'pending', chosenValues: null, reason: null },
        });
    }
    // The original table can contain played games not represented in the exported fixture list.
    const finished = tables.games.filter((g) => ['ended', 'finished'].includes(String(g.status)));
    const playedByTeam = new Map();
    for (const g of finished)
        for (const id of [g.home_team_id, g.guest_team_id])
            playedByTeam.set(id, (playedByTeam.get(id) ?? 0) + 1);
    for (const r of tables.team_stats)
        if (typeof r.games_played === 'number' &&
            r.games_played !== (playedByTeam.get(r.team_id) ?? 0))
            add('team_stats', r, 'STATS_NOT_RECONSTRUCTIBLE', 'Los partidos exportados no explican los jugados de la tabla original.', 'review');
    const names = new Map();
    for (const r of tables.teams) {
        const name = String(r.name);
        names.set(name, [...(names.get(name) ?? []), r.id]);
    }
    return {
        counts: Object.fromEntries(exports.TABLES.map((t) => [t, tables[t].length])),
        totalRows: exports.TABLES.reduce((n, t) => n + tables[t].length, 0),
        issues,
        duplicateTeamNames: [...names]
            .filter(([, ids]) => ids.length > 1)
            .map(([name, sourceIds]) => ({ name, sourceIds })),
        reconciliation,
    };
}
exports.DEFAULT_MAPPING = {
    version: 1,
    editionPolicy: 'continue-current',
    groups: [
        ...[1, 2, 3, 4].map((id) => ({
            sourceGroupId: id,
            sourceCategoryId: id <= 2 ? 1 : 2,
            sourceCategoryName: id <= 2 ? 'Categoria A' : 'Categoria B',
            sourceGroupName: id % 2 ? 'Grupo A' : 'Grupo B',
            competition: 'adulto',
            targetGroup: id <= 2 ? 'A' : 'B',
        })),
        {
            sourceGroupId: 5,
            sourceCategoryId: 3,
            sourceCategoryName: 'Femenil',
            sourceGroupName: 'Grupo A',
            competition: 'femenino',
            targetGroup: 'A',
        },
        {
            sourceGroupId: 6,
            sourceCategoryId: 3,
            sourceCategoryName: 'Femenil',
            sourceGroupName: 'Grupo B',
            competition: 'femenino',
            targetGroup: 'B',
        },
        ...['6-9 años', '10-11 años', '12-13 años', '14-17 años'].map((name, i) => ({
            sourceGroupId: 7 + i,
            sourceCategoryId: 4,
            sourceCategoryName: 'Juvenil',
            sourceGroupName: name,
            competition: i < 2 ? 'infantil' : 'junior',
            targetGroup: i % 2 ? 'B' : 'A',
        })),
    ],
};
function validateMapping(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw Error('Mapping inválido.');
    const m = value;
    if (m.version !== 1 ||
        m.editionPolicy !== 'continue-current' ||
        !Array.isArray(m.groups) ||
        m.groups.length > 1000 ||
        Object.keys(m).some((k) => !['version', 'editionPolicy', 'groups'].includes(k)))
        throw Error('Versión o política de mapping inválida.');
    const seen = new Set();
    for (const g of m.groups) {
        if (!g ||
            typeof g !== 'object' ||
            Object.keys(g).some((k) => ![
                'sourceGroupId',
                'sourceCategoryId',
                'sourceCategoryName',
                'sourceGroupName',
                'competition',
                'targetGroup',
            ].includes(k)) ||
            !Number.isSafeInteger(g.sourceGroupId) ||
            g.sourceGroupId <= 0 ||
            !Number.isSafeInteger(g.sourceCategoryId) ||
            g.sourceCategoryId <= 0 ||
            typeof g.sourceCategoryName !== 'string' ||
            typeof g.sourceGroupName !== 'string' ||
            !['infantil', 'junior', 'adulto', 'femenino'].includes(g.competition) ||
            !['A', 'B', null].includes(g.targetGroup) ||
            seen.has(g.sourceGroupId))
            throw Error('Grupo de mapping inválido o duplicado.');
        seen.add(g.sourceGroupId);
    }
    return m;
}
function canonical(value) {
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object')
        return ('{' +
            Object.keys(value)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
                .join(',') +
            '}');
    return JSON.stringify(value);
}
function buildPlan(tables, sourceHash, mapping = exports.DEFAULT_MAPPING) {
    validateMapping(mapping);
    const inspected = inspectLegacy(tables), issues = [...inspected.issues];
    const matched = new Map();
    for (const group of tables.groups) {
        const m = mapping.groups.find((g) => g.sourceGroupId === group.id);
        const category = tables.categories.find((c) => c.id === group.category_id);
        if (!m ||
            m.sourceCategoryId !== group.category_id ||
            m.sourceGroupName !== group.name ||
            m.sourceCategoryName !== category?.name) {
            issues.push({
                code: 'UNMAPPED_SOURCE_GROUP',
                severity: 'blocker',
                table: 'mapping',
                sourceId: group.id,
                message: 'El grupo no tiene una correspondencia verificada por ID, nombre y categoría.',
            });
            continue;
        }
        matched.set(group.id, m);
        if (m.targetGroup === null)
            issues.push({
                code: 'TARGET_GROUP_PENDING',
                severity: 'blocker',
                table: 'mapping',
                sourceId: group.id,
                message: 'La competición está confirmada; el grupo A/B requiere decisión explícita.',
            });
    }
    const entries = new Map();
    for (const membership of tables.group_teams) {
        const m = matched.get(membership.group_id);
        if (!m)
            continue;
        const key = m.competition + ':' + membership.team_id, old = entries.get(key);
        if (old) {
            old.sourceGroupIds.push(membership.group_id);
            if (old.targetGroup !== m.targetGroup)
                issues.push({
                    code: 'CONFLICTING_TARGET_GROUPS',
                    severity: 'blocker',
                    table: 'group_teams',
                    sourceId: membership.id,
                    message: 'La misma inscripción quedaría en dos grupos distintos.',
                });
        }
        else
            entries.set(key, {
                sourceTeamId: membership.team_id,
                competition: m.competition,
                targetGroup: m.targetGroup,
                sourceGroupIds: [membership.group_id],
            });
    }
    const entryList = [...entries.values()];
    const statuses = {
        'not started': 'scheduled',
        'in progress': 'live',
        'half-time': 'half_time',
        half_time: 'half_time',
        paused: 'paused',
        suspended: 'suspended',
        ended: 'finished',
        finished: 'finished',
    };
    const matches = tables.games.map((game) => {
        const home = entryList.filter((e) => e.sourceTeamId === game.home_team_id), away = entryList.filter((e) => e.sourceTeamId === game.guest_team_id), common = home.filter((h) => away.some((a) => a.competition === h.competition));
        if (common.length !== 1) {
            issues.push({
                code: 'AMBIGUOUS_MATCH_COMPETITION',
                severity: 'blocker',
                table: 'games',
                sourceId: game.id,
                message: 'No se puede determinar una competición única para ambos equipos.',
            });
            return { sourceId: game.id, competition: null, source: { ...game } };
        }
        const h = common[0], a = away.find((e) => e.competition === h.competition);
        if (h.targetGroup && a.targetGroup && h.targetGroup !== a.targetGroup)
            issues.push({
                code: 'CROSS_GROUP_MATCH_REVIEW',
                severity: 'blocker',
                table: 'games',
                sourceId: game.id,
                message: 'No se inventa una fase para un partido entre grupos distintos.',
            });
        return {
            sourceId: game.id,
            competition: h.competition,
            targetGroup: h.targetGroup === a.targetGroup ? h.targetGroup : null,
            status: statuses[String(game.status)] ?? null,
            scheduledAt: null,
            clockStartedAt: null,
            homeScore: game.home_score,
            awayScore: game.guest_score,
            elapsedSeconds: Number(game.current_minute) * 60,
            fieldLabel: game.field,
            source: { ...game },
        };
    });
    const competitions = ['infantil', 'junior', 'adulto', 'femenino'].map((slug) => {
        const list = entryList.filter((e) => e.competition === slug);
        return {
            slug,
            entries: list.length,
            knownGroupSizes: {
                A: list.filter((e) => e.targetGroup === 'A').length,
                B: list.filter((e) => e.targetGroup === 'B').length,
            },
            pendingGroupEntries: list.filter((e) => !e.targetGroup).length,
            minimumGroupCapacity: Math.max(Math.ceil(list.length / 2), ...['A', 'B'].map((name) => list.filter((e) => e.targetGroup === name).length)),
            matches: matches.filter((m) => m.competition === slug).length,
        };
    });
    return {
        analyzerVersion: exports.ANALYZER_VERSION,
        sourceSha256: sourceHash,
        planId: (0, node_crypto_1.createHash)('sha256')
            .update(canonical({ sourceHash, mapping, analyzerVersion: exports.ANALYZER_VERSION }))
            .digest('hex'),
        editionPolicy: 'continue-current',
        statisticsPolicy: 'preserve-reviewed-initial',
        archiveAutomatically: false,
        changesDatabase: false,
        canApply: false,
        mappingComplete: !issues.some((i) => i.table === 'mapping' || i.code === 'CONFLICTING_TARGET_GROUPS'),
        counts: inspected.counts,
        totalRows: inspected.totalRows,
        competitions,
        entries: entryList,
        matches,
        issues,
        duplicateTeamNames: inspected.duplicateTeamNames,
        reconciliation: inspected.reconciliation,
        originalRecords: tables,
        remainingDecisions: [
            ...(issues.some((i) => i.table === 'mapping' || i.code === 'CONFLICTING_TARGET_GROUPS')
                ? ['Resolver correspondencias de grupos pendientes o incompatibles.']
                : []),
            'Definir nombre oficial de la edición y reglas vigentes.',
            'Registrar la conservación de cifras actuales como base inicial revisada, con motivo y actor.',
            'Ensayar importación y verificación en copia antes del corte.',
        ],
    };
}
