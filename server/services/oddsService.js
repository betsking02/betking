const db = require('../config/database');

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const CRICKET_SPORTS = ['cricket_odi', 'cricket_t20_world_cup'];

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

async function fetchCricketOdds() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[ODDS] No ODDS_API_KEY set, skipping');
    return [];
  }

  // Check cache first (2 hour TTL)
  const cached = getCached('odds_api_cricket');
  if (cached) {
    console.log('[ODDS] Using cached odds data');
    return cached;
  }

  const allOdds = [];

  for (const sportKey of CRICKET_SPORTS) {
    try {
      console.log(`[ODDS] Fetching odds for ${sportKey}...`);
      const res = await fetch(
        `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=uk&markets=h2h&oddsFormat=decimal`
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[ODDS] API error for ${sportKey}:`, errText);
        continue;
      }

      const data = await res.json();
      allOdds.push(...data);
      console.log(`[ODDS] Got ${data.length} matches with odds for ${sportKey}`);
    } catch (err) {
      console.error(`[ODDS] Fetch error for ${sportKey}:`, err.message);
    }
  }

  if (allOdds.length > 0) {
    setCache('odds_api_cricket', allOdds, 120); // 2 hour cache
  }

  console.log(`[ODDS] Total: ${allOdds.length} matches with odds`);
  return allOdds;
}

function syncOddsToDb(oddsData) {
  let synced = 0;

  for (const event of oddsData) {
    // Find matching match in our DB by team names or external_id
    let match = db.prepare(
      "SELECT id FROM matches WHERE external_id = ? AND sport_key = 'cricket'"
    ).get(event.id);

    if (!match) {
      // Try to find by team names
      match = db.prepare(
        "SELECT id FROM matches WHERE sport_key = 'cricket' AND ((home_team = ? AND away_team = ?) OR (home_team = ? AND away_team = ?))"
      ).get(event.home_team, event.away_team, event.away_team, event.home_team);
    }

    if (!match) {
      // Create the match if it doesn't exist
      try {
        const result = db.prepare(`
          INSERT INTO matches (external_id, sport_key, league, home_team, away_team, commence_time, status, is_featured)
          VALUES (?, 'cricket', ?, ?, ?, ?, 'upcoming', 1)
        `).run(
          event.id,
          event.sport_title || 'Cricket',
          event.home_team,
          event.away_team,
          event.commence_time,
          1
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

module.exports = { fetchCricketOdds, syncOddsToDb };
