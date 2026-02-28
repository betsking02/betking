import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import AviatorCanvas from '../components/casino/AviatorCanvas';
import GameRulesModal from '../components/common/GameRulesModal';
import toast from 'react-hot-toast';
import './CasinoGame.css';

const CRASH_RULES = [
  'Place your bet during the WAITING phase before the round starts.',
  'A multiplier starts at 1.00x and increases rapidly.',
  'Click CASH OUT before the plane crashes to lock in your winnings.',
  'If the plane crashes before you cash out, you lose your bet.',
  'The crash point is random and provably fair.',
  'The multiplier can crash at any time - even at 1.00x!',
  'Your payout = Bet Amount x Multiplier at cash out.',
];

const CRASH_PAYOUTS = [
  { label: 'Cash out at 2x', value: '2x your bet' },
  { label: 'Cash out at 5x', value: '5x your bet' },
  { label: 'Cash out at 10x', value: '10x your bet' },
  { label: 'Cash out at 50x', value: '50x your bet' },
  { label: 'Cash out at 100x', value: '100x your bet' },
  { label: 'Crash before cash out', value: 'Lose bet' },
];

export default function CrashGamePage() {
  const { user } = useContext(AuthContext);
  const socket = useSocket();
  const [gameState, setGameState] = useState({ status: 'waiting', multiplier: 1.00, history: [], bets: [] });
  const [stake, setStake] = useState(100);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!socket) return;

    socket.emit('crash:join');

    socket.on('crash:state', (state) => setGameState(state));
    socket.on('crash:waiting', ({ countdown }) => {
      setGameState(prev => ({ ...prev, status: 'waiting', multiplier: 1.00, bets: [] }));
      setHasBet(false);
      setCashedOut(false);
      setCountdown(countdown);
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
        history: [crashPoint, ...prev.history].slice(0, 20)
      }));
    });
    socket.on('crash:bet_placed', ({ username, amount }) => {
      setGameState(prev => ({
        ...prev,
        bets: [...prev.bets, { username, amount, cashedOut: false }]
      }));
    });
    socket.on('crash:cashed_out', ({ username, multiplier, payout }) => {
      setGameState(prev => ({
        ...prev,
        bets: prev.bets.map(b => b.username === username ? { ...b, cashedOut: true, cashoutMultiplier: multiplier } : b)
      }));
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
  }, [socket]);

  // Countdown timer
  useEffect(() => {
    if (gameState.status !== 'waiting' || countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [gameState.status, countdown]);

  const placeBet = useCallback(() => {
    if (!socket || !user) return toast.error('Please login first');
    socket.emit('crash:place_bet', { amount: stake }, (res) => {
      if (res.error) return toast.error(res.error);
      setHasBet(true);
      toast.success('Bet placed!');
    });
  }, [socket, user, stake]);

  const cashOut = useCallback(() => {
    if (!socket) return;
    socket.emit('crash:cashout', null, (res) => {
      if (res.error) return toast.error(res.error);
      setCashedOut(true);
      toast.success(`Cashed out at ${res.multiplier}x! Won ₹${formatCurrency(res.payout)}`);
    });
  }, [socket]);

  const getHistoryClass = (point) => {
    if (point < 2) return 'low';
    if (point < 5) return 'mid';
    return 'high';
  };

  return (
    <div className="casino-game-page aviator-page">
      <GameRulesModal
        gameKey="crash"
        title="How to Play Crash (Aviator)"
        rules={CRASH_RULES}
        payouts={CRASH_PAYOUTS}
      />
      <h1>✈️ Aviator Crash</h1>
      <div className="crash-container">
        <div className="aviator-chart-area">
          {/* Canvas Animation */}
          <div className="aviator-canvas-wrapper">
            <AviatorCanvas
              status={gameState.status}
              multiplier={gameState.multiplier}
              countdown={countdown}
            />
          </div>

          {/* Controls overlay at bottom */}
          <div className="aviator-controls">
            {gameState.status === 'waiting' && !hasBet && (
              <div className="aviator-bet-panel">
                <div className="stake-buttons">
                  {BET_AMOUNTS.map(amt => (
                    <button key={amt} className={`btn btn-sm ${stake === amt ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setStake(amt)}>₹{formatCurrency(amt)}</button>
                  ))}
                </div>
                <button className="btn btn-primary btn-lg w-full" onClick={placeBet} disabled={!user}>
                  ✈️ BET ₹{formatCurrency(stake)}
                </button>
              </div>
            )}
            {gameState.status === 'waiting' && hasBet && (
              <div className="aviator-info-msg">✈️ Bet placed! Waiting for takeoff...</div>
            )}
            {gameState.status === 'running' && hasBet && !cashedOut && (
              <button className="aviator-cashout-btn" onClick={cashOut}>
                💰 CASH OUT ₹{formatCurrency(Math.round(stake * gameState.multiplier))}
              </button>
            )}
            {gameState.status === 'running' && !hasBet && (
              <div className="aviator-info-msg">✈️ In flight... Place bet in next round</div>
            )}
            {cashedOut && (
              <div className="aviator-info-msg" style={{ color: 'var(--accent-green)' }}>✅ Cashed out successfully!</div>
            )}
            {gameState.status === 'crashed' && (
              <div className="aviator-info-msg" style={{ color: 'var(--text-muted)' }}>Next round starting soon...</div>
            )}
          </div>
        </div>

        <div className="crash-sidebar">
          <h3 style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>🕐 History</h3>
          <div className="crash-history">
            {gameState.history.map((point, i) => (
              <span key={i} className={`crash-history-item ${getHistoryClass(point)}`}>
                {point.toFixed(2)}x
              </span>
            ))}
            {gameState.history.length === 0 && (
              <span className="text-muted text-xs">No history yet</span>
            )}
          </div>

          <h3 style={{ fontSize: '0.85rem', margin: '1rem 0 0.5rem' }}>👥 Players ({gameState.bets.length})</h3>
          <div className="crash-players">
            {gameState.bets.map((bet, i) => (
              <div key={i} className="crash-player">
                <span>{bet.username}</span>
                <span>
                  {bet.cashedOut
                    ? <span className="text-green">{bet.cashoutMultiplier?.toFixed(2)}x ✓</span>
                    : <span className="text-muted">₹{formatCurrency(bet.amount)}</span>
                  }
                </span>
              </div>
            ))}
            {gameState.bets.length === 0 && (
              <div className="text-muted text-xs" style={{ padding: '0.5rem 0' }}>No bets yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
