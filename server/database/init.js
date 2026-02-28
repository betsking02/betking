const db = require('../config/database');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      username        TEXT UNIQUE NOT NULL,
      email           TEXT UNIQUE,
      password_hash   TEXT NOT NULL,
      display_name    TEXT DEFAULT '',
      role            TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin', 'demo')),
      balance         REAL DEFAULT 10000.00,
      is_demo         INTEGER DEFAULT 0,
      avatar_url      TEXT DEFAULT '',
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      last_login      TEXT,
      is_verified     INTEGER DEFAULT 0,
      verification_code TEXT,
      verification_expires TEXT
    );

    CREATE TABLE IF NOT EXISTS sports (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      key             TEXT UNIQUE NOT NULL,
      name            TEXT NOT NULL,
      icon            TEXT DEFAULT '',
      is_active       INTEGER DEFAULT 1,
      sort_order      INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS matches (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id     TEXT,
      sport_key       TEXT NOT NULL,
      league          TEXT DEFAULT '',
      home_team       TEXT NOT NULL,
      away_team       TEXT NOT NULL,
      commence_time   TEXT NOT NULL,
      status          TEXT DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'live', 'completed', 'cancelled')),
      home_score      INTEGER DEFAULT 0,
      away_score      INTEGER DEFAULT 0,
      score_details   TEXT DEFAULT '{}',
      result          TEXT CHECK(result IN ('home', 'away', 'draw', NULL)),
      is_featured     INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sport_key) REFERENCES sports(key)
    );

    CREATE TABLE IF NOT EXISTS odds (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id        INTEGER NOT NULL,
      market_type     TEXT NOT NULL,
      outcome_name    TEXT NOT NULL,
      odds_value      REAL NOT NULL,
      bookmaker       TEXT DEFAULT 'betking',
      is_active       INTEGER DEFAULT 1,
      updated_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bets (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      match_id        INTEGER,
      game_type       TEXT NOT NULL,
      bet_type        TEXT,
      selection       TEXT NOT NULL,
      odds_at_placement REAL,
      stake           REAL NOT NULL,
      potential_payout REAL,
      actual_payout   REAL DEFAULT 0,
      status          TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'won', 'lost', 'void', 'cashout')),
      cashout_at      REAL,
      game_round_id   TEXT,
      game_details    TEXT DEFAULT '{}',
      placed_at       TEXT DEFAULT (datetime('now')),
      settled_at      TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (match_id) REFERENCES matches(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      type            TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw', 'bet_placed', 'bet_won', 'bet_lost', 'bonus', 'refund')),
      amount          REAL NOT NULL,
      balance_after   REAL NOT NULL,
      reference_id    TEXT,
      description     TEXT DEFAULT '',
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS casino_rounds (
      id              TEXT PRIMARY KEY,
      game_type       TEXT NOT NULL,
      server_seed     TEXT NOT NULL,
      client_seed     TEXT,
      nonce           INTEGER DEFAULT 0,
      result          TEXT NOT NULL,
      multiplier      REAL,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crash_game_state (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id        TEXT UNIQUE NOT NULL,
      crash_point     REAL NOT NULL,
      status          TEXT DEFAULT 'waiting' CHECK(status IN ('waiting', 'running', 'crashed')),
      started_at      TEXT,
      crashed_at      TEXT,
      hash            TEXT NOT NULL,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key             TEXT PRIMARY KEY,
      value           TEXT NOT NULL,
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cache (
      key             TEXT PRIMARY KEY,
      value           TEXT NOT NULL,
      expires_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
    CREATE INDEX IF NOT EXISTS idx_bets_match_id ON bets(match_id);
    CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_matches_sport_key ON matches(sport_key);
    CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
    CREATE INDEX IF NOT EXISTS idx_odds_match_id ON odds(match_id);
  `);

  // Migration: add verification columns if they don't exist
  const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!cols.includes('is_verified')) {
    db.exec("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0");
  }
  if (!cols.includes('verification_code')) {
    db.exec("ALTER TABLE users ADD COLUMN verification_code TEXT");
  }
  if (!cols.includes('verification_expires')) {
    db.exec("ALTER TABLE users ADD COLUMN verification_expires TEXT");
  }
  // Mark existing users as verified so they aren't locked out
  db.prepare("UPDATE users SET is_verified = 1 WHERE is_verified = 0 AND verification_code IS NULL").run();

  console.log('Database initialized successfully');
}

module.exports = initDatabase;
