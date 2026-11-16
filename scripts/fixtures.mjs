export function fixture(scenario = 'empty') {
  const base = {
    id: 1,
    category_id: 1,
    category: 'Infantil',
    group_name: 'Group A',
    status: 'live',
    elapsed: 1080,
    home: 'Gainesville',
    away: 'Achoapa',
    home_score: 2,
    away_score: 1,
    home_crest: null,
    away_crest: null,
    field: 'C-2A',
    scheduled_iso: null,
    scheduled_at: null,
    updated_at: '2026-11-09 12:00:00',
    timezone: 'America/New_York',
  };
  return {
    server_time: '2026-11-09T12:00:00Z',
    season: null,
    matches:
      scenario === 'empty'
        ? []
        : [
            base,
            {
              ...base,
              id: 2,
              category_id: 2,
              category: 'Junior',
              home: 'Junior FC',
              away: 'Tango FC',
              status: 'paused',
            },
            {
              ...base,
              id: 3,
              category: 'Adulto',
              category_id: 3,
              status: 'suspended',
            },
          ],
    posters:
      scenario === 'posters'
        ? [
            {
              id: 1,
              title: 'Smoky Mountain Cup',
              alt: 'Tournament photograph',
              image: 'upload/1.jpg',
              link: 'https://example.com',
            },
          ]
        : [],
  };
}
