require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/database');
const initDatabase = require('./init');
const bcrypt = require('bcryptjs');

function seed() {
  initDatabase();

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, email, password_hash, display_name, role, balance, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Admin account
  const adminHash = bcrypt.hashSync('admin123', 10);
  insertUser.run('admin', 'admin@betking.com', adminHash, 'Admin', 'admin', 100000, 0);

  // Demo account
  const demoHash = bcrypt.hashSync('demo123', 10);
  insertUser.run('demo', 'demo@betking.com', demoHash, 'Demo User', 'demo', 10000, 1);

  // Test user
  const userHash = bcrypt.hashSync('user123', 10);
  insertUser.run('testuser', 'test@betking.com', userHash, 'Test User', 'user', 10000, 0);

  // Sports
  const insertSport = db.prepare(`
    INSERT OR IGNORE INTO sports (key, name, icon, is_active, sort_order)
    VALUES (?, ?, ?, 1, ?)
  `);
  insertSport.run('cricket', 'Cricket', 'sports_cricket', 1);
  insertSport.run('football', 'Football', 'sports_soccer', 2);
  insertSport.run('tennis', 'Tennis', 'sports_tennis', 3);
  insertSport.run('basketball', 'Basketball', 'sports_basketball', 4);
  insertSport.run('kabaddi', 'Kabaddi', 'sports_kabaddi', 5);

  // Sample matches with odds
  const insertMatch = db.prepare(`
    INSERT OR IGNORE INTO matches (external_id, sport_key, league, home_team, away_team, commence_time, status, is_featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOdds = db.prepare(`
    INSERT INTO odds (match_id, market_type, outcome_name, odds_value)
    VALUES (?, ?, ?, ?)
  `);

  const now = new Date();
  const hour = (h) => new Date(now.getTime() + h * 3600000).toISOString();

  // Cricket matches
  const cricketMatches = [
    { ext: 'cr1', league: 'IPL 2026', home: 'Mumbai Indians', away: 'Chennai Super Kings', time: hour(2), status: 'upcoming', featured: 1 },
    { ext: 'cr2', league: 'IPL 2026', home: 'Royal Challengers Bangalore', away: 'Kolkata Knight Riders', time: hour(-1), status: 'live', featured: 1 },
    { ext: 'cr3', league: 'IPL 2026', home: 'Delhi Capitals', away: 'Rajasthan Royals', time: hour(5), status: 'upcoming', featured: 0 },
    { ext: 'cr4', league: 'Test Series', home: 'India', away: 'Australia', time: hour(24), status: 'upcoming', featured: 1 },
    { ext: 'cr5', league: 'ODI Series', home: 'England', away: 'South Africa', time: hour(48), status: 'upcoming', featured: 0 },
  ];

  // Football matches
  const footballMatches = [
    { ext: 'fb1', league: 'EPL', home: 'Manchester United', away: 'Liverpool', time: hour(3), status: 'upcoming', featured: 1 },
    { ext: 'fb2', league: 'EPL', home: 'Arsenal', away: 'Chelsea', time: hour(-0.5), status: 'live', featured: 1 },
    { ext: 'fb3', league: 'La Liga', home: 'Real Madrid', away: 'Barcelona', time: hour(6), status: 'upcoming', featured: 1 },
    { ext: 'fb4', league: 'UCL', home: 'Bayern Munich', away: 'PSG', time: hour(24), status: 'upcoming', featured: 0 },
    { ext: 'fb5', league: 'EPL', home: 'Manchester City', away: 'Tottenham', time: hour(48), status: 'upcoming', featured: 0 },
  ];

  // Tennis matches
  const tennisMatches = [
    { ext: 'tn1', league: 'ATP Masters', home: 'Novak Djokovic', away: 'Carlos Alcaraz', time: hour(4), status: 'upcoming', featured: 1 },
    { ext: 'tn2', league: 'ATP Masters', home: 'Jannik Sinner', away: 'Daniil Medvedev', time: hour(-0.3), status: 'live', featured: 0 },
    { ext: 'tn3', league: 'Grand Slam', home: 'Rafael Nadal', away: 'Alexander Zverev', time: hour(8), status: 'upcoming', featured: 0 },
  ];

  // Basketball matches
  const basketballMatches = [
    { ext: 'bb1', league: 'NBA', home: 'LA Lakers', away: 'Golden State Warriors', time: hour(5), status: 'upcoming', featured: 1 },
    { ext: 'bb2', league: 'NBA', home: 'Boston Celtics', away: 'Miami Heat', time: hour(-0.2), status: 'live', featured: 0 },
    { ext: 'bb3', league: 'NBA', home: 'Milwaukee Bucks', away: 'Philadelphia 76ers', time: hour(10), status: 'upcoming', featured: 0 },
  ];

  // Kabaddi matches (mock)
  const kabaddiMatches = [
    { ext: 'kb1', league: 'PKL', home: 'Patna Pirates', away: 'Jaipur Pink Panthers', time: hour(3), status: 'upcoming', featured: 0 },
    { ext: 'kb2', league: 'PKL', home: 'Bengal Warriors', away: 'U Mumba', time: hour(-0.5), status: 'live', featured: 0 },
    { ext: 'kb3', league: 'PKL', home: 'Dabang Delhi KC', away: 'Puneri Paltan', time: hour(7), status: 'upcoming', featured: 0 },
  ];

  const allMatches = [
    ...cricketMatches.map(m => ({ ...m, sport: 'cricket' })),
    ...footballMatches.map(m => ({ ...m, sport: 'football' })),
    ...tennisMatches.map(m => ({ ...m, sport: 'tennis' })),
    ...basketballMatches.map(m => ({ ...m, sport: 'basketball' })),
    ...kabaddiMatches.map(m => ({ ...m, sport: 'kabaddi' })),
  ];

  function randomOdds(min, max) {
    return Math.round((min + Math.random() * (max - min)) * 100) / 100;
  }

  const insertAll = db.transaction(() => {
    for (const m of allMatches) {
      const info = insertMatch.run(m.ext, m.sport, m.league, m.home, m.away, m.time, m.status, m.featured);
      const matchId = info.lastInsertRowid;
      if (matchId) {
        // Head to head odds
        const homeOdds = randomOdds(1.4, 3.5);
        const awayOdds = randomOdds(1.4, 3.5);
        const drawOdds = randomOdds(2.5, 5.0);

        insertOdds.run(matchId, 'h2h', 'Home', homeOdds);
        insertOdds.run(matchId, 'h2h', 'Away', awayOdds);
        if (['football', 'cricket'].includes(m.sport)) {
          insertOdds.run(matchId, 'h2h', 'Draw', drawOdds);
        }
      }
    }
  });

  insertAll();

  // App settings
  const insertSetting = db.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)
  `);
  insertSetting.run('default_balance', '10000');
  insertSetting.run('max_bet', '50000');
  insertSetting.run('min_bet', '10');
  insertSetting.run('house_edge_slots', '0.04');
  insertSetting.run('house_edge_roulette', '0.027');
  insertSetting.run('house_edge_crash', '0.01');

  console.log('Database seeded successfully');
}

seed();
