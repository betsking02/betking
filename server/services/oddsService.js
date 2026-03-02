const db = require('../config/database');

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Map Odds API sport keys to our sport_key in DB
const SPORT_CONFIGS = [
  // Cricket
  { apiKeys: ['cricket_odi', 'cricket_t20_world_cup'], sportKey: 'cricket' },
  // Football (Soccer) - top leagues
  { apiKeys: ['soccer_epl', 'soccer_spain_la_liga', 'soccer_uefa_champs_league', 'soccer_italy_serie_a', 'soccer_germany_bundesliga'], sportKey: 'football' },
  // Basketball
  { apiKeys: ['basketball_nba'], sportKey: 'basketball' },
  // Tennis
  { apiKeys: ['tennis_wta_indian_wells'], sportKey: 'tennis' },
];

function getApiKey() {
  return process.env.ODDS_API_KEY || '';
}

function getCached(key) {
  const row = db.prepare('SELECT value, expires_at FROM cache WHERE key = ?').get(key);
  if (row && new Date(row.expires_at) > new Date()) {
    return JSON.parse(row.value);
  }
  return null;
}

function setCache(key, value, ttlMinutes) {
  const expires = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  db.prepare('INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)').run(key, JSON.stringify(value), expires);
}

async function fetchAllOdds() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[ODDS] No ODDS_API_KEY set, skipping');
    return [];
  }

  // Check cache first (3 hour TTL to save API calls)
  const cached = getCached('odds_api_all');
  if (cached) {
    console.log('[ODDS] Using cached odds data');
    return cached;
  }

  const allResults = [];

  for (const config of SPORT_CONFIGS) {
    for (const apiKey_sport of config.apiKeys) {
      try {
        console.log(`[ODDS] Fetching odds for ${apiKey_sport}...`);
        const res = await fetch(
          `${ODDS_API_BASE}/sports/${apiKey_sport}/odds/?apiKey=${apiKey}&regions=uk&markets=h2h&oddsFormat=decimal`
        );

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[ODDS] API error for ${apiKey_sport}:`, errText);
          continue;
        }

        const data = await res.json();
        // Tag each event with our sport key
        data.forEach(event => {
          event._sportKey = config.sportKey;
        });
        allResults.push(...data);
        console.log(`[ODDS] Got ${data.length} matches for ${apiKey_sport}`);

        // Check remaining API quota from headers
        const remaining = res.headers.get('x-requests-remaining');
        if (remaining) console.log(`[ODDS] API requests remaining: ${remaining}`);
      } catch (err) {
        console.error(`[ODDS] Fetch error for ${apiKey_sport}:`, err.message);
      }
    }
  }

  if (allResults.length > 0) {
    setCache('odds_api_all', allResults, 180); // 3 hour cache
  }

  console.log(`[ODDS] Total: ${allResults.length} matches across all sports`);
  return allResults;
}

// Keep old function name for backwards compat
async function fetchCricketOdds() {
  return fetchAllOdds();
}

function syncOddsToDb(oddsData) {
  // Ensure unique index exists
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_external_id ON matches(external_id) WHERE external_id IS NOT NULL');
  } catch (e) { /* may already exist */ }

  let synced = 0;

  for (const event of oddsData) {
    const sportKey = event._sportKey || 'cricket';

    // Find matching match in our DB
    let match = db.prepare(
      'SELECT id FROM matches WHERE external_id = ?'
    ).get(event.id);

    if (!match) {
      // Try to find by team names + sport
      match = db.prepare(
        'SELECT id FROM matches WHERE sport_key = ? AND ((home_team = ? AND away_team = ?) OR (home_team = ? AND away_team = ?))'
      ).get(sportKey, event.home_team, event.away_team, event.away_team, event.home_team);
    }

    if (!match) {
      // Create the match
      try {
        const result = db.prepare(`
          INSERT INTO matches (external_id, sport_key, league, home_team, away_team, commence_time, status, is_featured, score_details)
          VALUES (?, ?, ?, ?, ?, ?, 'upcoming', 1, '{}')
        `).run(
          event.id,
          sportKey,
          event.sport_title || sportKey,
          event.home_team,
          event.away_team,
          event.commence_time
        );
        match = { id: result.lastInsertRowid };
      } catch (e) {
        console.error(`[ODDS] Failed to create match for ${event.home_team} vs ${event.away_team}:`, e.message);
        continue;
      }
    }

    // Get best odds from all bookmakers
    const bestOdds = { Home: 0, Away: 0, Draw: 0 };
    const bookmakerNames = { Home: '', Away: '', Draw: '' };

    for (const bookmaker of (event.bookmakers || [])) {
      for (const market of (bookmaker.markets || [])) {
        if (market.key !== 'h2h') continue;
        for (const outcome of (market.outcomes || [])) {
          const key = outcome.name === event.home_team ? 'Home'
            : outcome.name === event.away_team ? 'Away'
            : 'Draw';
          if (outcome.price > bestOdds[key]) {
            bestOdds[key] = outcome.price;
            bookmakerNames[key] = bookmaker.title;
          }
        }
      }
    }

    // Upsert odds into DB
    for (const [outcomeName, oddsValue] of Object.entries(bestOdds)) {
      if (oddsValue <= 0) continue;

      const existing = db.prepare(
        'SELECT id FROM odds WHERE match_id = ? AND market_type = ? AND outcome_name = ?'
      ).get(match.id, 'h2h', outcomeName);

      if (existing) {
        db.prepare(
          "UPDATE odds SET odds_value = ?, bookmaker = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(oddsValue, bookmakerNames[outcomeName], existing.id);
      } else {
        db.prepare(
          "INSERT INTO odds (match_id, market_type, outcome_name, odds_value, bookmaker, is_active) VALUES (?, 'h2h', ?, ?, ?, 1)"
        ).run(match.id, outcomeName, oddsValue, bookmakerNames[outcomeName]);
      }
      synced++;
    }
  }

  console.log(`[ODDS] Synced ${synced} odds entries to database`);
  return synced;
}

module.exports = { fetchCricketOdds, fetchAllOdds, syncOddsToDb };
