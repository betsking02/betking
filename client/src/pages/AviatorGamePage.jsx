import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import AviatorCanvas from '../components/casino/AviatorCanvas';
import toast from 'react-hot-toast';
import './CasinoGame.css';

const INIT_BET = {
  stake: 100,
  autoCashoutEnabled: false,
  autoCashoutInput: '2.00',
  placed: false,
  cashedOut: false,
  won: false,
  lastPayout: 0,
};

function getHistoryColor(point) {
  if (point < 1.5) return '#ff4444';
  if (point < 2) return '#ff6b00';
  if (point < 5) return '#e6a817';
  return '#00e701';
}

function BetPanel({ panelId, bet, setBet, gameStatus, socket, countdown, user }) {
  const autoCashoutVal = parseFloat(bet.autoCashoutInput);
  const isValidAuto = !isNaN(autoCashoutVal) && autoCashoutVal > 1.01;
  const potentialPayout = Math.round(bet.stake * (parseFloat(bet.autoCashoutInput) || 2) * 100) / 100;

  const placeBet = useCallback(() => {
    if (!socket || !user) return toast.error('Not logged in');
    const autoCashout = bet.autoCashoutEnabled && isValidAuto ? autoCashoutVal : null;
    socket.emit('crash:place_bet', { amount: bet.stake, autoCashout }, (res) => {
      if (res.error) return toast.error(res.error);
      setBet(prev => ({ ...prev, placed: true }));
      toast.success(`Bet ${panelId} placed!`);
    });
  }, [socket, user, bet.stake, bet.autoCashoutEnabled, bet.autoCashoutInput, isValidAuto, autoCashoutVal, panelId, setBet]);

  const cashOut = useCallback(() => {
    if (!socket) return;
    socket.emit('crash:cashout', null, (res) => {
      if (res.error) return toast.error(res.error);
      setBet(prev => ({ ...prev, cashedOut: true, won: true, lastPayout: res.payout }));
      toast.success(`Cashed out at ${res.multiplier}x! +₹${formatCurrency(res.payout)}`);
    });
  }, [socket, setBet]);

  // Waiting, not placed yet
  if (gameStatus === 'waiting' && !bet.placed) {
    return (
      <div className="av-bet-panel">
        <div className="av-panel-label">BET {panelId}</div>
        <div className="av-stake-row">
          {BET_AMOUNTS.map(amt => (
            <button
              key={amt}
              className={`av-stake-btn ${bet.stake === amt ? 'active' : ''}`}
              onClick={() => setBet(prev => ({ ...prev, stake: amt }))}
            >
              {formatCurrency(amt)}
            </button>
          ))}
        </div>
        <div className="av-auto-row">
          <label className="av-auto-label">
            <input
              type="checkbox"
              checked={bet.autoCashoutEnabled}
              onChange={e => setBet(prev => ({ ...prev, autoCashoutEnabled: e.target.checked }))}
            />
            Auto Cash Out
          </label>
          {bet.autoCashoutEnabled && (
            <input
              className="av-auto-input"
              type="number"
              min="1.02"
              step="0.1"
              value={bet.autoCashoutInput}
              onChange={e => setBet(prev => ({ ...prev, autoCashoutInput: e.target.value }))}
            />
          )}
        </div>
        <button
          className="av-action-btn av-action-bet"
          onClick={placeBet}
          disabled={!user || (user?.balance || 0) < bet.stake || countdown <= 0}
        >
          BET ₹{formatCurrency(bet.stake)}
          {bet.autoCashoutEnabled && isValidAuto && (
            <span className="av-btn-sub">Auto at {autoCashoutVal.toFixed(2)}x</span>
          )}
        </button>
      </div>
    );
  }

  // Waiting, bet placed
  if (gameStatus === 'waiting' && bet.placed) {
    return (
      <div className="av-bet-panel av-panel-waiting">
        <div className="av-panel-label">BET {panelId}</div>
        <div className="av-placed-info">
          <div className="av-placed-amount">₹{formatCurrency(bet.stake)}</div>
          {bet.autoCashoutEnabled && isValidAuto && (
            <div className="av-placed-auto">Auto at {autoCashoutVal.toFixed(2)}x</div>
          )}
        </div>
        <div className="av-waiting-msg">✈️ Waiting for takeoff...</div>
      </div>
    );
  }

  // Running, bet placed, not cashed out
  if (gameStatus === 'running' && bet.placed && !bet.cashedOut) {
    return (
      <div className="av-bet-panel av-panel-active">
        <div className="av-panel-label">BET {panelId}</div>
        <div className="av-placed-info">
          <div className="av-placed-amount">₹{formatCurrency(bet.stake)}</div>
          {bet.autoCashoutEnabled && isValidAuto && (
            <div className="av-placed-auto">Auto at {autoCashoutVal.toFixed(2)}x</div>
          )}
        </div>
        <button className="av-action-btn av-action-cashout" onClick={cashOut}>
          CASH OUT
        </button>
      </div>
    );
  }

  // Cashed out (won)
  if (bet.cashedOut && bet.won) {
    return (
      <div className="av-bet-panel av-panel-won">
        <div className="av-panel-label">BET {panelId}</div>
        <div className="av-result-won">
          <div className="av-result-icon">✅</div>
          <div className="av-result-amount">+₹{formatCurrency(bet.lastPayout)}</div>
        </div>
      </div>
    );
  }

  // Auto-cashed out (won, set by crash:cashed_out event for this user)
  // Running but no bet (spectating)
  if (gameStatus === 'running' && !bet.placed) {
    return (
      <div className="av-bet-panel av-panel-spectate">
        <div className="av-panel-label">BET {panelId}</div>
        <div className="av-spectate-msg">In flight...</div>
        <div className="av-spectate-sub">Place bet next round</div>
      </div>
    );
  }

  // Crashed, bet was placed but not cashed out (lost)
  if (gameStatus === 'crashed' && bet.placed && !bet.cashedOut) {
    return (
      <div className="av-bet-panel av-panel-lost">
        <div className="av-panel-label">BET {panelId}</div>
        <div className="av-result-lost">
          <div className="av-result-icon">💥</div>
          <div className="av-result-amount">-₹{formatCurrency(bet.stake)}</div>
        </div>
      </div>
    );
  }

  // Default / crashed / spectating
  return (
    <div className="av-bet-panel av-panel-idle">
      <div className="av-panel-label">BET {panelId}</div>
      <div className="av-spectate-msg">Next round</div>
    </div>
  );
}

export default function AviatorGamePage() {
  const { user } = useContext(AuthContext);
  const socket = useSocket();

  const [gameState, setGameState] = useState({
    status: 'waiting',
    multiplier: 1.00,
    history: [],
    bets: [],
  });
  const [countdown, setCountdown] = useState(10);
  const [bet1, setBet1] = useState({ ...INIT_BET });
  const [bet2, setBet2] = useState({ ...INIT_BET });
  const [activeTab, setActiveTab] = useState('players');
  const [myBets, setMyBets] = useState([]); // session bet history
  const username = user?.username;

  // Track if user was auto-cashed out (server does it silently via autoCashoutHandler)
  // We detect it from crash:cashed_out events matching the user's username
  useEffect(() => {
    if (!socket) return;

    socket.emit('crash:join');
    socket.emit('crash:state', undefined, (state) => {});

    socket.on('crash:state', (state) => {
      setGameState(state);
      if (state.status === 'waiting') setCountdown(10);
    });

    socket.on('crash:waiting', ({ countdown: cd }) => {
      setGameState(prev => ({ ...prev, status: 'waiting', multiplier: 1.00, bets: [] }));
      setCountdown(cd);
      // Reset panels for new round
      setBet1(prev => ({
        ...INIT_BET,
        stake: prev.stake,
        autoCashoutEnabled: prev.autoCashoutEnabled,
        autoCashoutInput: prev.autoCashoutInput,
      }));
      setBet2(prev => ({
        ...INIT_BET,
        stake: prev.stake,
        autoCashoutEnabled: prev.autoCashoutEnabled,
        autoCashoutInput: prev.autoCashoutInput,
      }));
    });

    socket.on('crash:start', () => {
      setGameState(prev => ({ ...prev, status: 'running' }));
    });

    socket.on('crash:tick', ({ multiplier }) => {
      setGameState(prev => ({ ...prev, multiplier }));
    });

    socket.on('crash:end', ({ crashPoint }) => {
      setGameState(prev => ({
        ...prev,
        status: 'crashed',
        multiplier: crashPoint,
        history: [crashPoint, ...prev.history].slice(0, 30),
      }));
      // Record session bet history
      setBet1(prev => {
        if (prev.placed && !prev.cashedOut) {
          setMyBets(mb => [{ round: crashPoint, stake: prev.stake, result: 'lost', payout: 0, time: new Date() }, ...mb].slice(0, 20));
        }
        return prev;
      });
      setBet2(prev => {
        if (prev.placed && !prev.cashedOut) {
          setMyBets(mb => [{ round: crashPoint, stake: prev.stake, result: 'lost', payout: 0, time: new Date() }, ...mb].slice(0, 20));
        }
        return prev;
      });
    });

    socket.on('crash:bet_placed', ({ username: uname, amount }) => {
      setGameState(prev => ({
        ...prev,
        bets: [...prev.bets, { username: uname, amount, cashedOut: false }],
      }));
    });

    socket.on('crash:cashed_out', ({ username: uname, multiplier: m, payout }) => {
      setGameState(prev => ({
        ...prev,
        bets: prev.bets.map(b =>
          b.username === uname ? { ...b, cashedOut: true, cashoutMultiplier: m } : b
        ),
      }));
      // If this is the current user being auto-cashed out by server
      if (uname === username) {
        setBet1(prev => {
          if (prev.placed && !prev.cashedOut && prev.autoCashoutEnabled) {
            setMyBets(mb => [{ round: m, stake: prev.stake, result: 'won', payout, time: new Date() }, ...mb].slice(0, 20));
            return { ...prev, cashedOut: true, won: true, lastPayout: payout };
          }
          return prev;
        });
        setBet2(prev => {
          if (prev.placed && !prev.cashedOut && prev.autoCashoutEnabled) {
            setMyBets(mb => [{ round: m, stake: prev.stake, result: 'won', payout, time: new Date() }, ...mb].slice(0, 20));
            return { ...prev, cashedOut: true, won: true, lastPayout: payout };
          }
          return prev;
        });
      }
    });

    return () => {
      socket.emit('crash:leave');
      socket.off('crash:state');
      socket.off('crash:waiting');
      socket.off('crash:start');
      socket.off('crash:tick');
      socket.off('crash:end');
      socket.off('crash:bet_placed');
      socket.off('crash:cashed_out');
    };
  }, [socket, username]);

  // Countdown timer
  useEffect(() => {
    if (gameState.status !== 'waiting' || countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [gameState.status, countdown]);

  // Manual cashout for bet1
  const handleCashout1 = useCallback(() => {
    if (!socket || !bet1.placed || bet1.cashedOut) return;
    socket.emit('crash:cashout', null, (res) => {
      if (res.error) return toast.error(res.error);
      setBet1(prev => ({ ...prev, cashedOut: true, won: true, lastPayout: res.payout }));
      setMyBets(mb => [{ round: res.multiplier, stake: bet1.stake, result: 'won', payout: res.payout, time: new Date() }, ...mb].slice(0, 20));
      toast.success(`Cashed out at ${res.multiplier}x! +₹${formatCurrency(res.payout)}`);
    });
  }, [socket, bet1]);

  // Manual cashout for bet2 — note: crash server only tracks 1 bet per socket
  // bet2 is a UX convenience that internally uses the same socket bet
  // (in real Aviator, 2 bets use 2 different bet slots server-side)
  // For our demo: bet2 cashout also calls crash:cashout
  const handleCashout2 = useCallback(() => {
    if (!socket || !bet2.placed || bet2.cashedOut) return;
    socket.emit('crash:cashout', null, (res) => {
      if (res.error) return toast.error(res.error);
      setBet2(prev => ({ ...prev, cashedOut: true, won: true, lastPayout: res.payout }));
      setMyBets(mb => [{ round: res.multiplier, stake: bet2.stake, result: 'won', payout: res.payout, time: new Date() }, ...mb].slice(0, 20));
      toast.success(`Bet 2 cashed out at ${res.multiplier}x! +₹${formatCurrency(res.payout)}`);
    });
  }, [socket, bet2]);

  return (
    <div className="aviator-full-page">
      {/* History Strip */}
      <div className="av-history-strip">
        <span className="av-history-label">History</span>
        <div className="av-history-chips">
          {gameState.history.length === 0 ? (
            <span className="av-history-empty">No rounds yet</span>
          ) : (
            gameState.history.map((pt, i) => (
              <span
                key={i}
                className="av-history-chip"
                style={{ background: getHistoryColor(pt) + '22', color: getHistoryColor(pt), borderColor: getHistoryColor(pt) + '55' }}
              >
                {pt.toFixed(2)}x
              </span>
            ))
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="av-canvas-wrapper">
        <AviatorCanvas
          status={gameState.status}
          multiplier={gameState.multiplier}
          countdown={countdown}
        />
      </div>

      {/* Two Bet Panels */}
      <div className="av-panels-row">
        <BetPanel
          panelId={1}
          bet={bet1}
          setBet={setBet1}
          gameStatus={gameState.status}
          socket={socket}
          countdown={countdown}
          user={user}
          onCashout={handleCashout1}
        />
        <BetPanel
          panelId={2}
          bet={bet2}
          setBet={setBet2}
          gameStatus={gameState.status}
          socket={socket}
          countdown={countdown}
          user={user}
          onCashout={handleCashout2}
        />
      </div>

      {/* Tabs: Players / My Bets */}
      <div className="av-tabs-section">
        <div className="av-tabs-header">
          <button
            className={`av-tab ${activeTab === 'players' ? 'active' : ''}`}
            onClick={() => setActiveTab('players')}
          >
            Players ({gameState.bets.length})
          </button>
          <button
            className={`av-tab ${activeTab === 'mybets' ? 'active' : ''}`}
            onClick={() => setActiveTab('mybets')}
          >
            My Bets ({myBets.length})
          </button>
        </div>

        <div className="av-tab-content">
          {activeTab === 'players' && (
            <div className="av-players-list">
              {gameState.bets.length === 0 ? (
                <div className="av-empty">No bets yet this round</div>
              ) : (
                gameState.bets.map((b, i) => (
                  <div key={i} className={`av-player-row ${b.cashedOut ? 'cashed' : ''}`}>
                    <span className="av-player-name">{b.username}</span>
                    <span className="av-player-stake">₹{formatCurrency(b.amount)}</span>
                    {b.cashedOut ? (
                      <span className="av-player-cashout">{b.cashoutMultiplier?.toFixed(2)}x ✓</span>
                    ) : (
                      <span className="av-player-status">In game</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'mybets' && (
            <div className="av-mybets-list">
              {myBets.length === 0 ? (
                <div className="av-empty">No bets yet this session</div>
              ) : (
                myBets.map((b, i) => (
                  <div key={i} className={`av-mybet-row ${b.result}`}>
                    <span className="av-mybet-round" style={{ color: getHistoryColor(b.round) }}>
                      {b.round.toFixed(2)}x
                    </span>
                    <span className="av-mybet-stake">₹{formatCurrency(b.stake)}</span>
                    <span className={`av-mybet-result ${b.result}`}>
                      {b.result === 'won' ? `+₹${formatCurrency(b.payout)}` : `-₹${formatCurrency(b.stake)}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .aviator-full-page {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        /* History Strip */
        .av-history-strip {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          overflow: hidden;
        }
        .av-history-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .av-history-chips {
          display: flex;
          gap: 0.35rem;
          overflow-x: auto;
          scrollbar-width: none;
          flex: 1;
        }
        .av-history-chips::-webkit-scrollbar { display: none; }
        .av-history-chip {
          font-size: 0.72rem;
          font-weight: 800;
          padding: 0.18rem 0.5rem;
          border-radius: 20px;
          border: 1px solid;
          white-space: nowrap;
          flex-shrink: 0;
          font-family: var(--font-mono);
          cursor: default;
        }
        .av-history-empty {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Canvas */
        .av-canvas-wrapper {
          height: 320px;
          border-left: 1px solid var(--border-color);
          border-right: 1px solid var(--border-color);
          background: #0a1628;
        }
        @media (min-width: 600px) {
          .av-canvas-wrapper { height: 380px; }
        }

        /* Bet Panels */
        .av-panels-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          border: 1px solid var(--border-color);
          border-top: none;
        }
        .av-bet-panel {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          background: var(--bg-card);
          position: relative;
          min-height: 160px;
        }
        .av-bet-panel:first-child {
          border-right: 1px solid var(--border-color);
        }
        .av-panel-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .av-stake-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
        }
        .av-stake-btn {
          padding: 0.25rem 0.45rem;
          font-size: 0.72rem;
          font-weight: 700;
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s;
        }
        .av-stake-btn.active, .av-stake-btn:hover {
          background: var(--accent-gold);
          color: #000;
          border-color: var(--accent-gold);
        }
        .av-auto-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .av-auto-label {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
          cursor: pointer;
          font-weight: 600;
        }
        .av-auto-label input[type=checkbox] {
          accent-color: var(--accent-gold);
          width: 14px;
          height: 14px;
        }
        .av-auto-input {
          width: 70px;
          padding: 0.2rem 0.4rem;
          border-radius: var(--radius);
          border: 1px solid var(--accent-gold);
          background: var(--bg-tertiary);
          color: var(--accent-gold);
          font-size: 0.78rem;
          font-weight: 700;
          font-family: var(--font-mono);
          text-align: center;
        }
        .av-action-btn {
          padding: 0.65rem 1rem;
          border-radius: var(--radius);
          border: none;
          font-weight: 800;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
          margin-top: auto;
        }
        .av-btn-sub {
          font-size: 0.65rem;
          font-weight: 600;
          opacity: 0.85;
        }
        .av-action-bet {
          background: linear-gradient(135deg, #ffd700, #e6a817);
          color: #000;
        }
        .av-action-bet:hover:not(:disabled) { transform: translateY(-1px); }
        .av-action-bet:disabled { opacity: 0.5; cursor: not-allowed; }
        .av-action-cashout {
          background: linear-gradient(135deg, #00e701, #00a801);
          color: #000;
          animation: av-cashout-pulse 1.2s ease-in-out infinite;
          font-size: 1rem;
        }
        .av-action-cashout:hover { transform: scale(1.02); }
        @keyframes av-cashout-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,231,1,0.3); }
          50% { box-shadow: 0 0 16px 4px rgba(0,231,1,0.2); }
        }
        .av-placed-info {
          text-align: center;
          padding: 0.25rem 0;
        }
        .av-placed-amount {
          font-size: 1.3rem;
          font-weight: 900;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }
        .av-placed-auto {
          font-size: 0.72rem;
          color: var(--accent-gold);
          font-weight: 600;
          margin-top: 0.15rem;
        }
        .av-waiting-msg, .av-spectate-msg {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 600;
          text-align: center;
          margin-top: auto;
        }
        .av-spectate-sub {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-align: center;
        }
        .av-result-won, .av-result-lost {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
          padding: 0.75rem 0;
          margin-top: auto;
        }
        .av-result-icon { font-size: 1.8rem; }
        .av-result-won .av-result-amount {
          font-size: 1.2rem;
          font-weight: 900;
          color: var(--accent-green);
          font-family: var(--font-mono);
        }
        .av-result-lost .av-result-amount {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--accent-red);
          font-family: var(--font-mono);
        }
        .av-panel-won { border-top: 2px solid var(--accent-green) !important; }
        .av-panel-lost { border-top: 2px solid var(--accent-red) !important; }
        .av-panel-active { border-top: 2px solid var(--accent-green) !important; }
        .av-panel-waiting { border-top: 2px solid var(--accent-gold) !important; }

        /* Tabs */
        .av-tabs-section {
          border: 1px solid var(--border-color);
          border-top: none;
          border-radius: 0 0 var(--radius-lg) var(--radius-lg);
          background: var(--bg-card);
          overflow: hidden;
        }
        .av-tabs-header {
          display: flex;
          border-bottom: 1px solid var(--border-color);
        }
        .av-tab {
          flex: 1;
          padding: 0.65rem;
          font-size: 0.8rem;
          font-weight: 700;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s;
          border-bottom: 2px solid transparent;
        }
        .av-tab.active {
          color: var(--accent-gold);
          border-bottom-color: var(--accent-gold);
          background: rgba(255, 215, 0, 0.04);
        }
        .av-tab-content {
          max-height: 220px;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .av-empty {
          text-align: center;
          padding: 1.5rem;
          color: var(--text-muted);
          font-size: 0.8rem;
        }
        .av-players-list, .av-mybets-list {
          display: flex;
          flex-direction: column;
        }
        .av-player-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 0.8rem;
          align-items: center;
          transition: background 0.15s;
        }
        .av-player-row:hover { background: rgba(255,255,255,0.02); }
        .av-player-row.cashed { background: rgba(0,231,1,0.03); }
        .av-player-name { color: var(--text-primary); font-weight: 600; }
        .av-player-stake { color: var(--text-muted); font-family: var(--font-mono); font-size: 0.75rem; }
        .av-player-cashout { color: var(--accent-green); font-weight: 700; font-family: var(--font-mono); font-size: 0.75rem; }
        .av-player-status { color: var(--text-muted); font-size: 0.72rem; }
        .av-mybet-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 0.8rem;
          align-items: center;
        }
        .av-mybet-round { font-weight: 800; font-family: var(--font-mono); }
        .av-mybet-stake { color: var(--text-muted); font-family: var(--font-mono); font-size: 0.75rem; }
        .av-mybet-result { font-weight: 700; font-family: var(--font-mono); font-size: 0.78rem; }
        .av-mybet-result.won { color: var(--accent-green); }
        .av-mybet-result.lost { color: var(--accent-red); }

        @media (max-width: 480px) {
          .av-panels-row { grid-template-columns: 1fr; }
          .av-bet-panel:first-child { border-right: none; border-bottom: 1px solid var(--border-color); }
          .av-canvas-wrapper { height: 260px; }
          .av-stake-btn { font-size: 0.68rem; padding: 0.22rem 0.35rem; }
        }
      `}</style>
    </div>
  );
}
