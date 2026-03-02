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

  // Sports categories (matches populated from APIs)
  const insertSport = db.prepare(`
    INSERT OR IGNORE INTO sports (key, name, icon, is_active, sort_order)
    VALUES (?, ?, ?, 1, ?)
  `);
  insertSport.run('cricket', 'Cricket', 'sports_cricket', 1);
  insertSport.run('football', 'Football', 'sports_soccer', 2);
  insertSport.run('tennis', 'Tennis', 'sports_tennis', 3);
  insertSport.run('basketball', 'Basketball', 'sports_basketball', 4);
  insertSport.run('kabaddi', 'Kabaddi', 'sports_kabaddi', 5);

  // No fake matches - all match data comes from live APIs:
  // Cricket: CricAPI (live scores) + The Odds API (odds)
  // Football, Tennis, Basketball: The Odds API (odds + upcoming matches)
  // Kabaddi: No API available, stays empty unless admin adds manually

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
