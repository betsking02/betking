import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

const CP_RULES = [
  'Each round lasts 60 seconds with a countdown timer.',
  'Place your bet on Red, Green, or Violet during the betting phase.',
  'Bets are locked when the timer reaches 0.',
  'A random winning color is revealed after betting closes.',
  'You can only bet on one color per round.',
  'Results are determined by the server and are provably fair.',
];

const CP_PAYOUTS = [
  { label: 'Red wins', value: '2x your bet' },
  { label: 'Green wins', value: '2x your bet' },
  { label: 'Violet wins', value: '4.5x your bet' },
  { label: 'Wrong color', value: 'Lose bet' },
];

/* ------------------------------------------------------------------ */
/*  Circular Countdown Timer (SVG)                                     */
/* ------------------------------------------------------------------ */
function CircularTimer({ secondsLeft, maxSeconds, status }) {
  const radius = 70;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;

  const fraction = maxSeconds > 0 ? secondsLeft / maxSeconds : 0;
  const strokeDashoffset = circumference * (1 - fraction);

  // Color transitions: green -> yellow -> red
  const timerColor = useMemo(() => {
    if (status === 'result') return '#ffd700';
    if (secondsLeft > 30) return '#00e701';
    if (secondsLeft > 10) return '#ffb800';
    return '#ff4444';
  }, [secondsLeft, status]);

  const isPulsing = secondsLeft <= 10 && status !== 'result';

  return (
    <div
      className="cp-circular-timer"
      style={{ animation: isPulsing ? 'cpTimerPulse 1s ease-in-out infinite' : 'none' }}
    >
      <svg width={radius * 2} height={radius * 2} viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
        {/* Background track */}
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        {/* Animated arc */}
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke={timerColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${radius} ${radius})`}
          style={{
            transition: 'stroke-dashoffset 0.95s linear, stroke 0.5s ease',
            filter: `drop-shadow(0 0 6px ${timerColor}80)`,
          }}
        />
      </svg>
      {/* Center number */}
      <div className="cp-timer-center" style={{ color: timerColor }}>
        {status === 'result' ? (
          <span className="cp-timer-emoji">&#127881;</span>
        ) : (
          <span className="cp-timer-number">{secondsLeft}</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Color Button                                                       */
/* ------------------------------------------------------------------ */
const COLOR_META = {
  red: {
    label: 'Red',
    gradient: 'linear-gradient(135deg, #ff416c 0%, #c0392b 100%)',
    payout: '2x PAYOUT',
    shadow: 'rgba(255,65,108,0.45)',
  },
  green: {
    label: 'Green',
    gradient: 'linear-gradient(135deg, #56ab2f 0%, #1e8449 100%)',
    payout: '2x PAYOUT',
    shadow: 'rgba(86,171,47,0.45)',
  },
  violet: {
    label: 'Violet',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)',
    payout: '4.5x PAYOUT',
    shadow: 'rgba(168,85,247,0.45)',
  },
};

function ColorButton({ color, selected, disabled, betCount, onClick }) {
  const meta = COLOR_META[color];

  return (
    <button
      className={`cp-color-btn ${selected ? 'cp-color-btn--selected' : ''} ${disabled ? 'cp-color-btn--disabled' : ''}`}
      style={{
        background: meta.gradient,
        boxShadow: selected
          ? `0 0 0 4px #ffd700, 0 4px 24px ${meta.shadow}`
          : `0 4px 16px ${meta.shadow}`,
        transform: selected ? 'scale(1.07)' : 'scale(1)',
      }}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="cp-color-btn__label">{meta.label}</span>
      <span className="cp-color-btn__payout">{meta.payout}</span>
      <span className="cp-color-btn__count">{betCount} bet{betCount !== 1 ? 's' : ''}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Result Reveal Overlay                                              */
/* ------------------------------------------------------------------ */
function ResultReveal({ color, visible }) {
  const meta = COLOR_META[color] || COLOR_META.red;
  if (!visible) return null;

  return (
    <div className="cp-result-overlay" key={color}>
      <div className="cp-result-expand" style={{ background: meta.gradient }}>
        <div className="cp-result-expand__text">
          {meta.label.toUpperCase()} WINS!
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                       */
/* ------------------------------------------------------------------ */
function StatusBadge({ status }) {
  const config = {
    betting: { text: 'BETTING OPEN', bg: 'rgba(0,231,1,0.15)', color: '#00e701', border: '#00e701' },
    locked: { text: 'BETS LOCKED', bg: 'rgba(255,68,68,0.15)', color: '#ff4444', border: '#ff4444' },
    result: { text: 'RESULT', bg: 'rgba(255,215,0,0.15)', color: '#ffd700', border: '#ffd700' },
  };
  const c = config[status] || config.betting;

  return (
    <div
      className="cp-status-badge"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      <span className="cp-status-dot" style={{ background: c.color }} />
      {c.text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  History Dots                                                       */
/* ------------------------------------------------------------------ */
function HistoryDots({ history }) {
  const dotColors = { red: '#e74c3c', green: '#27ae60', violet: '#8e44ad' };

  return (
    <div className="cp-history">
      {history.map((h, i) => (
        <div
          key={i}
          className="cp-history-dot"
          title={h.color}
          style={{
            background: dotColors[h.color] || '#555',
            width: i === 0 ? 28 : 20,
            height: i === 0 ? 28 : 20,
            boxShadow: i === 0 ? `0 0 8px ${dotColors[h.color]}90` : 'none',
          }}
        />
      ))}
      {history.length === 0 && (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No rounds yet</span>
      )}
    </div>
  );
}

/* ================================================================== */
/*  MAIN PAGE COMPONENT                                                */
/* ================================================================== */
export default function ColorPredictionPage() {
  const { user } = useContext(AuthContext);
  const socket = useSocket();

  const MAX_SECONDS = 60; // default countdown total

  const [gameState, setGameState] = useState({
    status: 'betting',
    secondsLeft: MAX_SECONDS,
    history: [],
    betCounts: { red: 0, green: 0, violet: 0 },
    roundNumber: 0,
  });
  const [stake, setStake] = useState(100);
  const [selectedColor, setSelectedColor] = useState(null);
  const [hasBet, setHasBet] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [showReveal, setShowReveal] = useState(false);

  /* ---- socket wiring (unchanged logic) ---- */
  useEffect(() => {
    if (!socket) return;
    socket.emit('color:join');

    socket.on('color:state', (state) => setGameState(state));

    socket.on('color:new_round', ({ countdown, roundNumber }) => {
      setGameState((prev) => ({
        ...prev,
        status: 'betting',
        secondsLeft: countdown,
        roundNumber: roundNumber ?? prev.roundNumber + 1,
      }));
      setHasBet(false);
      setSelectedColor(null);
      setLastResult(null);
      setShowReveal(false);
    });

    socket.on('color:tick', ({ secondsLeft, status }) => {
      setGameState((prev) => ({ ...prev, secondsLeft, status }));
    });

    socket.on('color:locked', () => {
      setGameState((prev) => ({ ...prev, status: 'locked' }));
    });

    socket.on('color:result', ({ color, winners }) => {
      setGameState((prev) => ({
        ...prev,
        status: 'result',
        history: [{ color }, ...prev.history].slice(0, 20),
      }));
      setLastResult(color);
      setShowReveal(true);

      const myWin = winners.find((w) => w.userId === user?.id);
      if (myWin) toast.success(`You won ${formatCurrency(myWin.payout)}!`);
      else if (hasBet) toast.error(`${color.toUpperCase()} wins!`);
    });

    socket.on('color:bets_count', (counts) => {
      setGameState((prev) => ({ ...prev, betCounts: counts }));
    });

    return () => {
      socket.emit('color:leave');
      socket.off('color:state');
      socket.off('color:new_round');
      socket.off('color:tick');
      socket.off('color:locked');
      socket.off('color:result');
      socket.off('color:bets_count');
    };
  }, [socket, user, hasBet]);

  /* ---- place bet ---- */
  const placeBet = useCallback(() => {
    if (!socket || !user) return toast.error('Please login');
    if (!selectedColor) return toast.error('Select a color');
    socket.emit('color:place_bet', { color: selectedColor, amount: stake }, (res) => {
      if (res.error) return toast.error(res.error);
      setHasBet(true);
      toast.success(`Bet ${formatCurrency(stake)} on ${selectedColor}`);
    });
  }, [socket, user, selectedColor, stake]);

  const isBettingOpen = gameState.status === 'betting';
  const isLocked = gameState.status === 'locked';
  const isResult = gameState.status === 'result';
  const buttonsDisabled = hasBet || !isBettingOpen;

  /* ================================================================ */
  /*  INLINE STYLES (scoped to this component)                         */
  /* ================================================================ */
  const styles = `
    /* ---- wrapper ---- */
    .cp-page { max-width: 620px; margin: 0 auto; }
    .cp-page h1 {
      font-size: 1.5rem;
      margin-bottom: 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* ---- round info row ---- */
    .cp-round-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .cp-round-number {
      font-size: 0.85rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
      letter-spacing: 0.5px;
    }

    /* ---- status badge ---- */
    .cp-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 14px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .cp-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      animation: cpDotBlink 1.2s ease-in-out infinite;
    }

    /* ---- card ---- */
    .cp-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 2rem 1.5rem 1.5rem;
      position: relative;
      overflow: hidden;
    }

    /* ---- circular timer ---- */
    .cp-circular-timer {
      position: relative;
      width: 140px;
      height: 140px;
      margin: 0 auto 1.5rem;
    }
    .cp-timer-center {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cp-timer-number {
      font-size: 2.75rem;
      font-weight: 900;
      font-family: var(--font-mono);
      line-height: 1;
    }
    .cp-timer-emoji {
      font-size: 2.5rem;
      line-height: 1;
    }

    /* ---- color buttons ---- */
    .cp-color-buttons {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .cp-color-btn {
      position: relative;
      border: none;
      border-radius: 16px;
      padding: 1.75rem 0.75rem 1.25rem;
      cursor: pointer;
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      transition: transform 0.25s cubic-bezier(.4,0,.2,1), box-shadow 0.25s ease;
    }
    .cp-color-btn:hover:not(:disabled) {
      transform: scale(1.04) !important;
    }
    .cp-color-btn--disabled {
      opacity: 0.55;
      cursor: not-allowed;
      filter: saturate(0.6);
    }
    .cp-color-btn--selected {
      border: none;
    }
    .cp-color-btn__label {
      font-size: 1.35rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .cp-color-btn__payout {
      font-size: 0.7rem;
      font-weight: 700;
      opacity: 0.85;
      letter-spacing: 0.5px;
    }
    .cp-color-btn__count {
      font-size: 0.68rem;
      opacity: 0.7;
      margin-top: 2px;
    }

    /* ---- bet controls ---- */
    .cp-bet-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .cp-stake-row {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .cp-stake-btn {
      padding: 6px 14px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.82rem;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.2s;
      background: var(--bg-tertiary);
      color: var(--text-secondary);
    }
    .cp-stake-btn--active {
      background: var(--accent-blue);
      color: #fff;
      border-color: var(--accent-blue);
    }
    .cp-place-btn {
      width: 100%;
      padding: 14px 24px;
      border: none;
      border-radius: 12px;
      font-size: 1.05rem;
      font-weight: 800;
      cursor: pointer;
      background: linear-gradient(135deg, #1da1f2, #0d8de0);
      color: #fff;
      letter-spacing: 0.5px;
      transition: all 0.2s;
      box-shadow: 0 4px 16px rgba(29,161,242,0.35);
    }
    .cp-place-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(29,161,242,0.45);
    }
    .cp-place-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ---- waiting / locked messages ---- */
    .cp-message {
      text-align: center;
      padding: 0.75rem;
      font-weight: 700;
      font-size: 0.9rem;
      border-radius: 10px;
    }
    .cp-message--bet {
      color: var(--accent-green);
      background: rgba(0,231,1,0.08);
    }
    .cp-message--locked {
      color: var(--text-muted);
      background: rgba(255,255,255,0.03);
    }

    /* ---- result reveal overlay ---- */
    .cp-result-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      pointer-events: none;
      animation: cpFadeIn 0.3s ease forwards;
    }
    .cp-result-expand {
      width: 0;
      height: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: cpExpandCircle 0.7s cubic-bezier(.17,.67,.35,1.2) forwards;
    }
    .cp-result-expand__text {
      font-size: 1.8rem;
      font-weight: 900;
      color: #fff;
      text-shadow: 0 2px 12px rgba(0,0,0,0.5);
      opacity: 0;
      animation: cpTextPop 0.4s ease forwards 0.5s;
      letter-spacing: 2px;
      white-space: nowrap;
    }

    /* ---- history ---- */
    .cp-history-section {
      margin-top: 1.5rem;
    }
    .cp-history-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .cp-history {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .cp-history-dot {
      border-radius: 50%;
      transition: all 0.3s ease;
    }

    /* ---- keyframes ---- */
    @keyframes cpTimerPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.06); }
    }
    @keyframes cpDotBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    @keyframes cpFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes cpExpandCircle {
      0%   { width: 0; height: 0; border-radius: 50%; }
      100% { width: 110%; height: 110%; border-radius: 16px; }
    }
    @keyframes cpTextPop {
      0%   { opacity: 0; transform: scale(0.5); }
      100% { opacity: 1; transform: scale(1); }
    }

    /* ---- responsive ---- */
    @media (max-width: 480px) {
      .cp-card { padding: 1.25rem 1rem 1rem; }
      .cp-circular-timer { width: 110px; height: 110px; }
      .cp-circular-timer svg { width: 110px; height: 110px; }
      .cp-timer-number { font-size: 2rem; }
      .cp-color-btn { padding: 1.25rem 0.5rem 1rem; border-radius: 12px; }
      .cp-color-btn__label { font-size: 1.1rem; }
      .cp-result-expand__text { font-size: 1.3rem; }
    }
  `;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="casino-game-page">
      <GameRulesModal
        gameKey="colorprediction"
        title="How to Play Color Prediction"
        rules={CP_RULES}
        payouts={CP_PAYOUTS}
      />
      <style>{styles}</style>

      <div className="cp-page">
        <h1>Color Prediction</h1>

        {/* Round info + status */}
        <div className="cp-round-row">
          <span className="cp-round-number">
            Round #{gameState.roundNumber || '--'}
          </span>
          <StatusBadge status={gameState.status} />
        </div>

        {/* Main card */}
        <div className="cp-card">
          {/* Reveal overlay */}
          <ResultReveal color={lastResult} visible={showReveal && isResult} />

          {/* Circular timer */}
          <CircularTimer
            secondsLeft={gameState.secondsLeft}
            maxSeconds={MAX_SECONDS}
            status={gameState.status}
          />

          {/* Color choice buttons */}
          <div className="cp-color-buttons">
            {['red', 'green', 'violet'].map((color) => (
              <ColorButton
                key={color}
                color={color}
                selected={selectedColor === color}
                disabled={buttonsDisabled}
                betCount={gameState.betCounts?.[color] ?? 0}
                onClick={() => {
                  if (!buttonsDisabled) setSelectedColor(color);
                }}
              />
            ))}
          </div>

          {/* Bet controls (visible only when betting is open and user hasn't bet) */}
          {!hasBet && isBettingOpen && (
            <div className="cp-bet-controls">
              <div className="cp-stake-row">
                {BET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    className={`cp-stake-btn ${stake === amt ? 'cp-stake-btn--active' : ''}`}
                    onClick={() => setStake(amt)}
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>
              <button
                className="cp-place-btn"
                onClick={placeBet}
                disabled={!selectedColor || !user}
              >
                PLACE BET ({formatCurrency(stake)})
              </button>
            </div>
          )}

          {/* Post-bet message */}
          {hasBet && !isResult && (
            <div className="cp-message cp-message--bet">
              Bet placed! Waiting for result...
            </div>
          )}

          {/* Locked message for non-bettors */}
          {isLocked && !hasBet && (
            <div className="cp-message cp-message--locked">
              Betting closed for this round
            </div>
          )}
        </div>

        {/* History section */}
        <div className="cp-history-section">
          <div className="cp-history-title">Recent Results</div>
          <HistoryDots history={gameState.history} />
        </div>
      </div>
    </div>
  );
}
