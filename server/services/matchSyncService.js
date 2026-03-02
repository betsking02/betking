const cron = require('node-cron');
const { fetchCurrentMatches, syncMatchesToDb } = require('./cricketService');
const { fetchCricketOdds, syncOddsToDb } = require('./oddsService');

let io = null;

function setSocketIO(socketIO) {
  io = socketIO;
}

async function syncCricketMatches() {
  try {
    console.log('[SYNC] Starting cricket match sync...');
    const matches = await fetchCurrentMatches();
    if (matches.length > 0) {
      const count = syncMatchesToDb(matches);
      // Broadcast update to all connected clients
      if (io && count > 0) {
        io.emit('matches:updated', { sport: 'cricket', count });
      }
    }
  } catch (err) {
    console.error('[SYNC] Cricket sync error:', err.message);
  }
}

async function syncOdds() {
  try {
    console.log('[SYNC] Starting odds sync...');
    const odds = await fetchCricketOdds();
    if (odds.length > 0) {
      const count = syncOddsToDb(odds);
      if (io && count > 0) {
        io.emit('odds:updated', { count });
      }
    }
  } catch (err) {
    console.error('[SYNC] Odds sync error:', err.message);
  }
}

async function runFullSync() {
  await syncCricketMatches();
  await syncOdds();
  console.log('[SYNC] Full sync complete');
}

function startAutoSync() {
  // Run initial sync on boot (with small delay to let server start)
  setTimeout(() => {
    console.log('[SYNC] Running initial sync...');
    runFullSync();
  }, 3000);

  // Cricket scores: every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    syncCricketMatches();
  });

  // Odds: every 30 minutes
  cron.schedule('*/30 * * * *', () => {
    syncOdds();
  });

  console.log('[SYNC] Auto-sync scheduled (cricket: 5min, odds: 30min)');
}

module.exports = { startAutoSync, runFullSync, syncCricketMatches, syncOdds, setSocketIO };
