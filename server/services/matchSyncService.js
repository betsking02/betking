const cron = require('node-cron');
const { fetchCurrentMatches, syncMatchesToDb } = require('./cricketService');
const { fetchCricketOdds, syncOddsToDb } = require('./oddsService');

let io = null;
let liveWatchers = 0;
let livePollingInterval = null;

function setSocketIO(socketIO) {
  io = socketIO;
}

async function syncCricketMatches() {
  try {
    console.log('[SYNC] Starting cricket match sync...');
    const matches = await fetchCurrentMatches();
    if (matches.length > 0) {
      const count = syncMatchesToDb(matches);
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

// Smart polling: only poll frequently when users are watching
function addWatcher() {
  liveWatchers++;
  console.log(`[SYNC] Watcher joined. Active watchers: ${liveWatchers}`);

  if (liveWatchers === 1 && !livePollingInterval) {
    // First watcher - start frequent polling (every 2 minutes)
    console.log('[SYNC] Starting live polling (every 2 min)...');
    // Immediate sync when first watcher joins
    syncCricketMatches();
    livePollingInterval = setInterval(() => {
      syncCricketMatches();
    }, 2 * 60 * 1000); // 2 minutes
  }
}

function removeWatcher() {
  liveWatchers = Math.max(0, liveWatchers - 1);
  console.log(`[SYNC] Watcher left. Active watchers: ${liveWatchers}`);

  if (liveWatchers === 0 && livePollingInterval) {
    // No more watchers - stop frequent polling
    console.log('[SYNC] No watchers, stopping live polling');
    clearInterval(livePollingInterval);
    livePollingInterval = null;
  }
}

function startAutoSync() {
  // Run initial sync on boot (with small delay to let server start)
  setTimeout(() => {
    console.log('[SYNC] Running initial sync...');
    runFullSync();
  }, 3000);

  // Odds: every 2 hours (low frequency to save API calls)
  cron.schedule('0 */2 * * *', () => {
    syncOdds();
  });

  // Background cricket sync: every 30 min (just to keep data fresh even without watchers)
  cron.schedule('*/30 * * * *', () => {
    if (liveWatchers === 0) {
      syncCricketMatches();
    }
    // If watchers are active, the 2-min interval handles it
  });

  console.log('[SYNC] Auto-sync scheduled (smart polling: 2min when watched, 30min background, odds: 2h)');
}

module.exports = { startAutoSync, runFullSync, syncCricketMatches, syncOdds, setSocketIO, addWatcher, removeWatcher };
