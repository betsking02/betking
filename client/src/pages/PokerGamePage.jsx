import { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { dealPoker, drawPoker } from '../api/casino';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import './CasinoGame.css';
import GameRulesModal from '../components/common/GameRulesModal';

/* ────────────────────── PAYTABLE DATA ────────────────────── */
const PAYTABLE = [
  { hand: 'Royal Flush',    multiplier: 800 },
  { hand: 'Straight Flush', multiplier: 50 },
  { hand: 'Four of a Kind', multiplier: 25 },
  { hand: 'Full House',     multiplier: 9 },
  { hand: 'Flush',          multiplier: 6 },
  { hand: 'Straight',       multiplier: 4 },
  { hand: 'Three of a Kind',multiplier: 3 },
  { hand: 'Two Pair',       multiplier: 2 },
  { hand: 'Jacks or Better',multiplier: 1 },
];

/* ────────────────────── SUIT SYMBOLS MAP ────────────────────── */
const SUIT_SYMBOLS = {
  '\u2660': { symbol: '\u2660', name: 'spades',   color: '#1a1a2e' },
  '\u2665': { symbol: '\u2665', name: 'hearts',   color: '#e74c3c' },
  '\u2666': { symbol: '\u2666', name: 'diamonds', color: '#e74c3c' },
  '\u2663': { symbol: '\u2663', name: 'clubs',    color: '#1a1a2e' },
};

/* ────────────────────── PARSE CARD ────────────────────── */
function parseCard(cardStr) {
  if (!cardStr) return { rank: '?', suit: '?', suitInfo: null };
  const suit = cardStr.slice(-1);
  const rank = cardStr.slice(0, -1);
  return { rank, suit, suitInfo: SUIT_SYMBOLS[suit] || null };
}

/* ────────────────────── INLINE STYLES ────────────────────── */
const styles = {
  /* ── Page container ── */
  page: {
    maxWidth: 850,
    margin: '0 auto',
    padding: '0 1rem 2rem',
  },

  title: {
    fontSize: '1.5rem',
    fontWeight: 800,
    marginBottom: '1.25rem',
    textAlign: 'center',
    color: '#fff',
    letterSpacing: '0.5px',
  },

  /* ── Paytable ── */
  paytableWrap: {
    marginBottom: '1.25rem',
    borderRadius: 10,
    overflow: 'hidden',
    border: '2px solid #b8860b',
    background: 'linear-gradient(180deg, #1a2c38 0%, #0f1923 100%)',
  },
  paytableHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #b8860b, #ffd700, #b8860b)',
    fontWeight: 800,
    fontSize: '0.8rem',
    color: '#1a1a2e',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  paytableRow: (isActive) => ({
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    padding: '7px 16px',
    fontSize: '0.8rem',
    fontWeight: isActive ? 800 : 500,
    color: isActive ? '#ffd700' : 'rgba(255,255,255,0.75)',
    background: isActive
      ? 'linear-gradient(90deg, rgba(255,215,0,0.18) 0%, rgba(255,215,0,0.06) 100%)'
      : 'transparent',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    transition: 'all 0.3s',
    ...(isActive ? {
      boxShadow: 'inset 0 0 20px rgba(255,215,0,0.08)',
      textShadow: '0 0 8px rgba(255,215,0,0.5)',
    } : {}),
  }),

  /* ── Felt table ── */
  feltTable: {
    background: 'linear-gradient(135deg, #1a6b35 0%, #145a2b 40%, #0f4a22 100%)',
    borderRadius: 16,
    padding: '1.5rem 1rem 2rem',
    border: '5px solid #0d3b1e',
    boxShadow: 'inset 0 2px 30px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.4)',
    minHeight: 360,
    position: 'relative',
  },

  /* ── Phase indicator ── */
  phaseBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: '1.25rem',
  },
  phaseStep: (active, completed) => ({
    padding: '4px 14px',
    borderRadius: 20,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    background: active
      ? 'linear-gradient(135deg, #ffd700, #b8860b)'
      : completed
        ? 'rgba(0,231,1,0.2)'
        : 'rgba(255,255,255,0.1)',
    color: active ? '#1a1a2e' : completed ? '#00e701' : 'rgba(255,255,255,0.4)',
    transition: 'all 0.3s',
    whiteSpace: 'nowrap',
  }),
  phaseArrow: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: '0.7rem',
    fontWeight: 700,
  },

  /* ── Cards row ── */
  cardsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
  },
  cardSlot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },

  /* ── Single playing card ── */
  card: (held, isRed) => ({
    width: 85,
    height: 120,
    background: 'linear-gradient(160deg, #ffffff 0%, #f0f0f0 100%)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    position: 'relative',
    boxShadow: held
      ? '0 -4px 20px rgba(255,215,0,0.5), 0 4px 12px rgba(0,0,0,0.4)'
      : '0 4px 12px rgba(0,0,0,0.35)',
    border: held ? '3px solid #ffd700' : '3px solid transparent',
    transform: held ? 'translateY(-14px)' : 'translateY(0)',
    transition: 'all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    color: isRed ? '#e74c3c' : '#1a1a2e',
    overflow: 'hidden',
  }),
  cardRank: {
    fontSize: '1.6rem',
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: '-1px',
  },
  cardSuit: {
    fontSize: '1.4rem',
    lineHeight: 1,
    marginTop: 2,
  },
  cardCornerTop: (isRed) => ({
    position: 'absolute',
    top: 4,
    left: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    lineHeight: 1,
    color: isRed ? '#e74c3c' : '#1a1a2e',
  }),
  cardCornerBottom: (isRed) => ({
    position: 'absolute',
    bottom: 4,
    right: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    lineHeight: 1,
    transform: 'rotate(180deg)',
    color: isRed ? '#e74c3c' : '#1a1a2e',
  }),
  cornerRank: {
    fontSize: '0.6rem',
    fontWeight: 800,
  },
  cornerSuit: {
    fontSize: '0.55rem',
  },

  /* ── HELD badge ── */
  heldBadge: {
    background: 'linear-gradient(135deg, #ffd700, #b8860b)',
    color: '#1a1a2e',
    fontSize: '0.6rem',
    fontWeight: 800,
    padding: '2px 10px',
    borderRadius: 10,
    letterSpacing: '1px',
    boxShadow: '0 2px 6px rgba(255,215,0,0.4)',
  },

  /* ── Tap to hold hint ── */
  tapHint: {
    fontSize: '0.55rem',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    height: 18,
    display: 'flex',
    alignItems: 'center',
  },

  /* ── Win display ── */
  winOverlay: {
    textAlign: 'center',
    marginBottom: '1.25rem',
    animation: 'pokerWinPulse 1.5s ease-in-out infinite',
  },
  winHandName: (isWin) => ({
    fontSize: '1.75rem',
    fontWeight: 900,
    color: isWin ? '#ffd700' : 'rgba(255,255,255,0.5)',
    textShadow: isWin
      ? '0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3)'
      : 'none',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  }),
  winAmount: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#00e701',
    textShadow: '0 0 12px rgba(0,231,1,0.5)',
    marginTop: 4,
  },

  /* ── Controls area ── */
  controlsArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },

  /* ── Buttons ── */
  drawBtn: (disabled) => ({
    padding: '14px 48px',
    borderRadius: 8,
    fontWeight: 800,
    fontSize: '1.05rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: 'linear-gradient(135deg, #ffd700, #b8860b)',
    color: '#1a1a2e',
    boxShadow: disabled ? 'none' : '0 4px 16px rgba(255,215,0,0.4)',
    transition: 'all 0.2s',
  }),
  dealBtn: (disabled) => ({
    padding: '14px 36px',
    borderRadius: 8,
    fontWeight: 800,
    fontSize: '1rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: 'linear-gradient(135deg, #00e701, #00a801)',
    color: '#000',
    boxShadow: disabled ? 'none' : '0 4px 16px rgba(0,231,1,0.35)',
    transition: 'all 0.2s',
  }),

  /* ── Stake selector ── */
  stakeWrap: {
    textAlign: 'center',
  },
  stakeLabel: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  stakeButtons: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  /* ── Welcome state (before first deal) ── */
  welcomeText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.9rem',
    marginBottom: '1.25rem',
    fontWeight: 500,
  },

  /* ── Empty card placeholders ── */
  emptyCard: {
    width: 85,
    height: 120,
    borderRadius: 8,
    border: '2px dashed rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.03)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardInner: {
    fontSize: '1.8rem',
    color: 'rgba(255,255,255,0.12)',
  },

  /* ── Deal phase instruction ── */
  instruction: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    letterSpacing: '0.3px',
  },
};

/* ────────────────────── KEYFRAME INJECTION ────────────────────── */
const KEYFRAMES_ID = 'poker-game-keyframes';
function injectKeyframes() {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = KEYFRAMES_ID;
  styleEl.textContent = `
    @keyframes pokerWinPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.04); opacity: 0.92; }
    }
    @keyframes pokerCardDeal {
      0% { transform: translateY(-30px) rotateY(90deg); opacity: 0; }
      60% { transform: translateY(4px) rotateY(0deg); opacity: 1; }
      100% { transform: translateY(0) rotateY(0deg); opacity: 1; }
    }
    @keyframes pokerGlowBorder {
      0%, 100% { box-shadow: 0 0 8px rgba(255,215,0,0.3); }
      50% { box-shadow: 0 0 20px rgba(255,215,0,0.6); }
    }
    @keyframes pokerShimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
  `;
  document.head.appendChild(styleEl);
}

/* ────────────────────── POKER CARD COMPONENT ────────────────────── */
function PokerCard({ value, held, onClick, dealPhase, index, isNew }) {
  const { rank, suit, suitInfo } = parseCard(value);
  const isRed = suitInfo?.color === '#e74c3c';

  const animStyle = isNew
    ? { animation: `pokerCardDeal 0.4s ${index * 0.1}s both ease-out` }
    : {};

  return (
    <div style={styles.cardSlot}>
      <div
        style={{ ...styles.card(held, isRed), ...animStyle }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
        aria-label={`${rank} of ${suitInfo?.name || 'unknown'}${held ? ', held' : ''}`}
      >
        {/* Top-left corner */}
        <div style={styles.cardCornerTop(isRed)}>
          <span style={styles.cornerRank}>{rank}</span>
          <span style={styles.cornerSuit}>{suit}</span>
        </div>

        {/* Center display */}
        <div style={styles.cardRank}>{rank}</div>
        <div style={styles.cardSuit}>{suit}</div>

        {/* Bottom-right corner */}
        <div style={styles.cardCornerBottom(isRed)}>
          <span style={styles.cornerRank}>{rank}</span>
          <span style={styles.cornerSuit}>{suit}</span>
        </div>
      </div>

      {/* HELD badge or TAP TO HOLD hint */}
      {held ? (
        <div style={styles.heldBadge}>HELD</div>
      ) : dealPhase ? (
        <div style={styles.tapHint}>TAP TO HOLD</div>
      ) : (
        <div style={{ height: 18 }} />
      )}
    </div>
  );
}

/* ────────────────────── PHASE INDICATOR ────────────────────── */
const PHASES = ['DEAL', 'SELECT CARDS TO HOLD', 'DRAW', 'RESULT'];

function PhaseIndicator({ currentPhase }) {
  let activeIdx = 0;
  if (currentPhase === null) activeIdx = 0;
  else if (currentPhase === 'deal') activeIdx = 1;
  else if (currentPhase === 'drawing') activeIdx = 2;
  else if (currentPhase === 'complete') activeIdx = 3;

  return (
    <div style={styles.phaseBar}>
      {PHASES.map((label, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={styles.phaseStep(i === activeIdx, i < activeIdx)}>
            {label}
          </span>
          {i < PHASES.length - 1 && (
            <span style={styles.phaseArrow}>&rsaquo;</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ────────────────────── PAYTABLE COMPONENT ────────────────────── */
function Paytable({ winningHand }) {
  return (
    <div style={styles.paytableWrap}>
      <div style={styles.paytableHeader}>
        <span>Hand</span>
        <span>Payout</span>
      </div>
      {PAYTABLE.map((p) => {
        const isActive = winningHand && winningHand === p.hand;
        return (
          <div key={p.hand} style={styles.paytableRow(isActive)}>
            <span>{isActive ? '\u2605 ' : ''}{p.hand}</span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
              {p.multiplier}x
            </span>
          </div>
        );
      })}
    </div>
  );
}

const POKER_RULES = [
  'This is Jacks or Better video poker (5-card draw).',
  'Click DEAL to receive 5 cards.',
  'Click cards you want to HOLD (keep). Unheld cards will be replaced.',
  'Click DRAW to replace unheld cards and see your final hand.',
  'You need at least a pair of Jacks or higher to win.',
  'Higher hands pay more - see the payout table on screen.',
  'After the result, click DEAL to start a new hand.',
];

const POKER_PAYOUTS = [
  { label: 'Royal Flush', value: '800x' },
  { label: 'Straight Flush', value: '50x' },
  { label: 'Four of a Kind', value: '25x' },
  { label: 'Full House', value: '9x' },
  { label: 'Flush', value: '6x' },
  { label: 'Straight', value: '4x' },
  { label: 'Three of a Kind', value: '3x' },
  { label: 'Two Pair', value: '2x' },
  { label: 'Jacks or Better', value: '1x' },
];

/* ────────────────────── MAIN PAGE COMPONENT ────────────────────── */
export default function PokerGamePage() {
  const { user, updateBalance } = useContext(AuthContext);
  const [stake, setStake] = useState(100);
  const [hand, setHand] = useState(null);
  const [holdIndices, setHoldIndices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isNewDeal, setIsNewDeal] = useState(false);
  const [isDrawResult, setIsDrawResult] = useState(false);
  const prevPhaseRef = useRef(null);

  useEffect(() => {
    injectKeyframes();
  }, []);

  /* Track phase transitions for animations */
  useEffect(() => {
    if (hand?.phase === 'complete' && prevPhaseRef.current === 'deal') {
      setIsDrawResult(true);
      const timer = setTimeout(() => setIsDrawResult(false), 600);
      return () => clearTimeout(timer);
    }
    prevPhaseRef.current = hand?.phase || null;
  }, [hand?.phase]);

  /* ── Deal handler ── */
  const handleDeal = async () => {
    if (!user) return toast.error('Please login first');
    if (stake > user.balance) return toast.error('Insufficient balance');
    setLoading(true);
    setHoldIndices([]);
    setIsNewDeal(true);
    try {
      const res = await dealPoker(stake);
      setHand(res.data);
      updateBalance(res.data.balance);
      setTimeout(() => setIsNewDeal(false), 800);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
      setIsNewDeal(false);
    } finally {
      setLoading(false);
    }
  };

  /* ── Draw handler ── */
  const handleDraw = async () => {
    setLoading(true);
    try {
      const res = await drawPoker(hand.handId, holdIndices);
      setHand(res.data);
      updateBalance(res.data.balance);
      if (res.data.payout > 0) {
        toast.success(`${res.data.handName}! Won \u20B9${formatCurrency(res.data.payout)}`);
      } else {
        toast.error(`${res.data.handName} - No win`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  /* ── Toggle hold ── */
  const toggleHold = (idx) => {
    if (hand?.phase !== 'deal') return;
    setHoldIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  /* ── Determine what phase label to show in indicator ── */
  const indicatorPhase = hand ? hand.phase : null;

  return (
    <div style={styles.page}>
      <GameRulesModal
        gameKey="poker"
        title="How to Play Video Poker"
        rules={POKER_RULES}
        payouts={POKER_PAYOUTS}
      />
      <div style={styles.title}>{'\u2660'} Video Poker - Jacks or Better</div>

      {/* ── Paytable ── */}
      <Paytable winningHand={hand?.phase === 'complete' ? hand.handName : null} />

      {/* ── Phase Indicator ── */}
      <PhaseIndicator currentPhase={indicatorPhase} />

      {/* ── Felt Table ── */}
      <div style={styles.feltTable}>

        {hand ? (
          <>
            {/* ── Cards ── */}
            <div style={styles.cardsRow}>
              {hand.cards.map((card, i) => (
                <PokerCard
                  key={`${hand.handId}-${i}-${card}`}
                  value={card}
                  held={holdIndices.includes(i)}
                  onClick={() => toggleHold(i)}
                  dealPhase={hand.phase === 'deal'}
                  index={i}
                  isNew={isNewDeal || (isDrawResult && !holdIndices.includes(i))}
                />
              ))}
            </div>

            {/* ── Deal phase instruction ── */}
            {hand.phase === 'deal' && (
              <div style={styles.instruction}>
                Tap the cards you want to keep, then press DRAW
              </div>
            )}

            {/* ── Win / Result display ── */}
            {hand.phase === 'complete' && (
              <div style={styles.winOverlay}>
                <div style={styles.winHandName(hand.payout > 0)}>
                  {hand.handName}
                </div>
                {hand.payout > 0 && (
                  <div style={styles.winAmount}>
                    Won {'\u20B9'}{formatCurrency(hand.payout)}
                  </div>
                )}
              </div>
            )}

            {/* ── Action Buttons ── */}
            <div style={styles.controlsArea}>
              {hand.phase === 'deal' ? (
                <button
                  style={styles.drawBtn(loading)}
                  onClick={handleDraw}
                  disabled={loading}
                >
                  {loading ? 'DRAWING...' : 'DRAW'}
                </button>
              ) : (
                <>
                  {/* Stake selector */}
                  <div style={styles.stakeWrap}>
                    <label style={styles.stakeLabel}>Bet Amount</label>
                    <div style={styles.stakeButtons}>
                      {BET_AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          className={`btn btn-sm ${stake === amt ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setStake(amt)}
                        >
                          {'\u20B9'}{formatCurrency(amt)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    style={styles.dealBtn(loading || !user)}
                    onClick={handleDeal}
                    disabled={loading || !user}
                  >
                    {loading ? 'DEALING...' : `NEW HAND (\u20B9${formatCurrency(stake)})`}
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {/* ── Empty card placeholders ── */}
            <div style={styles.cardsRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={styles.cardSlot}>
                  <div style={styles.emptyCard}>
                    <span style={styles.emptyCardInner}>{'\u2663'}</span>
                  </div>
                  <div style={{ height: 18 }} />
                </div>
              ))}
            </div>

            <div style={styles.welcomeText}>
              Click cards to HOLD after dealing, then DRAW to replace the rest
            </div>

            <div style={styles.controlsArea}>
              <div style={styles.stakeWrap}>
                <label style={styles.stakeLabel}>Bet Amount</label>
                <div style={styles.stakeButtons}>
                  {BET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      className={`btn btn-sm ${stake === amt ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setStake(amt)}
                    >
                      {'\u20B9'}{formatCurrency(amt)}
                    </button>
                  ))}
                </div>
              </div>
              <button
                style={styles.dealBtn(loading || !user)}
                onClick={handleDeal}
                disabled={loading || !user}
              >
                {loading ? 'DEALING...' : `DEAL (\u20B9${formatCurrency(stake)})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
