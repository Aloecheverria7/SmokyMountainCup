import { isDeepStrictEqual } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
export async function sportsChecks({ admin, Client, pool, base, ok }) {
  const get = async (path) => {
    const r = await admin.send(path);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  const create = async (path, body) => {
    const r = await admin.send(path, 'POST', body);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data;
  };
  const keyed = (client, path, body, method = 'POST', key = randomUUID()) =>
    client.send(path, method, body, { headers: { 'Idempotency-Key': key } });
  const operation = async (path, body, method = 'POST', client = admin) => {
    const r = await keyed(client, path, body, method);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  const season = await create('seasons', {
    name: 'Sports tests',
    timezone: 'America/New_York',
  });
  const competitions = (await get(`seasons/${season.id}/competitions`)).data;
  const c = competitions.find((c) => c.slug === 'infantil'),
    junior = competitions.find((c) => c.slug === 'junior'),
    draft = competitions.find((c) => c.slug === 'femenino');
  const rules = {
    duration: 45,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    groupCapacity: 4,
    qualifiers: 2,
    rulesConfirmed: true,
  };
  ok(
    (
      await admin.send(`competitions/${c.id}/draw-previews`, 'POST', {
        mode: 'random',
      })
    ).status === 422,
    'draw requires confirmed rules',
  );
  await admin.send(`competitions/${c.id}`, 'PATCH', {
    ...rules,
    expectedVersion: 0,
  });
  const teams = [],
    entries = [];
  for (let i = 0; i < 8; i++) {
    teams.push(await create('teams', { name: 'Sports ' + (i + 1) }));
    entries.push(
      await create(`competitions/${c.id}/entries`, { teamId: teams[i].id }),
    );
  }
  const invalid = await admin.send(
    `competitions/${c.id}/draw-previews`,
    'POST',
    { mode: 'manual', entryIds: entries.map(() => entries[0].id) },
  );
  ok(
    invalid.status === 422,
    'manual draw rejects duplicated or missing entries',
  );
  const preview = await create(`competitions/${c.id}/draw-previews`, {
    mode: 'manual',
    entryIds: entries.map((e) => e.id),
  });
  ok(
    preview.groups[0].entries.map((e) => e.id).join(',') ===
      [0, 2, 4, 6].map((i) => entries[i].id).join(','),
    'manual draw alternates entries between A and B',
  );
  await admin.send(`competitions/${c.id}`, 'PATCH', {
    ...rules,
    duration: 40,
    expectedVersion: 1,
  });
  ok(
    (await keyed(admin, `competitions/${c.id}/draw`, { previewId: preview.id }))
      .status === 422,
    'stale preview cannot publish after rule changes',
  );
  const freshPreview = await create(`competitions/${c.id}/draw-previews`, {
    mode: 'manual',
    entryIds: entries.map((e) => e.id),
  });
  const publishKey = randomUUID(),
    publishBody = { previewId: freshPreview.id };
  const published = await keyed(
    admin,
    `competitions/${c.id}/draw`,
    publishBody,
    'POST',
    publishKey,
  );
  assert.equal(published.status, 200, JSON.stringify(published.body));
  const replay = await keyed(
    admin,
    `competitions/${c.id}/draw`,
    publishBody,
    'POST',
    publishKey,
  );
  ok(
    replay.status === 200 && isDeepStrictEqual(replay.body, published.body),
    'draw publication replays the original response without duplicate fixtures',
  );
  let matches = (await get(`matches?competitionId=${c.id}&limit=100`)).data;
  ok(
    matches.length === 12 &&
      matches.filter((m) => m.group_name === 'A').length === 6 &&
      matches.filter((m) => m.group_name === 'B').length === 6,
    'two groups of four generate twelve round-robin fixtures',
  );
  ok(
    (
      await admin.send(`competitions/${c.id}/entries`, 'POST', {
        teamId: (await create('teams', { name: 'Too late' })).id,
      })
    ).status === 422,
    'published draw blocks new registrations',
  );
  const unknown = await fetch(base + `public/matches/${randomUUID()}`);
  ok(unknown.status === 404, 'unknown public match is not exposed');
  ok(
    (await fetch(base + `public/competitions/${draft.id}/standings`)).status ===
      404,
    'unpublished competition is not exposed',
  );
  const privateContact = 'PRIVATE-CONTACT-DO-NOT-PUBLISH';
  const first = matches.find(
    (m) => m.homeEntryId === entries[0].id && m.awayEntryId === entries[2].id,
  );
  assert.ok(first);
  ok(
    (
      await admin.send('players', 'POST', {
        name: 'Invalid',
        birthDate: '2999-01-01',
      })
    ).status === 422,
    'future birth dates are rejected',
  );
  const p = await create('players', {
    name: 'Striker',
    birthDate: '2020-01-01',
    contact: privateContact,
  });
  const roster = await create(`entries/${first.homeEntryId}/roster`, {
    playerId: p.id,
    number: 9,
  });
  ok(
    (
      await admin.send(`entries/${first.awayEntryId}/roster`, 'POST', {
        playerId: p.id,
        number: 10,
      })
    ).status === 409,
    'player cannot join two teams in the same competition',
  );
  const p2 = await create('players', { name: 'Second player' });
  ok(
    (
      await admin.send(`entries/${first.homeEntryId}/roster`, 'POST', {
        playerId: p2.id,
        number: 9,
      })
    ).status === 409,
    'duplicate shirt number is rejected',
  );
  const p3 = await create('players', { name: 'Third player' });
  const shirts = await Promise.all([
    admin.send(`entries/${first.homeEntryId}/roster`, 'POST', {
      playerId: p2.id,
      number: 8,
    }),
    admin.send(`entries/${first.homeEntryId}/roster`, 'POST', {
      playerId: p3.id,
      number: 8,
    }),
  ]);
  ok(
    shirts
      .map((r) => r.status)
      .sort()
      .join(',') === '201,409',
    'concurrent roster registration preserves shirt uniqueness',
  );
  const venue = await create('venues', {
    name: 'Test venue',
    address: 'Local test only',
  });
  const field = await create('fields', { name: 'Field A', venueId: venue.id }),
    field2 = await create('fields', { name: 'Field B', venueId: venue.id });
  const other = matches.find(
    (m) => m.homeEntryId === entries[1].id && m.awayEntryId === entries[3].id,
  );
  const when = '2027-01-01T10:00:00-05:00';
  const bookings = await Promise.all([
    keyed(
      admin,
      `matches/${first.id}/schedule`,
      { expectedVersion: 0, fieldId: field.id, scheduledAt: when },
      'PATCH',
    ),
    keyed(
      admin,
      `matches/${other.id}/schedule`,
      { expectedVersion: 0, fieldId: field.id, scheduledAt: when },
      'PATCH',
    ),
  ]);
  ok(
    bookings
      .map((r) => r.status)
      .sort()
      .join(',') === '200,422',
    'concurrent field booking rejects one conflicting schedule',
  );
  const [booked] = await pool.query(
    'SELECT id FROM smc_matches WHERE field_id=? AND scheduled_at IS NOT NULL',
    [field.id],
  );
  ok(booked.length === 1, 'conflicting schedule is rolled back completely');
  if (booked[0].id !== first.id) {
    const current = (await get(`matches/${other.id}`)).data;
    await operation(
      `matches/${other.id}/schedule`,
      { expectedVersion: current.version, fieldId: null, scheduledAt: null },
      'PATCH',
    );
  }
  let m = (await get(`matches/${first.id}`)).data;
  if (!m.fieldId)
    await operation(
      `matches/${first.id}/schedule`,
      { expectedVersion: m.version, fieldId: field.id, scheduledAt: when },
      'PATCH',
    );
  m = (await get(`matches/${first.id}`)).data;
  ok(
    m.scheduled_iso === '2027-01-01T15:00:00.000Z',
    'scheduled time is stored and returned in UTC',
  );
  await admin.send(`competitions/${junior.id}`, 'PATCH', {
    ...rules,
    qualifiers: 1,
    expectedVersion: 0,
  });
  const juniorEntries = [];
  for (let i = 0; i < 4; i++)
    juniorEntries.push(
      await create(`competitions/${junior.id}/entries`, {
        teamId: teams[i].id,
      }),
    );
  const jp = await create(`competitions/${junior.id}/draw-previews`, {
    mode: 'manual',
    entryIds: juniorEntries.map((e) => e.id),
  });
  await operation(`competitions/${junior.id}/draw`, { previewId: jp.id });
  const jm = (
    await get(`matches?competitionId=${junior.id}&limit=100`)
  ).data.find((m) => m.homeEntryId === juniorEntries[0].id);
  ok(
    (
      await keyed(
        admin,
        `matches/${jm.id}/schedule`,
        { expectedVersion: 0, fieldId: field2.id, scheduledAt: when },
        'PATCH',
      )
    ).status === 422,
    'team identity conflicts are detected across competitions and different fields',
  );
  ok(
    (
      await keyed(
        admin,
        `matches/${jm.id}/schedule`,
        {
          expectedVersion: 0,
          fieldId: field.id,
          scheduledAt: '2027-01-01T10:40:00-05:00',
        },
        'PATCH',
      )
    ).status === 200,
    'adjacent match intervals are allowed',
  );
  const temporary = randomBytes(20).toString('hex'),
    scorer = await create('users', {
      name: 'Match scorer',
      email: 'match-scorer@example.test',
      role: 'scorer',
      password: temporary,
    }),
    scorerClient = new Client(base);
  await scorerClient.login(scorer.email, temporary);
  await scorerClient.send('auth/password', 'POST', {
    currentPassword: temporary,
    newPassword: randomBytes(20).toString('hex'),
  });
  m = (await get(`matches/${first.id}`)).data;
  await operation(`matches/${first.id}/assignment`, {
    expectedVersion: m.version,
    scorerId: scorer.id,
  });
  ok(
    (await scorerClient.send('matches?limit=100')).body.data.length === 1,
    'scorer lists assigned matches only',
  );
  ok(
    (await scorerClient.send(`matches/${other.id}`)).status === 403,
    'scorer cannot inspect an unassigned match',
  );
  m = (await get(`matches/${first.id}`)).data;
  await operation(
    `matches/${first.id}/status`,
    { expectedVersion: m.version, status: 'live' },
    'POST',
    scorerClient,
  );
  await pool.query(
    'UPDATE smc_matches SET elapsed_seconds=120,clock_started_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 90 SECOND) WHERE id=?',
    [first.id],
  );
  m = (await get(`matches/${first.id}`)).data;
  ok(m.elapsed >= 210, 'clock combines persisted and running server time');
  ok(
    (await get(`matches/${other.id}`)).data.elapsed === 0,
    'other match clock remains independent',
  );
  await operation(
    `matches/${first.id}/status`,
    { expectedVersion: m.version, status: 'paused' },
    'POST',
    scorerClient,
  );
  m = (await get(`matches/${first.id}`)).data;
  const paused = m.elapsed;
  ok(
    (await get(`matches/${first.id}`)).data.elapsed === paused,
    'paused clock survives reload without restarting',
  );
  const goal = {
      expectedVersion: m.version,
      entryId: m.homeEntryId,
      rosterId: roster.id,
      kind: 'goal',
      minute: 10,
    },
    goalKey = randomUUID();
  const goals = await Promise.all([
    keyed(scorerClient, `matches/${first.id}/events`, goal, 'POST', goalKey),
    keyed(scorerClient, `matches/${first.id}/events`, goal, 'POST', goalKey),
  ]);
  ok(
    goals.every((r) => r.status === 200) &&
      isDeepStrictEqual(goals[0].body, goals[1].body),
    'concurrent goal retries return the same original response',
  );
  m = (await get(`matches/${first.id}`)).data;
  ok(
    m.home_score === 1 && m.away_score === 0,
    'duplicate goal operation creates one goal only',
  );
  ok(
    (
      await keyed(
        scorerClient,
        `matches/${first.id}/events`,
        { ...goal, minute: 11 },
        'POST',
        goalKey,
      )
    ).status === 409,
    'idempotency key cannot be reused with a different payload',
  );
  ok(
    (await keyed(scorerClient, `matches/${first.id}/events`, goal)).status ===
      409,
    'new operation with stale version is rejected',
  );
  ok(
    (
      await keyed(scorerClient, `matches/${first.id}/events`, {
        ...goal,
        expectedVersion: m.version,
        entryId: entries[1].id,
      })
    ).status === 422,
    'goal cannot use an entry outside its match',
  );
  let snap = await operation(
    `matches/${first.id}/events`,
    {
      expectedVersion: m.version,
      entryId: m.homeEntryId,
      rosterId: roster.id,
      kind: 'own_goal',
      minute: 12,
    },
    'POST',
    scorerClient,
  );
  ok(
    snap.data.home_score === 1 && snap.data.away_score === 1,
    'own goal credits the opponent',
  );
  const own = snap.events.find((e) => e.kind === 'own_goal');
  snap = await operation(
    `matches/${first.id}/events/${own.id}/void`,
    { expectedVersion: snap.data.version, reason: 'Incorrect own goal' },
    'POST',
    scorerClient,
  );
  ok(
    snap.data.home_score === 1 &&
      snap.data.away_score === 0 &&
      snap.events.find((e) => e.id === own.id).voidedAt,
    'void preserves history and recomputes the score',
  );
  const official = await fetch(
      base + `public/competitions/${c.id}/standings`,
    ).then((r) => r.json()),
    provisional = await fetch(
      base + `public/competitions/${c.id}/standings?mode=provisional`,
    ).then((r) => r.json());
  ok(
    official.data.every((e) => e.played === 0) &&
      provisional.data.some((e) => e.points === 3),
    'official and provisional standings use different confirmation scopes',
  );
  m = snap.data;
  await operation(
    `matches/${first.id}/status`,
    { expectedVersion: m.version, status: 'finished' },
    'POST',
    scorerClient,
  );
  m = (await get(`matches/${first.id}`)).data;
  ok(
    (
      await keyed(scorerClient, `matches/${first.id}/confirm`, {
        expectedVersion: m.version,
      })
    ).status === 403,
    'scorer cannot confirm official results',
  );
  await operation(`matches/${first.id}/confirm`, {
    expectedVersion: m.version,
  });
  m = (await get(`matches/${first.id}`)).data;
  ok(
    (
      await keyed(scorerClient, `matches/${first.id}/events`, {
        ...goal,
        expectedVersion: m.version,
      })
    ).status === 422,
    'confirmed result rejects goal changes',
  );
  await operation(`matches/${first.id}/reopen`, {
    expectedVersion: m.version,
    reason: 'Review result',
  });
  m = (await get(`matches/${first.id}`)).data;
  ok(
    !m.confirmed && m.status === 'finished',
    'reopening removes confirmation but does not restart the match',
  );
  await operation(`matches/${first.id}/confirm`, {
    expectedVersion: m.version,
  });
  const publicDetail = await fetch(base + `public/matches/${first.id}`).then(
    (r) => r.json(),
  );
  ok(
    publicDetail.events.length === 1 &&
      !JSON.stringify(publicDetail).includes(privateContact) &&
      !JSON.stringify(publicDetail).includes('birthDate') &&
      !JSON.stringify(publicDetail).includes('scorerId'),
    'public match excludes voided events, private player data and staff assignment',
  );
  const state = await get(`competitions/${c.id}/sport-state`);
  ok(
    (
      await keyed(admin, `competitions/${c.id}/qualify`, {
        expectedVersion: state.data.version,
        entryIds: [entries[0].id, entries[3].id, entries[1].id, entries[2].id],
      })
    ).status === 422,
    'qualification is blocked until all group results are confirmed',
  );
  matches = (await get(`matches?competitionId=${c.id}&limit=100`)).data;
  for (const match of matches.filter((m) => m.id !== first.id)) {
    let next = await operation(`matches/${match.id}/status`, {
      expectedVersion: match.version,
      status: 'live',
    });
    next = await operation(`matches/${match.id}/events`, {
      expectedVersion: next.data.version,
      entryId: match.homeEntryId,
      rosterId: null,
      kind: 'goal',
      minute: 5,
    });
    next = await operation(`matches/${match.id}/status`, {
      expectedVersion: next.data.version,
      status: 'finished',
    });
    await operation(`matches/${match.id}/confirm`, {
      expectedVersion: next.data.version,
    });
  }
  const ready = await get(`competitions/${c.id}/sport-state`);
  ok(
    (
      await keyed(admin, `competitions/${c.id}/qualify`, {
        expectedVersion: ready.data.version,
        entryIds: [entries[0].id, entries[7].id, entries[1].id, entries[6].id],
      })
    ).status === 422,
    'qualification cannot exclude better-ranked teams',
  );
  await operation(`competitions/${c.id}/qualify`, {
    expectedVersion: ready.data.version,
    entryIds: [entries[0].id, entries[3].id, entries[1].id, entries[2].id],
  });
  matches = (await get(`matches?competitionId=${c.id}&limit=100`)).data;
  let semis = matches
      .filter((m) => m.stage === 'knockout' && m.roundNo === 1)
      .sort((a, b) => a.positionNo - b.positionNo),
    final = matches.find((m) => m.stage === 'knockout' && m.roundNo === 2);
  ok(
    semis.length === 2 && final && !final.homeEntryId && !final.awayEntryId,
    'qualification creates semifinals and a final with source dependencies',
  );
  m = (await get(`matches/${first.id}`)).data;
  ok(
    (
      await keyed(admin, `matches/${first.id}/reopen`, {
        expectedVersion: m.version,
        reason: 'Later correction',
      })
    ).status === 422,
    'group result cannot reopen while knockout rounds depend on it',
  );
  let semi = await operation(`matches/${semis[0].id}/status`, {
    expectedVersion: semis[0].version,
    status: 'live',
  });
  semi = await operation(`matches/${semis[0].id}/status`, {
    expectedVersion: semi.data.version,
    status: 'finished',
  });
  ok(
    (
      await keyed(admin, `matches/${semis[0].id}/confirm`, {
        expectedVersion: semi.data.version,
      })
    ).status === 422,
    'tied knockout requires valid penalties',
  );
  semi = await operation(`matches/${semis[0].id}/confirm`, {
    expectedVersion: semi.data.version,
    homePenalties: 4,
    awayPenalties: 3,
  });
  ok(
    semi.data.home_score === 0 &&
      semi.data.away_score === 0 &&
      semi.data.homePenalties === 4,
    'penalties are separate from the match score',
  );
  let semi2 = await operation(`matches/${semis[1].id}/status`, {
    expectedVersion: semis[1].version,
    status: 'live',
  });
  semi2 = await operation(`matches/${semis[1].id}/events`, {
    expectedVersion: semi2.data.version,
    entryId: semi2.data.homeEntryId,
    kind: 'goal',
    minute: 7,
    rosterId: null,
  });
  semi2 = await operation(`matches/${semis[1].id}/status`, {
    expectedVersion: semi2.data.version,
    status: 'finished',
  });
  await operation(`matches/${semis[1].id}/confirm`, {
    expectedVersion: semi2.data.version,
  });
  final = (await get(`matches/${final.id}`)).data;
  ok(
    final.homeEntryId === semis[0].homeEntryId &&
      final.awayEntryId === semis[1].homeEntryId,
    'confirmed winners populate final participants',
  );
  ok(
    (
      await keyed(admin, `matches/${semis[0].id}/reopen`, {
        expectedVersion: semi.data.version,
        reason: 'Review semifinal',
      })
    ).status === 422,
    'dependent final blocks semifinal reopening',
  );
  let comp = (await get(`competitions/${c.id}/sport-state`)).data;
  await operation(`competitions/${c.id}/remove-rounds`, {
    expectedVersion: comp.version,
    fromRound: 2,
    reason: 'Correct semifinal before final',
  });
  semi = await operation(`matches/${semis[0].id}/reopen`, {
    expectedVersion: semi.data.version,
    reason: 'Correct semifinal winner',
  });
  semi = await operation(`matches/${semis[0].id}/events`, {
    expectedVersion: semi.data.version,
    entryId: semi.data.awayEntryId,
    kind: 'goal',
    minute: 30,
    rosterId: null,
  });
  await operation(`matches/${semis[0].id}/confirm`, {
    expectedVersion: semi.data.version,
  });
  comp = (await get(`competitions/${c.id}/sport-state`)).data;
  await operation(`competitions/${c.id}/rebuild-rounds`, {
    expectedVersion: comp.version,
    reason: 'Rebuild final after correction',
  });
  matches = (await get(`matches?competitionId=${c.id}&limit=100`)).data;
  final = matches.find((m) => m.stage === 'knockout' && m.roundNo === 2);
  ok(
    final.homeEntryId === semis[0].awayEntryId,
    'rebuilding later rounds respects corrected winners',
  );
  let f = await operation(`matches/${final.id}/status`, {
    expectedVersion: final.version,
    status: 'live',
  });
  comp = (await get(`competitions/${c.id}/sport-state`)).data;
  ok(
    (
      await keyed(admin, `competitions/${c.id}/remove-rounds`, {
        expectedVersion: comp.version,
        fromRound: 2,
        reason: 'Must not delete live final',
      })
    ).status === 422,
    'started final cannot be removed',
  );
  f = await operation(`matches/${final.id}/events`, {
    expectedVersion: f.data.version,
    entryId: f.data.homeEntryId,
    kind: 'goal',
    minute: 3,
    rosterId: null,
  });
  f = await operation(`matches/${final.id}/status`, {
    expectedVersion: f.data.version,
    status: 'finished',
  });
  await operation(`matches/${final.id}/confirm`, {
    expectedVersion: f.data.version,
  });
  const scorers = await fetch(
    base + `public/competitions/${c.id}/scorers`,
  ).then((r) => r.json());
  ok(
    scorers.data.some((s) => s.name === 'Striker' && Number(s.goals) === 1) &&
      !JSON.stringify(scorers).includes(privateContact),
    'top scorers count only identified confirmed non-own goals',
  );
  // Exact sporting ties require a reason; alphabetic display order cannot decide qualification.
  const juniorMatches = (
    await get(`matches?competitionId=${junior.id}&limit=100`)
  ).data;
  for (const match of juniorMatches) {
    let result = await operation(`matches/${match.id}/status`, {
      expectedVersion: match.version,
      status: 'live',
    });
    result = await operation(`matches/${match.id}/status`, {
      expectedVersion: result.data.version,
      status: 'finished',
    });
    await operation(`matches/${match.id}/confirm`, {
      expectedVersion: result.data.version,
    });
  }
  let juniorState = (await get(`competitions/${junior.id}/sport-state`)).data;
  const juniorSeeds = [juniorEntries[2].id, juniorEntries[3].id];
  ok(
    (
      await keyed(admin, `competitions/${junior.id}/qualify`, {
        expectedVersion: juniorState.version,
        entryIds: juniorSeeds,
      })
    ).status === 422,
    'exact sporting tie requires an organizer reason',
  );
  await operation(`competitions/${junior.id}/qualify`, {
    expectedVersion: juniorState.version,
    entryIds: juniorSeeds,
    tieReason: 'Organizador resuelve empate por sorteo supervisado',
  });
  ok(
    (await get(`matches?competitionId=${junior.id}&limit=100`)).data.some(
      (m) =>
        m.stage === 'knockout' &&
        m.homeEntryId === juniorSeeds[0] &&
        m.awayEntryId === juniorSeeds[1],
    ),
    'motivated tie selection can override alphabetic display order',
  );
  const adult = competitions.find((c) => c.slug === 'adulto');
  await admin.send(`competitions/${adult.id}`, 'PATCH', {
    ...rules,
    qualifiers: 3,
    expectedVersion: 0,
  });
  const adultEntries = [];
  for (const team of teams)
    adultEntries.push(
      await create(`competitions/${adult.id}/entries`, { teamId: team.id }),
    );
  const adultPreview = await create(`competitions/${adult.id}/draw-previews`, {
    mode: 'manual',
    entryIds: adultEntries.map((e) => e.id),
  });
  await operation(`competitions/${adult.id}/draw`, {
    previewId: adultPreview.id,
  });
  for (const match of (await get(`matches?competitionId=${adult.id}&limit=100`))
    .data) {
    let result = await operation(`matches/${match.id}/status`, {
      expectedVersion: match.version,
      status: 'live',
    });
    result = await operation(`matches/${match.id}/status`, {
      expectedVersion: result.data.version,
      status: 'finished',
    });
    await operation(`matches/${match.id}/confirm`, {
      expectedVersion: result.data.version,
    });
  }
  const adultState = (await get(`competitions/${adult.id}/sport-state`)).data;
  await operation(`competitions/${adult.id}/qualify`, {
    expectedVersion: adultState.version,
    entryIds: [6, 7, 0, 1, 2, 3].map((i) => adultEntries[i].id),
    tieReason: 'Sorteo supervisado para resolver igualdad deportiva',
  });
  const adultKnockout = (
    await get(`matches?competitionId=${adult.id}&limit=100`)
  ).data.filter((m) => m.stage === 'knockout');
  ok(
    adultKnockout.length === 7 &&
      adultKnockout.filter((m) => m.confirmed && m.away === 'BYE').length === 2,
    'six qualifiers create two explicit byes and a complete bracket',
  );
  ok(
    adultKnockout.some(
      (m) =>
        m.roundNo === 2 &&
        m.homeEntryId === adultEntries[6].id &&
        m.awayEntryId === adultEntries[7].id,
    ),
    'bye winners automatically populate the next round',
  );
  await admin.send(`seasons/${season.id}/activate`, 'POST', {
    expectedVersion: season.version,
  });
  const feed = await fetch(base + 'public/live').then((r) => r.json());
  ok(
    feed.data_origin === 'native' &&
      feed.season.id === season.id &&
      feed.matches.length === 37 &&
      !JSON.stringify(feed).includes(privateContact),
    'native live feed publishes only the active season with no player PII',
  );
  const site = await fetch(base + 'public/site').then((r) => r.json());
  ok(
    site.season.id === season.id &&
      site.matches.length === 37 &&
      site.competitions.length === 3,
    'published landing API returns the active season and excludes the unpublished competition',
  );
  ok(
    !JSON.stringify(site).includes(privateContact) &&
      !JSON.stringify(site).includes('birthDate') &&
      !JSON.stringify(site).includes('password'),
    'landing projection excludes private player data and credentials',
  );
  const siteOfficial = (
    await fetch(base + `public/competitions/${c.id}/standings`).then((r) =>
      r.json(),
    )
  ).data;
  ok(
    site.competitions
      .find((x) => x.id === c.id)
      .standings.every((row) =>
        siteOfficial.some(
          (o) => o.id === row.id && o.points === row.points && o.gf === row.gf,
        ),
      ),
    'landing standings use the same official confirmed results as the tournament API',
  );
  // Junior group matches remain pending: archiving must preserve an operational edition.
  const freshSeason = (await get('seasons?limit=100')).data.find(
    (s) => s.id === season.id,
  );
  ok(
    (
      await admin.send(`seasons/${season.id}/archive`, 'POST', {
        expectedVersion: freshSeason.version,
      })
    ).status === 422,
    'season with unfinished matches cannot be archived',
  );
  return { seasonId: season.id, competitionId: c.id };
}
