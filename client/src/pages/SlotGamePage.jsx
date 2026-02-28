import { useState, useContext, useRef, useEffect, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { spinSlots } from '../api/casino';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import './CasinoGame.css';
import GameRulesModal from '../components/common/GameRulesModal';

/* ── Symbol Map ─────────────────────────────────────────────── */
const SYMBOLS = {
  '7':       { emoji: '7\uFE0F\u20E3', label: 'Seven',   color: '#ff4444' },
  'BAR':     { emoji: '\uD83C\uDD71\uFE0F', label: 'Bar',     color: '#9b59b6' },
  'CHERRY':  { emoji: '\uD83C\uDF52', label: 'Cherry',  color: '#e74c3c' },
  'BELL':    { emoji: '\uD83D\uDD14', label: 'Bell',    color: '#f39c12' },
  'LEMON':   { emoji: '\uD83C\uDF4B', label: 'Lemon',   color: '#f1c40f' },
  'ORANGE':  { emoji: '\uD83C\uDF4A', label: 'Orange',  color: '#e67e22' },
  'PLUM':    { emoji: '\uD83E\uDED0', label: 'Plum',    color: '#8e44ad' },
  'GRAPE':   { emoji: '\uD83C\uDF47', label: 'Grape',   color: '#6c3483' },
  'WILD':    { emoji: '\u2B50',       label: 'Wild',    color: '#ffd700' },
  'SCATTER': { emoji: '\uD83D\uDC8E', label: 'Scatter', color: '#3498db' },
};

const ALL_SYMBOL_KEYS = Object.keys(SYMBOLS);

/* ── Helpers ────────────────────────────────────────────────── */
const randomSymbolKey = () => ALL_SYMBOL_KEYS[Math.floor(Math.random() * ALL_SYMBOL_KEYS.length)];

const generateRandomGrid = () =>
  Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => randomSymbolKey()));

/* ── Inline Styles (scoped via JS, no extra CSS file needed) ─ */
const S = {
  /* ---- page wrapper ---- */
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '1rem',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    textAlign: 'center',
    marginBottom: '1.25rem',
    background: 'linear-gradient(90deg,#ffd700,#ffaa00)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  /* ---- machine frame ---- */
  machineOuter: {
    background: 'linear-gradient(180deg,#2a1a0e 0%,#1a0e06 100%)',
    borderRadius: 24,
    padding: '6px',
    boxShadow: '0 0 40px rgba(255,215,0,0.15), inset 0 0 60px rgba(0,0,0,0.6)',
    border: '3px solid #5a3a1a',
    position: 'relative',
    overflow: 'hidden',
  },
  machineInner: {
    background: 'linear-gradient(180deg,#1a2c38 0%,#0f1923 100%)',
    borderRadius: 20,
    padding: '1.5rem 1.25rem 1.25rem',
    position: 'relative',
  },
  machineLabel: {
    textAlign: 'center',
    fontSize: '2rem',
    fontWeight: 900,
    letterSpacing: 4,
    marginBottom: 8,
    background: 'linear-gradient(90deg,#ffd700,#ff6b00,#ffd700)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: 'none',
    textTransform: 'uppercase',
    fontFamily: "'Inter', sans-serif",
  },
  machineSublabel: {
    textAlign: 'center',
    fontSize: '0.7rem',
    color: '#7a8a9e',
    letterSpacing: 3,
    marginBottom: 18,
    textTransform: 'uppercase',
  },

  /* ---- top bar (balance) ---- */
  topBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceBadge: {
    background: 'linear-gradient(135deg,#1a2c38,#213743)',
    border: '1px solid #2a3a4a',
    borderRadius: 10,
    padding: '6px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    fontSize: '0.7rem',
    color: '#7a8a9e',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceValue: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#ffd700',
    fontFamily: "'JetBrains Mono','Courier New',monospace",
  },

  /* ---- reel area ---- */
  reelFrame: {
    background: '#0b1219',
    borderRadius: 14,
    padding: '14px 10px',
    border: '2px solid #2a3a4a',
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  reelGrid: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
  reel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    position: 'relative',
  },
  cell: (isWinning) => ({
    width: 86,
    height: 86,
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    transition: 'all 0.35s ease',
    border: isWinning ? '2px solid #ffd700' : '2px solid #1e2d3a',
    boxShadow: isWinning
      ? '0 0 18px rgba(255,215,0,0.5), inset 0 0 12px rgba(255,215,0,0.15)'
      : '0 2px 6px rgba(0,0,0,0.3)',
    background: isWinning
      ? 'linear-gradient(135deg,rgba(255,215,0,0.08),rgba(255,165,0,0.06))'
      : 'linear-gradient(135deg,#152230,#1a2c38)',
    cursor: 'default',
  }),
  symbolCircle: (color) => ({
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: `radial-gradient(circle at 35% 35%, ${color}44, ${color}22)`,
    border: `2px solid ${color}66`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.7rem',
    lineHeight: 1,
  }),
  symbolLabel: (color) => ({
    fontSize: '0.55rem',
    fontWeight: 700,
    color: color,
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.85,
  }),
  cellSpinning: {
    width: 86,
    height: 86,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #1e2d3a',
    background: 'linear-gradient(135deg,#152230,#1a2c38)',
    overflow: 'hidden',
    position: 'relative',
  },

  /* ---- pay-line indicator dots ---- */
  paylineRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  paylineDot: (active) => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: active ? '#ffd700' : '#2a3a4a',
    transition: 'background 0.3s',
  }),

  /* ---- win display ---- */
  winOverlay: {
    textAlign: 'center',
    padding: '14px 10px',
    marginBottom: 10,
    borderRadius: 12,
    background: 'linear-gradient(135deg,rgba(255,215,0,0.08),rgba(255,165,0,0.04))',
    border: '1px solid rgba(255,215,0,0.25)',
    position: 'relative',
    overflow: 'hidden',
  },
  winLabel: {
    fontSize: '0.7rem',
    color: '#7a8a9e',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 2,
  },
  winAmount: {
    fontSize: '2rem',
    fontWeight: 900,
    background: 'linear-gradient(90deg,#ffd700,#ff6b00)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontFamily: "'JetBrains Mono','Courier New',monospace",
  },
  winMult: {
    fontSize: '0.8rem',
    color: '#00e701',
    fontWeight: 700,
    marginTop: 2,
  },

  /* ---- sparkles (confetti particles) ---- */
  sparkleContainer: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  sparkle: (i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.6;
    const dur = 1.2 + Math.random() * 0.8;
    const size = 4 + Math.random() * 5;
    const colors = ['#ffd700', '#ff6b00', '#00e701', '#ff4444', '#1da1f2', '#9b59b6'];
    const color = colors[i % colors.length];
    return {
      position: 'absolute',
      left: `${left}%`,
      top: '-8px',
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      opacity: 0,
      animation: `sparkle-fall ${dur}s ease-in ${delay}s forwards`,
    };
  },

  /* ---- controls ---- */
  controlsArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  stakeSection: {
    textAlign: 'center',
  },
  stakeLabel: {
    display: 'block',
    fontSize: '0.7rem',
    color: '#7a8a9e',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  stakeBtns: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  stakeBtn: (active) => ({
    padding: '7px 14px',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: '0.78rem',
    cursor: 'pointer',
    border: 'none',
    background: active
      ? 'linear-gradient(135deg,#00e701,#00c901)'
      : '#213743',
    color: active ? '#000' : '#b1bad3',
    transition: 'all 0.2s',
    boxShadow: active ? '0 0 12px rgba(0,231,1,0.25)' : 'none',
  }),

  /* ---- spin button ---- */
  spinBtnWrapper: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinBtn: (disabled, spinning) => ({
    minWidth: 230,
    padding: '16px 36px',
    borderRadius: 14,
    fontWeight: 900,
    fontSize: '1.1rem',
    letterSpacing: 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    textTransform: 'uppercase',
    background: spinning
      ? 'linear-gradient(135deg,#ff6b00,#ff4444)'
      : 'linear-gradient(135deg,#00e701,#00c901)',
    color: spinning ? '#fff' : '#000',
    opacity: disabled && !spinning ? 0.5 : 1,
    transition: 'all 0.25s',
    boxShadow: spinning
      ? '0 0 30px rgba(255,107,0,0.4), 0 0 60px rgba(255,68,68,0.15)'
      : '0 0 30px rgba(0,231,1,0.3), 0 0 60px rgba(0,231,1,0.1)',
    position: 'relative',
    zIndex: 1,
  }),
  spinBtnGlow: (spinning) => ({
    position: 'absolute',
    inset: -4,
    borderRadius: 18,
    background: spinning
      ? 'linear-gradient(135deg,#ff6b00,#ff4444)'
      : 'linear-gradient(135deg,#00e701,#00c901)',
    opacity: 0.25,
    filter: 'blur(12px)',
    zIndex: 0,
    animation: 'neon-pulse 2s ease-in-out infinite',
  }),

  /* ---- history thumbnails ---- */
  historySection: {
    marginTop: 18,
  },
  historyLabel: {
    fontSize: '0.7rem',
    color: '#7a8a9e',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  historyList: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  historyCard: (isWin) => ({
    background: '#152230',
    border: `1px solid ${isWin ? 'rgba(0,231,1,0.3)' : '#2a3a4a'}`,
    borderRadius: 10,
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    minWidth: 78,
  }),
  historyMiniGrid: {
    display: 'flex',
    gap: 2,
  },
  historyMiniReel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  historyMiniCell: (color) => ({
    width: 11,
    height: 11,
    borderRadius: 3,
    background: color ? `${color}44` : '#213743',
    border: `1px solid ${color ? `${color}66` : '#2a3a4a'}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.35rem',
    lineHeight: 1,
  }),
  historyWinLabel: (isWin) => ({
    fontSize: '0.6rem',
    fontWeight: 700,
    color: isWin ? '#00e701' : '#7a8a9e',
    fontFamily: "'JetBrains Mono','Courier New',monospace",
  }),

  /* ---- light bulbs decoration ---- */
  bulbRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 6,
  },
  bulb: (on, idx) => {
    const colors = ['#ff4444', '#ffd700', '#00e701', '#1da1f2', '#ff6b00'];
    const c = colors[idx % colors.length];
    return {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: on ? c : '#2a3a4a',
      boxShadow: on ? `0 0 6px ${c}, 0 0 12px ${c}44` : 'none',
      transition: 'all 0.4s',
    };
  },
};

/* ── Keyframe injection (once) ────────────────────────────── */
const KEYFRAMES_ID = 'slot-enhanced-keyframes';
function injectKeyframes() {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes sparkle-fall {
      0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(320px) rotate(360deg); opacity: 0; }
    }
    @keyframes neon-pulse {
      0%, 100% { opacity: 0.20; }
      50%      { opacity: 0.40; }
    }
    @keyframes reel-blur-cascade {
      0%   { transform: translateY(-30px); opacity: 0.3; filter: blur(4px); }
      50%  { transform: translateY(0); opacity: 0.8; filter: blur(2px); }
      100% { transform: translateY(30px); opacity: 0.3; filter: blur(4px); }
    }
    @keyframes cell-land {
      0%   { transform: scale(0.7) translateY(-12px); opacity: 0; }
      60%  { transform: scale(1.08) translateY(2px); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes win-glow-pulse {
      0%, 100% { box-shadow: 0 0 18px rgba(255,215,0,0.3); }
      50%      { box-shadow: 0 0 36px rgba(255,215,0,0.55); }
    }
    @keyframes bulb-chase {
      0%, 49%  { opacity: 1; }
      50%, 100% { opacity: 0.2; }
    }
  `;
  document.head.appendChild(style);
}

/* ── Spinning reel cell ─────────────────────────────────────── */
function SpinningCell({ reelIndex }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 80);
    return () => clearInterval(iv);
  }, []);

  const key = ALL_SYMBOL_KEYS[(tick + reelIndex * 3) % ALL_SYMBOL_KEYS.length];
  const sym = SYMBOLS[key];

  return (
    <div style={{
      ...S.cellSpinning,
      animation: `reel-blur-cascade 0.25s linear infinite`,
    }}>
      <div style={{ ...S.symbolCircle(sym.color), opacity: 0.5, filter: 'blur(2px)' }}>
        <span>{sym.emoji}</span>
      </div>
    </div>
  );
}

const SLOT_RULES = [
  'Click SPIN to spin all 5 reels.',
  'Matching symbols on a payline from left to right wins.',
  'WILD symbol substitutes for any symbol except SCATTER.',
  'SCATTER wins are based on total bet, not per-line bet.',
  '3+ SCATTER symbols anywhere on the grid trigger bonus payouts.',
  'Bet is divided equally across all 5 active paylines.',
];

const SLOT_PAYOUTS = [
  { label: '5x Seven (7)', value: '500x' },
  { label: '5x WILD', value: '250x' },
  { label: '5x BAR', value: '200x' },
  { label: '5x CHERRY', value: '100x' },
  { label: '5x BELL', value: '75x' },
  { label: '3x Seven (7)', value: '50x' },
  { label: '3x WILD', value: '25x' },
  { label: '3x BAR', value: '20x' },
  { label: '3x CHERRY', value: '10x' },
  { label: '3x BELL', value: '5x' },
  { label: '3x Fruit (Lemon/Orange/Plum/Grape)', value: '2x' },
  { label: '5x SCATTER', value: '50x total bet' },
  { label: '4x SCATTER', value: '20x total bet' },
  { label: '3x SCATTER', value: '5x total bet' },
];

/* ── Main Component ─────────────────────────────────────────── */
export default function SlotGamePage() {
  const { user, updateBalance } = useContext(AuthContext);
  const [stake, setStake] = useState(100);
  const [result, setResult] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [reelsStopped, setReelsStopped] = useState([false, false, false, false, false]);
  const [displayGrid, setDisplayGrid] = useState(null);
  const [showWin, setShowWin] = useState(false);
  const [history, setHistory] = useState([]);
  const [bulbPhase, setBulbPhase] = useState(0);
  const pendingResult = useRef(null);

  /* inject keyframes on mount */
  useEffect(() => {
    injectKeyframes();
  }, []);

  /* light bulb animation */
  useEffect(() => {
    const iv = setInterval(() => setBulbPhase((p) => p + 1), 500);
    return () => clearInterval(iv);
  }, []);

  /* stagger reel stops */
  const stopReelsSequentially = useCallback((grid) => {
    setReelsStopped([false, false, false, false, false]);
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        setReelsStopped((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
        /* update display grid column by column */
        setDisplayGrid((prev) => {
          const g = prev ? prev.map((c) => [...c]) : generateRandomGrid();
          g[i] = grid[i];
          return g;
        });
      }, 400 + i * 300);
    }
  }, []);

  /* ── spin handler ── */
  const handleSpin = async () => {
    if (!user) return toast.error('Please login first');
    if (stake > user.balance) return toast.error('Insufficient balance');

    setSpinning(true);
    setShowWin(false);
    setResult(null);
    setDisplayGrid(generateRandomGrid());
    setReelsStopped([false, false, false, false, false]);

    try {
      const res = await spinSlots(stake);
      const gameResult = res.data.gameResult;
      pendingResult.current = { gameResult, balance: res.data.balance, payout: res.data.payout };

      /* begin staggered stop */
      stopReelsSequentially(gameResult.grid);

      /* after all reels land */
      setTimeout(() => {
        setResult(gameResult);
        updateBalance(res.data.balance);
        setSpinning(false);

        if (res.data.payout > 0) {
          setShowWin(true);
          toast.success(`You won \u20B9${formatCurrency(res.data.payout)}!`);
        }

        /* add to history (max 5) */
        setHistory((prev) => [
          { grid: gameResult.grid, totalWin: gameResult.totalWin, wins: gameResult.wins },
          ...prev,
        ].slice(0, 5));
      }, 400 + 5 * 300 + 200);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Spin failed');
      setSpinning(false);
    }
  };

  /* ── win-line check ── */
  const isCellWinning = (colIdx, rowIdx) => {
    if (!result || !result.wins || result.wins.length === 0) return false;
    return result.wins.some(
      (w) => w.line >= 0 && result.paylines && result.paylines[w.line]?.[colIdx] === rowIdx
    );
  };

  /* ── render grid ── */
  const renderGrid = () => {
    if (spinning || displayGrid) {
      /* during spin or stagger */
      const grid = displayGrid || generateRandomGrid();
      return grid.map((col, ci) => (
        <div key={ci} style={S.reel}>
          {col.map((sym, ri) => {
            const stopped = reelsStopped[ci];
            if (!stopped && spinning) {
              return <SpinningCell key={ri} reelIndex={ci} />;
            }
            const info = SYMBOLS[sym] || SYMBOLS['CHERRY'];
            const winning = result ? isCellWinning(ci, ri) : false;
            return (
              <div
                key={ri}
                style={{
                  ...S.cell(winning),
                  animation: stopped ? `cell-land 0.35s ease-out forwards` : undefined,
                  ...(winning ? { animation: 'win-glow-pulse 1s ease-in-out infinite' } : {}),
                }}
              >
                <div style={S.symbolCircle(info.color)}>
                  <span>{info.emoji}</span>
                </div>
                <span style={S.symbolLabel(info.color)}>{info.label}</span>
              </div>
            );
          })}
        </div>
      ));
    }

    if (result) {
      return result.grid.map((col, ci) => (
        <div key={ci} style={S.reel}>
          {col.map((sym, ri) => {
            const info = SYMBOLS[sym] || SYMBOLS['CHERRY'];
            const winning = isCellWinning(ci, ri);
            return (
              <div
                key={ri}
                style={{
                  ...S.cell(winning),
                  ...(winning ? { animation: 'win-glow-pulse 1s ease-in-out infinite' } : {}),
                }}
              >
                <div style={S.symbolCircle(info.color)}>
                  <span>{info.emoji}</span>
                </div>
                <span style={S.symbolLabel(info.color)}>{info.label}</span>
              </div>
            );
          })}
        </div>
      ));
    }

    /* default empty state */
    return Array.from({ length: 5 }, (_, ci) => (
      <div key={ci} style={S.reel}>
        {Array.from({ length: 3 }, (_, ri) => {
          const info = SYMBOLS[ALL_SYMBOL_KEYS[(ci * 3 + ri) % ALL_SYMBOL_KEYS.length]];
          return (
            <div key={ri} style={S.cell(false)}>
              <div style={{ ...S.symbolCircle(info.color), opacity: 0.35 }}>
                <span>{info.emoji}</span>
              </div>
              <span style={{ ...S.symbolLabel(info.color), opacity: 0.35 }}>{info.label}</span>
            </div>
          );
        })}
      </div>
    ));
  };

  /* ── sparkle particles for win ── */
  const renderSparkles = () => {
    if (!showWin) return null;
    return (
      <div style={S.sparkleContainer}>
        {Array.from({ length: 28 }, (_, i) => (
          <div key={i} style={S.sparkle(i)} />
        ))}
      </div>
    );
  };

  /* ── light bulbs ── */
  const renderBulbs = (count = 15) => (
    <div style={S.bulbRow}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={S.bulb((i + bulbPhase) % 3 === 0, i)} />
      ))}
    </div>
  );

  /* ── history thumbnails ── */
  const renderHistory = () => {
    if (history.length === 0) return null;
    return (
      <div style={S.historySection}>
        <div style={S.historyLabel}>Last Results</div>
        <div style={S.historyList}>
          {history.map((h, hi) => {
            const isWin = h.totalWin > 0;
            return (
              <div key={hi} style={S.historyCard(isWin)}>
                <div style={S.historyMiniGrid}>
                  {h.grid.map((col, ci) => (
                    <div key={ci} style={S.historyMiniReel}>
                      {col.map((sym, ri) => {
                        const info = SYMBOLS[sym] || SYMBOLS['CHERRY'];
                        return (
                          <div key={ri} style={S.historyMiniCell(info.color)}>
                            <span>{info.emoji}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <span style={S.historyWinLabel(isWin)}>
                  {isWin ? `+\u20B9${formatCurrency(h.totalWin)}` : 'No Win'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── RENDER ── */
  return (
    <div style={S.page} className="casino-game-page">
      <GameRulesModal
        gameKey="slots"
        title="How to Play Slots"
        rules={SLOT_RULES}
        payouts={SLOT_PAYOUTS}
      />
      <div style={S.title}>Lucky Slots</div>

      {/* ===== MACHINE FRAME ===== */}
      <div style={S.machineOuter}>
        <div style={S.machineInner}>

          {/* decorative bulbs */}
          {renderBulbs(17)}

          {/* header */}
          <div style={S.machineLabel}>MEGA JACKPOT</div>
          <div style={S.machineSublabel}>5 Reels - 20 Paylines</div>

          {/* balance */}
          <div style={S.topBar}>
            <div style={S.balanceBadge}>
              <span style={S.balanceLabel}>Balance</span>
              <span style={S.balanceValue}>
                {user ? `\u20B9${formatCurrency(user.balance)}` : '---'}
              </span>
            </div>
          </div>

          {/* ===== REEL GRID ===== */}
          <div style={S.reelFrame}>
            {renderSparkles()}
            <div style={S.reelGrid}>{renderGrid()}</div>

            {/* payline dots */}
            <div style={S.paylineRow}>
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  style={S.paylineDot(
                    result?.wins?.some((w) => w.line === i)
                  )}
                />
              ))}
            </div>
          </div>

          {/* ===== WIN DISPLAY ===== */}
          {showWin && result && result.totalWin > 0 && (
            <div style={S.winOverlay}>
              {renderSparkles()}
              <div style={S.winLabel}>You Win!</div>
              <div style={S.winAmount}>{`\u20B9${formatCurrency(result.totalWin)}`}</div>
              {result.wins.length > 0 && (
                <div style={S.winMult}>
                  {result.wins.map((w, i) => w.name).filter(Boolean).join(' + ') || 'Winning Combination!'}
                </div>
              )}
            </div>
          )}

          {/* ===== CONTROLS ===== */}
          <div style={S.controlsArea}>
            {/* stake selector */}
            <div style={S.stakeSection}>
              <span style={S.stakeLabel}>Bet Amount</span>
              <div style={S.stakeBtns}>
                {BET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    style={S.stakeBtn(stake === amt)}
                    onClick={() => setStake(amt)}
                  >
                    {`\u20B9${formatCurrency(amt)}`}
                  </button>
                ))}
              </div>
            </div>

            {/* SPIN button with neon glow */}
            <div style={S.spinBtnWrapper}>
              <div style={S.spinBtnGlow(spinning)} />
              <button
                style={S.spinBtn(!user || spinning, spinning)}
                onClick={handleSpin}
                disabled={spinning || !user}
              >
                {spinning ? 'SPINNING...' : `SPIN  \u20B9${formatCurrency(stake)}`}
              </button>
            </div>
          </div>

          {/* decorative bulbs bottom */}
          <div style={{ marginTop: 14 }}>{renderBulbs(17)}</div>

          {/* ===== HISTORY THUMBNAILS ===== */}
          {renderHistory()}
        </div>
      </div>
    </div>
  );
}
