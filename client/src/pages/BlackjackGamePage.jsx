import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { startBlackjack, blackjackAction } from '../api/casino';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

/* ------------------------------------------------------------------ */
/*  Parse a card string like "A♠" into { rank, suit, color }          */
/* ------------------------------------------------------------------ */
function parseCard(value) {
  if (!value || value === '??') return null;
  const suits = ['♠', '♥', '♦', '♣'];
  let suit = '';
  let rank = value;
  for (const s of suits) {
    if (value.includes(s)) {
      suit = s;
      rank = value.replace(s, '');
      break;
    }
  }
  const color = suit === '♥' || suit === '♦' ? 'red' : 'black';
  return { rank, suit, color };
}

/* ------------------------------------------------------------------ */
/*  Realistic Playing Card Component                                  */
/* ------------------------------------------------------------------ */
function Card({ value, index = 0, animate = false }) {
  const isHidden = value === '??';

  /* ---------- hidden / face-down card ---------- */
  if (isHidden) {
    return (
      <div
        style={{
          ...styles.card,
          ...styles.cardHidden,
          marginLeft: index > 0 ? -28 : 0,
          animationDelay: animate ? `${index * 0.15}s` : '0s',
        }}
      >
        <div style={styles.hiddenPattern}>
          {[...Array(9)].map((_, i) => (
            <div key={i} style={styles.hiddenDiamond} />
          ))}
        </div>
      </div>
    );
  }

  const parsed = parseCard(value);
  if (!parsed) return null;
  const { rank, suit, color } = parsed;
  const textColor = color === 'red' ? '#dc2626' : '#1a1a2e';

  return (
    <div
      style={{
        ...styles.card,
        marginLeft: index > 0 ? -28 : 0,
        animationDelay: animate ? `${index * 0.15}s` : '0s',
        animation: animate ? `bjCardDeal 0.4s ease-out ${index * 0.15}s both` : 'none',
      }}
    >
      {/* Top-left corner */}
      <div style={{ ...styles.cardCorner, top: 5, left: 6 }}>
        <span style={{ ...styles.cornerRank, color: textColor }}>{rank}</span>
        <span style={{ ...styles.cornerSuit, color: textColor }}>{suit}</span>
      </div>

      {/* Center suit */}
      <div style={{ ...styles.cardCenter, color: textColor }}>{suit}</div>

      {/* Bottom-right corner (inverted) */}
      <div style={{ ...styles.cardCorner, bottom: 5, right: 6, transform: 'rotate(180deg)' }}>
        <span style={{ ...styles.cornerRank, color: textColor }}>{rank}</span>
        <span style={{ ...styles.cornerSuit, color: textColor }}>{suit}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chip-style total badge                                            */
/* ------------------------------------------------------------------ */
function ChipBadge({ total, label }) {
  return (
    <div style={styles.chipBadge}>
      <div style={styles.chipBadgeInner}>
        <span style={styles.chipBadgeLabel}>{label}</span>
        <span style={styles.chipBadgeValue}>{total}</span>
      </div>
    </div>
  );
}

const BJ_RULES = [
  'Goal: Get a hand total closer to 21 than the dealer without going over.',
  'Number cards are worth their face value. Face cards (J, Q, K) are worth 10. Aces are worth 1 or 11.',
  'You and the dealer each receive 2 cards. One dealer card is hidden.',
  'HIT: Take another card. STAND: Keep your current hand.',
  'DOUBLE: Double your bet, take exactly one more card, then stand.',
  'Blackjack (Ace + 10-value card) pays 3:2 (2.5x your bet).',
  'If you go over 21, you BUST and lose your bet.',
  'Dealer must hit on 16 or less and stand on 17 or more.',
  'If both hands tie, it\'s a PUSH and your bet is returned.',
];

const BJ_PAYOUTS = [
  { label: 'Blackjack (A + 10/J/Q/K)', value: '2.5x' },
  { label: 'Regular Win', value: '2x' },
  { label: 'Dealer Bust', value: '2x' },
  { label: 'Push (Tie)', value: '1x (returned)' },
  { label: 'Bust / Dealer Wins', value: '0x (lose bet)' },
];

/* ================================================================== */
/*  Main Page Component                                               */
/* ================================================================== */
export default function BlackjackGamePage() {
  const { user, updateBalance } = useContext(AuthContext);
  const [stake, setStake] = useState(100);
  const [hand, setHand] = useState(null);
  const [dealing, setDealing] = useState(false);

  /* -------- Deal a new hand -------- */
  const handleDeal = async () => {
    if (!user) return toast.error('Please login first');
    if (stake > user.balance) return toast.error('Insufficient balance');
    setDealing(true);
    try {
      const res = await startBlackjack(stake);
      setHand(res.data);
      updateBalance(res.data.balance);
      if (res.data.result === 'blackjack') toast.success('BLACKJACK!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setDealing(false);
    }
  };

  /* -------- Hit / Stand / Double -------- */
  const handleAction = async (action) => {
    try {
      const res = await blackjackAction(hand.handId, action);
      setHand(res.data);
      updateBalance(res.data.balance);
      if (res.data.status === 'settled') {
        if (res.data.payout > 0 && res.data.result !== 'push') {
          toast.success(
            `You ${res.data.result === 'blackjack' ? 'got BLACKJACK' : 'won'}! +₹${formatCurrency(res.data.payout)}`
          );
        } else if (res.data.result === 'push') {
          toast('Push - bet returned');
        } else {
          toast.error(`Dealer wins - ${res.data.result}`);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  /* -------- Result helpers -------- */
  const getResultClass = () => {
    if (!hand || hand.status !== 'settled') return '';
    if (hand.result === 'push') return 'push';
    return hand.payout > 0 ? 'win' : 'lose';
  };

  const getResultText = () => {
    if (!hand) return '';
    const map = {
      blackjack: 'BLACKJACK!',
      win: 'YOU WIN!',
      dealer_bust: 'DEALER BUST! YOU WIN!',
      push: 'PUSH - Bet Returned',
      bust: 'BUST!',
      lose: 'DEALER WINS',
    };
    return map[hand.result] || hand.result;
  };

  const resultBannerColor = () => {
    const cls = getResultClass();
    if (cls === 'win')
      return {
        background: 'linear-gradient(135deg, rgba(0,231,1,0.18) 0%, rgba(0,180,0,0.10) 100%)',
        border: '2px solid rgba(0,231,1,0.45)',
        color: '#00e701',
        boxShadow: '0 0 30px rgba(0,231,1,0.25), inset 0 0 30px rgba(0,231,1,0.05)',
      };
    if (cls === 'lose')
      return {
        background: 'linear-gradient(135deg, rgba(255,68,68,0.18) 0%, rgba(200,0,0,0.10) 100%)',
        border: '2px solid rgba(255,68,68,0.45)',
        color: '#ff4444',
        boxShadow: '0 0 30px rgba(255,68,68,0.25), inset 0 0 30px rgba(255,68,68,0.05)',
      };
    if (cls === 'push')
      return {
        background: 'linear-gradient(135deg, rgba(255,215,0,0.18) 0%, rgba(200,170,0,0.10) 100%)',
        border: '2px solid rgba(255,215,0,0.45)',
        color: '#ffd700',
        boxShadow: '0 0 30px rgba(255,215,0,0.25), inset 0 0 30px rgba(255,215,0,0.05)',
      };
    return {};
  };

  const isPlaying = hand && hand.status === 'playing';
  const isSettled = hand && hand.status === 'settled';

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  return (
    <div className="casino-game-page" style={{ maxWidth: 860, margin: '0 auto' }}>
      <GameRulesModal
        gameKey="blackjack"
        title="How to Play Blackjack"
        rules={BJ_RULES}
        payouts={BJ_PAYOUTS}
      />

      {/* ---- inject keyframes once ---- */}
      <style>{keyframeCSS}</style>

      {/* Title */}
      <h1 style={styles.pageTitle}>
        <span style={styles.titleIcon}>&#127183;</span> Blackjack
      </h1>

      {/* ================================================================ */}
      {/*  THE TABLE                                                       */}
      {/* ================================================================ */}
      <div style={styles.tableOuter}>
        <div style={styles.tableInner}>
          {/* decorative gold rim */}
          <div style={styles.tableRimTop} />

          {/* ---------- RESULT BANNER (shown when settled) ---------- */}
          {isSettled && (
            <div style={{ ...styles.resultBanner, ...resultBannerColor() }}>
              <div style={styles.resultText}>{getResultText()}</div>
              {hand.payout > 0 && hand.result !== 'push' && (
                <div style={styles.payoutText}>+₹{formatCurrency(hand.payout)}</div>
              )}
              {hand.result === 'push' && (
                <div style={{ ...styles.payoutText, color: '#ffd700' }}>
                  ₹{formatCurrency(hand.payout)} returned
                </div>
              )}
            </div>
          )}

          {/* ---------- DEALER AREA ---------- */}
          <div style={styles.handArea}>
            <div style={styles.handHeader}>
              <span style={styles.handHeaderLabel}>DEALER</span>
            </div>
            {hand ? (
              <>
                <div style={styles.cardsRow}>
                  {hand.dealerCards.map((c, i) => (
                    <Card key={i} value={c} index={i} animate={!isSettled} />
                  ))}
                </div>
                <ChipBadge total={hand.dealerTotal} label="Dealer" />
              </>
            ) : (
              <div style={styles.emptyCards}>
                <div style={{ ...styles.card, ...styles.cardPlaceholder }} />
                <div style={{ ...styles.card, ...styles.cardPlaceholder, marginLeft: -28 }} />
              </div>
            )}
          </div>

          {/* ---------- VS DIVIDER ---------- */}
          <div style={styles.vsDivider}>
            <div style={styles.vsLine} />
            <span style={styles.vsText}>VS</span>
            <div style={styles.vsLine} />
          </div>

          {/* ---------- PLAYER AREA ---------- */}
          <div style={styles.handArea}>
            <div style={styles.handHeader}>
              <span style={styles.handHeaderLabel}>YOU</span>
            </div>
            {hand ? (
              <>
                <div style={styles.cardsRow}>
                  {hand.playerCards.map((c, i) => (
                    <Card key={i} value={c} index={i} animate={!isSettled} />
                  ))}
                </div>
                <ChipBadge total={hand.playerTotal} label="You" />
              </>
            ) : (
              <div style={styles.emptyCards}>
                <div style={{ ...styles.card, ...styles.cardPlaceholder }} />
                <div style={{ ...styles.card, ...styles.cardPlaceholder, marginLeft: -28 }} />
              </div>
            )}
          </div>

          {/* ---------- ACTION BUTTONS (during play) ---------- */}
          {isPlaying && (
            <div style={styles.actionsRow}>
              {hand.canHit && (
                <button style={{ ...styles.chipBtn, ...styles.chipHit }} onClick={() => handleAction('hit')}>
                  <span style={styles.chipBtnInner}>HIT</span>
                </button>
              )}
              <button style={{ ...styles.chipBtn, ...styles.chipStand }} onClick={() => handleAction('stand')}>
                <span style={styles.chipBtnInner}>STAND</span>
              </button>
              {hand.canDouble && (
                <button style={{ ...styles.chipBtn, ...styles.chipDouble }} onClick={() => handleAction('double')}>
                  <span style={styles.chipBtnInner}>DOUBLE</span>
                </button>
              )}
            </div>
          )}

          <div style={styles.tableRimBottom} />
        </div>
      </div>

      {/* ================================================================ */}
      {/*  BET SELECTOR + DEAL BUTTON                                      */}
      {/* ================================================================ */}
      {(!hand || isSettled) && (
        <div style={styles.betPanel}>
          <div style={styles.betLabel}>Place Your Bet</div>
          <div style={styles.betChips}>
            {BET_AMOUNTS.map((amt) => {
              const isActive = stake === amt;
              return (
                <button
                  key={amt}
                  onClick={() => setStake(amt)}
                  style={{
                    ...styles.betChip,
                    ...(isActive ? styles.betChipActive : {}),
                  }}
                >
                  <span style={styles.betChipInner}>
                    ₹{formatCurrency(amt)}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            style={{
              ...styles.dealBtn,
              opacity: dealing || !user ? 0.55 : 1,
              cursor: dealing || !user ? 'not-allowed' : 'pointer',
            }}
            onClick={handleDeal}
            disabled={dealing || !user}
          >
            {dealing ? 'DEALING...' : `DEAL  -  ₹${formatCurrency(stake)}`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Keyframe animations (injected via <style>)                        */
/* ================================================================== */
const keyframeCSS = `
@keyframes bjCardDeal {
  0%   { opacity: 0; transform: translateY(-40px) scale(0.7) rotate(-8deg); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
}
@keyframes bjResultGlow {
  0%, 100% { filter: brightness(1); }
  50%      { filter: brightness(1.25); }
}
@keyframes bjChipPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,215,0,0.4); }
  50%      { box-shadow: 0 0 14px 4px rgba(255,215,0,0.25); }
}
@keyframes bjDealBtnShine {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
`;

/* ================================================================== */
/*  Inline style objects                                              */
/* ================================================================== */
const styles = {
  /* --- page --- */
  pageTitle: {
    fontSize: '1.6rem',
    fontWeight: 800,
    marginBottom: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#fff',
  },
  titleIcon: {
    fontSize: '1.8rem',
  },

  /* --- table outer (wood border) --- */
  tableOuter: {
    background: 'linear-gradient(145deg, #5c3a1e 0%, #3e2410 40%, #5c3a1e 100%)',
    borderRadius: 18,
    padding: '8px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
  },

  /* --- table inner (green felt) --- */
  tableInner: {
    background: 'radial-gradient(ellipse at 50% 40%, #1f7a42 0%, #155c30 50%, #0e4422 100%)',
    borderRadius: 12,
    padding: '28px 20px 24px',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 420,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },

  /* decorative rim lines */
  tableRimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'linear-gradient(90deg, transparent 5%, rgba(255,215,0,0.18) 50%, transparent 95%)',
  },
  tableRimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'linear-gradient(90deg, transparent 5%, rgba(255,215,0,0.18) 50%, transparent 95%)',
  },

  /* --- hand area --- */
  handArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  handHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  handHeaderLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },

  /* --- cards row (overlapping) --- */
  cardsRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
    padding: '4px 0',
  },
  emptyCards: {
    display: 'flex',
    justifyContent: 'center',
    minHeight: 120,
    padding: '4px 0',
  },

  /* --- single card --- */
  card: {
    width: 80,
    height: 115,
    borderRadius: 10,
    background: '#fff',
    position: 'relative',
    boxShadow: '0 4px 14px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
    flexShrink: 0,
    border: '1.5px solid #e0ddd5',
    transition: 'transform 0.2s',
  },
  cardHidden: {
    background: 'linear-gradient(135deg, #1a3a5c 0%, #1e4d7a 50%, #1a3a5c 100%)',
    border: '2.5px solid #2a5f8f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hiddenPattern: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
    padding: 12,
  },
  hiddenDiamond: {
    width: 12,
    height: 12,
    background: 'rgba(255,255,255,0.08)',
    transform: 'rotate(45deg)',
    borderRadius: 2,
  },
  cardPlaceholder: {
    background: 'rgba(255,255,255,0.06)',
    border: '2px dashed rgba(255,255,255,0.12)',
    boxShadow: 'none',
  },

  /* card corner */
  cardCorner: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    lineHeight: 1,
  },
  cornerRank: {
    fontSize: '0.82rem',
    fontWeight: 800,
    fontFamily: "'Georgia', serif",
  },
  cornerSuit: {
    fontSize: '0.72rem',
    lineHeight: 1,
    marginTop: 0,
  },

  /* card center */
  cardCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '2.1rem',
    lineHeight: 1,
  },

  /* --- chip badge for totals --- */
  chipBadge: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'linear-gradient(145deg, #2d2d2d, #1a1a1a)',
    padding: 3,
    boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
  },
  chipBadgeInner: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2.5px dashed rgba(255,215,0,0.6)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBadgeLabel: {
    fontSize: '0.45rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  chipBadgeValue: {
    fontSize: '1rem',
    fontWeight: 900,
    color: '#ffd700',
    lineHeight: 1,
  },

  /* --- VS divider --- */
  vsDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '70%',
    margin: '2px 0',
  },
  vsLine: {
    flex: 1,
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.2), transparent)',
  },
  vsText: {
    fontSize: '0.85rem',
    fontWeight: 800,
    color: 'rgba(255,215,0,0.35)',
    letterSpacing: '0.12em',
  },

  /* --- result banner --- */
  resultBanner: {
    width: '90%',
    textAlign: 'center',
    padding: '14px 18px',
    borderRadius: 12,
    marginBottom: 6,
    animation: 'bjResultGlow 2s ease-in-out infinite',
  },
  resultText: {
    fontSize: '1.45rem',
    fontWeight: 900,
    letterSpacing: '0.04em',
    textShadow: '0 0 20px currentColor',
  },
  payoutText: {
    fontSize: '1.1rem',
    fontWeight: 700,
    marginTop: 4,
    color: '#00e701',
  },

  /* --- action chip buttons --- */
  actionsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 18,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  chipBtn: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
  },
  chipBtnInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2.5px dashed rgba(255,255,255,0.5)',
    fontWeight: 800,
    fontSize: '0.72rem',
    letterSpacing: '0.06em',
    color: '#fff',
    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
  },
  chipHit: {
    background: 'linear-gradient(145deg, #27ae60, #1e8449)',
  },
  chipStand: {
    background: 'linear-gradient(145deg, #f39c12, #d68910)',
  },
  chipDouble: {
    background: 'linear-gradient(145deg, #2980b9, #1f6da0)',
  },

  /* --- bet panel --- */
  betPanel: {
    marginTop: 20,
    background: 'rgba(26,44,56,0.85)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '22px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  betLabel: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  betChips: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  betChip: {
    width: 62,
    height: 62,
    borderRadius: '50%',
    background: 'linear-gradient(145deg, #374151, #1f2937)',
    border: '2px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    padding: 3,
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  betChipActive: {
    background: 'linear-gradient(145deg, #b8860b, #8b6914)',
    border: '2px solid #ffd700',
    transform: 'scale(1.1)',
    animation: 'bjChipPulse 1.5s ease-in-out infinite',
    boxShadow: '0 4px 18px rgba(255,215,0,0.35)',
  },
  betChipInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px dashed rgba(255,255,255,0.25)',
    fontWeight: 800,
    fontSize: '0.62rem',
    color: '#fff',
    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
  },

  /* --- deal button --- */
  dealBtn: {
    width: '100%',
    maxWidth: 340,
    padding: '14px 28px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #00c853, #009624)',
    backgroundSize: '200% auto',
    color: '#fff',
    fontWeight: 800,
    fontSize: '1.05rem',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    boxShadow: '0 4px 18px rgba(0,200,83,0.35)',
    transition: 'transform 0.12s, box-shadow 0.12s',
  },
};
