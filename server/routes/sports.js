const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { runFullSync } = require('../services/matchSyncService');

// Get all sports
router.get('/', (req, res) => {
  const sports = db.prepare('SELECT * FROM sports WHERE is_active = 1 ORDER BY sort_order').all();
  res.json({ sports });
});

// Get matches for a sport
router.get('/:key/matches', (req, res) => {
  const { key } = req.params;
  const { status } = req.query;

  // Get live + upcoming matches (all of them)
  const liveUpcoming = status
    ? db.prepare("SELECT * FROM matches WHERE sport_key = ? AND status = ? ORDER BY commence_time ASC").all(key, status)
    : db.prepare("SELECT * FROM matches WHERE sport_key = ? AND status IN ('live', 'upcoming') ORDER BY commence_time ASC").all(key);

  let completed = [];
  if (!status || status === 'completed') {
    // For completed: find active series (leagues with live/upcoming matches)
    const activeSeries = db.prepare(
      "SELECT DISTINCT league FROM matches WHERE sport_key = ? AND status IN ('live', 'upcoming')"
    ).all(key).map(r => r.league);

    if (activeSeries.length > 0) {
      // Show last 3 completed per active series
      const placeholders = activeSeries.map(() => '?').join(',');
      completed = db.prepare(
        `SELECT * FROM matches WHERE sport_key = ? AND status = 'completed' AND league IN (${placeholders}) ORDER BY commence_time DESC LIMIT 9`
      ).all(key, ...activeSeries);
    } else {
      // No active series - show the 6 most recent completed matches
      completed = db.prepare(
        "SELECT * FROM matches WHERE sport_key = ? AND status = 'completed' ORDER BY commence_time DESC LIMIT 6"
      ).all(key);
    }
  }

  const matches = status ? liveUpcoming : [...liveUpcoming, ...completed];

  // Attach odds to each match
  const matchesWithOdds = matches.map(match => {
    const odds = db.prepare('SELECT * FROM odds WHERE match_id = ? AND is_active = 1').all(match.id);
    return { ...match, odds };
  });

  res.json({ matches: matchesWithOdds });
});

// Get all matches (with filters)
router.get('/matches/all', (req, res) => {
  const { status, featured } = req.query;

  let query = 'SELECT * FROM matches WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (featured === '1') {
    query += ' AND is_featured = 1';
  }

  query += ' ORDER BY commence_time ASC';
  const matches = db.prepare(query).all(...params);

  const matchesWithOdds = matches.map(match => {
    const odds = db.prepare('SELECT * FROM odds WHERE match_id = ? AND is_active = 1').all(match.id);
    return { ...match, odds };
  });

  res.json({ matches: matchesWithOdds });
});

// Get live matches
router.get('/matches/live', (req, res) => {
  const matches = db.prepare("SELECT * FROM matches WHERE status = 'live' ORDER BY commence_time ASC").all();
  const matchesWithOdds = matches.map(match => {
    const odds = db.prepare('SELECT * FROM odds WHERE match_id = ? AND is_active = 1').all(match.id);
    return { ...match, odds };
  });
  res.json({ matches: matchesWithOdds });
});

// Get featured matches
router.get('/matches/featured', (req, res) => {
  const matches = db.prepare("SELECT * FROM matches WHERE is_featured = 1 AND status != 'cancelled' ORDER BY commence_time ASC LIMIT 10").all();
  const matchesWithOdds = matches.map(match => {
    const odds = db.prepare('SELECT * FROM odds WHERE match_id = ? AND is_active = 1').all(match.id);
    return { ...match, odds };
  });
  res.json({ matches: matchesWithOdds });
});

// Get single match with odds
router.get('/matches/:id', (req, res) => {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const odds = db.prepare('SELECT * FROM odds WHERE match_id = ? AND is_active = 1').all(match.id);
  res.json({ match: { ...match, odds } });
});

// Trigger manual sync
router.get('/sync', async (req, res) => {
  try {
    await runFullSync();
    res.json({ success: true, message: 'Sync completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
