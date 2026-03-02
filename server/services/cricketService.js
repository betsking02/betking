const db = require('../config/database');

const CRICAPI_BASE = 'https://api.cricapi.com/v1';

function getApiKey() {
  return process.env.CRICAPI_KEY || '';
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

async function fetchCurrentMatches() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[CRICKET] No CRICAPI_KEY set, skipping');
    return [];
  }

  // Check cache first (2 min TTL for live updates)
  const cached = getCached('cricapi_current_matches');
  if (cached) {
    console.log('[CRICKET] Using cached match data');
    return cached;
  }

  try {
    console.log('[CRICKET] Fetching current matches from CricAPI...');
    const res = await fetch(`${CRICAPI_BASE}/currentMatches?apikey=${apiKey}&offset=0`);
    const data = await res.json();

    if (data.status !== 'success' || !data.data) {
      console.error('[CRICKET] API error:', data.info || data.status);
      return [];
    }

    const matches = data.data.filter(m => m.matchType && m.teams && m.teams.length >= 2);
    setCache('cricapi_current_matches', matches, 2);
    console.log(`[CRICKET] Fetched ${matches.length} matches`);
    return matches;
  } catch (err) {
    console.error('[CRICKET] Fetch error:', err.message);
    return [];
  }
}

function mapCricApiStatus(cricMatch) {
  if (!cricMatch.matchStarted && !cricMatch.matchEnded) return 'upcoming';
  if (cricMatch.matchStarted && !cricMatch.matchEnded) return 'live';
  if (cricMatch.matchEnded) return 'completed';
  return 'upcoming';
}

function parseScores(cricMatch) {
  const scores = cricMatch.score || [];
  const innings = [];
  let homeScore = 0;
  let awayScore = 0;

  scores.forEach((s, i) => {
    innings.push({
      runs: s.r,
      wickets: s.w,
      overs: s.o,
      inning: s.inning
    });
  });

  if (scores.length >= 1) homeScore = scores[0].r || 0;
  if (scores.length >= 2) awayScore = scores[1].r || 0;

  // Store rich details including venue, team info, match name, status text
  const details = {
    innings,
    venue: cricMatch.venue || '',
    matchName: cricMatch.name || '',
    matchType: cricMatch.matchType || '',
    statusText: cricMatch.status || '',
    teamInfo: cricMatch.teamInfo || [],
    seriesId: cricMatch.series_id || '',
    bbbEnabled: cricMatch.bbbEnabled || false,
    hasSquad: cricMatch.hasSquad || false,
  };

  return { homeScore, awayScore, details };
}

function getLeague(cricMatch) {
  // Extract series name from match name
  // e.g. "India vs West Indies, 52nd Match, Super 8 Group 1, ICC Men's T20 World Cup 2026"
  // → "ICC Men's T20 World Cup 2026"
  if (cricMatch.name) {
    const parts = cricMatch.name.split(',').map(p => p.trim());
    if (parts.length >= 3) return parts[parts.length - 1];
    if (parts.length === 2) return parts[1];
  }
  return cricMatch.matchType?.toUpperCase() || 'Cricket';
}

function syncMatchesToDb(cricMatches) {
  // Add unique index on external_id if not exists
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_external_id ON matches(external_id) WHERE external_id IS NOT NULL');
  } catch (e) { /* index may already exist */ }

  let synced = 0;
  for (const cm of cricMatches) {
    if (!cm.id || !cm.teams || cm.teams.length < 2) continue;

    const status = mapCricApiStatus(cm);
    const { homeScore, awayScore, details } = parseScores(cm);
    const league = getLeague(cm);
    const commenceTime = cm.dateTimeGMT || cm.date || new Date().toISOString();
    const isFeatured = status === 'live' ? 1 : 0;
    const scoreJson = JSON.stringify(details);

    // Try insert first, on conflict update
    const existing = db.prepare('SELECT id FROM matches WHERE external_id = ?').get(cm.id);

    if (existing) {
      db.prepare(`
        UPDATE matches SET status = ?, home_score = ?, away_score = ?, score_details = ?, league = ?, is_featured = ?, updated_at = datetime('now')
        WHERE external_id = ?
      `).run(status, homeScore, awayScore, scoreJson, league, isFeatured, cm.id);
    } else {
      db.prepare(`
        INSERT INTO matches (external_id, sport_key, league, home_team, away_team, commence_time, status, home_score, away_score, score_details, is_featured, updated_at)
        VALUES (?, 'cricket', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(cm.id, league, cm.teams[0], cm.teams[1], commenceTime, status, homeScore, awayScore, scoreJson, isFeatured);
    }
    synced++;
  }

  console.log(`[CRICKET] Synced ${synced} matches to database`);
  return synced;
}

module.exports = { fetchCurrentMatches, syncMatchesToDb, mapCricApiStatus, parseScores };
