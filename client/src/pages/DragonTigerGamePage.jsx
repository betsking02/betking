import { useState, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { playDragonTiger } from '../api/casino';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

const DT_RULES = [
  'Place your bet on Dragon, Tiger, or Tie.',
  'One card is dealt to Dragon and one to Tiger.',
  'The side with the higher card wins.',
  'Dragon or Tiger bet pays 1.94x your stake.',
  'Tie bet pays 8x your stake.',
  'Cards rank from 2 (lowest) to A (highest). Suits do not matter.',
];

const DT_PAYOUTS = [
  { label: 'Dragon wins', value: '1.94x' },
  { label: 'Tiger wins', value: '1.94x' },
  { label: 'Tie', value: '8x' },
];

const SUIT_SYMBOLS = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const SUIT_COLORS = {
  hearts: '#dc2626',
  diamonds: '#dc2626',
  clubs: '#1a1a2e',
  spades: '#1a1a2e',
};

/* ── Face-down placeholder card ── */
function CardBack({ size = 'large' }) {
  const cardWidth = size === 'large' ? 140 : 80;
  const cardHeight = size === 'large' ? 196 : 112;

  return (
    <div
      style={{
        width: cardWidth,
        height: cardHeight,
        background: 'linear-gradient(145deg, #1e3a5f, #0d2240)',
        borderRadius: size === 'large' ? 14 : 10,
        border: '2px solid rgba(255,215,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Diamond pattern overlay */}
      <div style={{
        position: 'absolute',
        inset: 6,
        backgroundImage: `repeating-linear-gradient(
          45deg,
          rgba(255,215,0,0.07) 0px,
          rgba(255,215,0,0.07) 2px,
          transparent 2px,
          transparent 10px
        )`,
        borderRadius: 8,
        border: '1px solid rgba(255,215,0,0.15)',
      }} />
      <span style={{ fontSize: size === 'large' ? '2.5rem' : '1.5rem', opacity: 0.5 }}>?</span>
    </div>
  );
}

/* ── Revealed playing card ── */
function PlayingCard({ card, size = 'large', highlight = '', flipping = false }) {
  if (!card) return null;

  const suitSymbol = SUIT_SYMBOLS[card.suit] || '';
  const suitColor = SUIT_COLORS[card.suit] || '#1a1a2e';
  const isLarge = size === 'large';

  const cardWidth = isLarge ? 140 : 80;
  const cardHeight = isLarge ? 196 : 112;
  const rankFont = isLarge ? '1.6rem' : '0.95rem';
  const suitFont = isLarge ? '3.5rem' : '1.8rem';

  let borderColor = 'rgba(255,255,255,0.15)';
  let boxShadow = '0 4px 16px rgba(0,0,0,0.4)';

  if (highlight === 'win') {
    borderColor = '#00e701';
    boxShadow = '0 0 28px rgba(0,231,1,0.5), 0 0 8px rgba(0,231,1,0.3)';
  } else if (highlight === 'lose') {
    borderColor = '#dc2626';
    boxShadow = '0 0 20px rgba(220,38,38,0.45), 0 0 6px rgba(220,38,38,0.2)';
  } else if (highlight === 'tie') {
    borderColor = '#ffd700';
    boxShadow = '0 0 24px rgba(255,215,0,0.5), 0 0 8px rgba(255,215,0,0.25)';
  }

  return (
    <div
      className={`dt-card${flipping === 'in' ? ' dt-card-flip-in' : ''}`}
      style={{
        width: cardWidth,
        height: cardHeight,
        background: 'linear-gradient(145deg, #ffffff, #f0f0f0)',
        borderRadius: isLarge ? 14 : 10,
        border: `2px solid ${borderColor}`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow,
        flexShrink: 0,
        transition: 'box-shadow 0.4s, border-color 0.4s',
      }}
    >
      {/* Top-left */}
      <div style={{
        position: 'absolute',
        top: isLarge ? 8 : 6,
        left: isLarge ? 10 : 7,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
      }}>
        <span style={{
          fontSize: rankFont,
          fontWeight: 800,
          color: suitColor,
          fontFamily: 'Georgia, serif',
        }}>{card.value}</span>
        <span style={{
          fontSize: isLarge ? '1rem' : '0.7rem',
          color: suitColor,
          marginTop: -2,
        }}>{suitSymbol}</span>
      </div>

      {/* Center suit */}
      <span style={{ fontSize: suitFont, color: suitColor, lineHeight: 1 }}>{suitSymbol}</span>

      {/* Bottom-right (rotated) */}
      <div style={{
        position: 'absolute',
        bottom: isLarge ? 8 : 6,
        right: isLarge ? 10 : 7,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
        transform: 'rotate(180deg)',
      }}>
        <span style={{
          fontSize: rankFont,
          fontWeight: 800,
          color: suitColor,
          fontFamily: 'Georgia, serif',
        }}>{card.value}</span>
        <span style={{
          fontSize: isLarge ? '1rem' : '0.7rem',
          color: suitColor,
          marginTop: -2,
        }}>{suitSymbol}</span>
      </div>
    </div>
  );
}

/* ── History badge ── */
function HistoryBadge({ result }) {
  const config = {
    dragon: { label: 'D', bg: 'rgba(192,57,43,0.2)', color: '#e74c3c', border: 'rgba(192,57,43,0.4)' },
    tiger:  { label: 'T', bg: 'rgba(211,84,0,0.2)',  color: '#e67e22', border: 'rgba(211,84,0,0.4)' },
    tie:    { label: '=', bg: 'rgba(255,215,0,0.15)', color: '#ffd700', border: 'rgba(255,215,0,0.35)' },
  };
  const c = config[result] || config.tie;

  return (
    <div style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: c.bg,
      border: `1px solid ${c.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.75rem',
      fontWeight: 800,
      color: c.color,
      fontFamily: 'var(--font-mono)',
      flexShrink: 0,
    }}>
      {c.label}
    </div>
  );
}

export default function DragonTigerGamePage() {
  const { user, updateBalance } = useContext(AuthContext);
  const [stake, setStake] = useState(BET_AMOUNTS[0]);
  const [selectedBet, setSelectedBet] = useState(null); // 'dragon'|'tiger'|'tie'|null
  const [result, setResult] = useState(null);           // API result object
  const [loading, setLoading] = useState(false);
  const [dealing, setDealing] = useState(false);        // face-down cards shown
  const [history, setHistory] = useState([]);           // array of result strings

  const handlePlay = useCallback(async (betChoice) => {
    if (!user) return toast.error('Please login first');
    if (stake > (user?.balance || 0)) return toast.error('Insufficient balance');
    if (loading || dealing) return;

    setSelectedBet(betChoice);
    setResult(null);
    setDealing(true);
    setLoading(true);

    try {
      const res = await playDragonTiger(stake, betChoice);
      const data = res.data;
      const game = data.gameResult;

      // Brief pause so face-down card animation is visible (at least 600ms)
      await new Promise(resolve => setTimeout(resolve, 650));

      setDealing(false);
      // Small gap before flipping in
      await new Promise(resolve => setTimeout(resolve, 80));

      setResult(game);
      updateBalance(data.balance);
      setHistory(prev => [game.result, ...prev].slice(0, 8));

      if (game.won) {
        toast.success(`You won ${formatCurrency(data.payout)}! (${game.multiplier}x)`);
      } else {
        toast.error(`${game.result === 'tie' ? 'Tie!' : game.result.charAt(0).toUpperCase() + game.result.slice(1) + ' wins!'} Better luck next time.`);
      }
    } catch (err) {
      setDealing(false);
      toast.error(err.response?.data?.error || 'Failed to place bet');
    }
    setLoading(false);
  }, [user, stake, loading, dealing, updateBalance]);

  const resetGame = () => {
    setResult(null);
    setDealing(false);
    setSelectedBet(null);
    setLoading(false);
  };

  /* Determine card highlights after result */
  const getDragonHighlight = () => {
    if (!result) return '';
    if (result.result === 'tie') return 'tie';
    return result.result === 'dragon' ? 'win' : 'lose';
  };

  const getTigerHighlight = () => {
    if (!result) return '';
    if (result.result === 'tie') return 'tie';
    return result.result === 'tiger' ? 'win' : 'lose';
  };

  const isPreGame = !dealing && !result;

  return (
    <div className="casino-game-page" style={{ maxWidth: 600 }}>
      <h1>&#x1F409; Dragon vs Tiger</h1>

      <GameRulesModal
        gameKey="dragontiger"
        title="How to Play Dragon vs Tiger"
        rules={DT_RULES}
        payouts={DT_PAYOUTS}
      />

      {/* ====== PRE-GAME: Preview + Setup ====== */}
      {isPreGame && (
        <div className="dt-setup">
          {/* Preview banner */}
          <div className="dt-preview">
            <div className="dt-preview-fighters">
              <div className="dt-preview-fighter dt-fighter-dragon">
                <span className="dt-fighter-emoji">&#x1F409;</span>
              </div>
              <div className="dt-preview-vs-circle">VS</div>
              <div className="dt-preview-fighter dt-fighter-tiger">
                <span className="dt-fighter-emoji">&#x1F42F;</span>
              </div>
            </div>
            <div className="dt-preview-overlay">
              <div className="dt-preview-title">DRAGON vs TIGER</div>
              <div className="dt-preview-subtitle">Which side will win?</div>
            </div>
          </div>

          {/* Controls */}
          <div className="dt-setup-controls">
            {/* Stake selector */}
            <div className="stake-selector">
              <label>Bet Amount</label>
              <div className="stake-buttons">
                {BET_AMOUNTS.map(amt => (
                  <button
                    key={amt}
                    className={`btn btn-sm ${stake === amt ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setStake(amt)}
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>
            </div>

            {/* 3 bet buttons */}
            <div className="dt-bet-buttons">
              {/* DRAGON */}
              <button
                className="dt-bet-btn dt-bet-dragon"
                onClick={() => handlePlay('dragon')}
                disabled={loading || !user || stake > (user?.balance || 0)}
              >
                <span className="dt-btn-emoji">&#x1F409;</span>
                <span className="dt-btn-label">DRAGON</span>
                <span className="dt-btn-mult">1.94x</span>
              </button>

              {/* TIE */}
              <button
                className="dt-bet-btn dt-bet-tie"
                onClick={() => handlePlay('tie')}
                disabled={loading || !user || stake > (user?.balance || 0)}
              >
                <span className="dt-btn-tie-eq">=</span>
                <span className="dt-btn-label">TIE</span>
                <span className="dt-btn-mult">8x</span>
              </button>

              {/* TIGER */}
              <button
                className="dt-bet-btn dt-bet-tiger"
                onClick={() => handlePlay('tiger')}
                disabled={loading || !user || stake > (user?.balance || 0)}
              >
                <span className="dt-btn-emoji">&#x1F42F;</span>
                <span className="dt-btn-label">TIGER</span>
                <span className="dt-btn-mult">1.94x</span>
              </button>
            </div>

            {/* Bet amount display */}
            <div className="dt-stake-display">
              Placing <strong>{formatCurrency(stake)}</strong> on your chosen side
            </div>
          </div>
        </div>
      )}

      {/* ====== DEALING: Face-down cards ====== */}
      {dealing && (
        <div className="dt-game-area">
          <div className="dt-dealing-banner">
            <div className="dt-dealing-dots">
              <span /><span /><span />
            </div>
            <span>Dealing cards...</span>
          </div>

          <div className="dt-table">
            {/* Dragon side */}
            <div className="dt-side">
              <div className="dt-side-label dt-side-label-dragon">&#x1F409; DRAGON</div>
              <div className="dt-card-wrapper dt-card-dealing">
                <CardBack size="large" />
              </div>
            </div>

            {/* VS divider */}
            <div className="dt-vs-divider">
              <div className="dt-vs-text">VS</div>
            </div>

            {/* Tiger side */}
            <div className="dt-side">
              <div className="dt-side-label dt-side-label-tiger">&#x1F42F; TIGER</div>
              <div className="dt-card-wrapper dt-card-dealing dt-card-dealing-right">
                <CardBack size="large" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== RESULT ====== */}
      {result && !dealing && (
        <div className="dt-game-area">
          {/* Result banner */}
          <div className={`dt-result-banner ${result.won ? 'dt-result-win' : result.result === 'tie' && selectedBet === 'tie' ? 'dt-result-win' : 'dt-result-lose'}`}>
            {result.won ? (
              <>
                <div className="dt-result-icon">&#x2714;</div>
                <div className="dt-result-title">You Won!</div>
                <div className="dt-result-payout">+{formatCurrency(result.payout)}</div>
                <div className="dt-result-sub">{result.multiplier}x &mdash; {result.result === 'dragon' ? '&#x1F409; Dragon wins' : result.result === 'tiger' ? '&#x1F42F; Tiger wins' : 'Tie!'}</div>
              </>
            ) : (
              <>
                <div className="dt-result-icon">&#x2716;</div>
                <div className="dt-result-title">
                  {result.result === 'dragon' ? '\uD83D\uDC09 Dragon Wins' : result.result === 'tiger' ? '\uD83D\uDC2F Tiger Wins' : 'Tie!'}
                </div>
                <div className="dt-result-sub">You lost {formatCurrency(stake)}</div>
              </>
            )}
          </div>

          {/* Card table */}
          <div className="dt-table">
            {/* Dragon side */}
            <div className="dt-side">
              <div className={`dt-side-label ${getDragonHighlight() === 'win' ? 'dt-side-label-win' : getDragonHighlight() === 'tie' ? 'dt-side-label-tie' : 'dt-side-label-dragon'}`}>
                &#x1F409; DRAGON
              </div>
              <div className="dt-card-wrapper">
                <PlayingCard
                  card={result.dragon}
                  size="large"
                  highlight={getDragonHighlight()}
                  flipping="in"
                />
              </div>
              <div className="dt-card-rank-label">
                {result.dragon?.display} ({result.dragon?.numericValue})
              </div>
            </div>

            {/* VS divider */}
            <div className="dt-vs-divider">
              <div className={`dt-vs-text ${result.result === 'tie' ? 'dt-vs-tie' : ''}`}>VS</div>
            </div>

            {/* Tiger side */}
            <div className="dt-side">
              <div className={`dt-side-label ${getTigerHighlight() === 'win' ? 'dt-side-label-win' : getTigerHighlight() === 'tie' ? 'dt-side-label-tie' : 'dt-side-label-tiger'}`}>
                &#x1F42F; TIGER
              </div>
              <div className="dt-card-wrapper">
                <PlayingCard
                  card={result.tiger}
                  size="large"
                  highlight={getTigerHighlight()}
                  flipping="in"
                />
              </div>
              <div className="dt-card-rank-label">
                {result.tiger?.display} ({result.tiger?.numericValue})
              </div>
            </div>
          </div>

          {/* Play Again */}
          <button
            className="btn btn-primary"
            onClick={resetGame}
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 800, marginTop: '0.25rem' }}
          >
            PLAY AGAIN
          </button>
        </div>
      )}

      {/* ====== GAME HISTORY ====== */}
      {history.length > 0 && (
        <div className="dt-history-section">
          <div className="dt-history-label">Recent Results</div>
          <div className="dt-history-row">
            {history.map((r, i) => (
              <HistoryBadge key={i} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* ====== INLINE STYLES ====== */}
      <style>{`
        /* ===== SETUP / PREVIEW ===== */
        .dt-setup {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .dt-preview {
          position: relative;
          min-height: 190px;
          background: linear-gradient(145deg, #0d1018, #13172a);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        /* Ambient glow blobs */
        .dt-preview::before {
          content: '';
          position: absolute;
          left: 12%;
          top: 50%;
          transform: translateY(-50%);
          width: 140px;
          height: 140px;
          background: radial-gradient(circle, rgba(192,57,43,0.22) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }
        .dt-preview::after {
          content: '';
          position: absolute;
          right: 12%;
          top: 50%;
          transform: translateY(-50%);
          width: 140px;
          height: 140px;
          background: radial-gradient(circle, rgba(211,84,0,0.22) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }

        .dt-preview-fighters {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          opacity: 0.28;
          z-index: 1;
        }

        .dt-preview-fighter {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: dt-float 3s ease-in-out infinite;
        }

        .dt-fighter-dragon {
          background: radial-gradient(circle, rgba(192,57,43,0.4), rgba(192,57,43,0.1));
          border: 2px solid rgba(192,57,43,0.4);
          animation-delay: 0s;
        }

        .dt-fighter-tiger {
          background: radial-gradient(circle, rgba(211,84,0,0.4), rgba(211,84,0,0.1));
          border: 2px solid rgba(211,84,0,0.4);
          animation-delay: -1.5s;
        }

        .dt-fighter-emoji {
          font-size: 2.8rem;
          line-height: 1;
        }

        .dt-preview-vs-circle {
          font-size: 1.1rem;
          font-weight: 900;
          color: rgba(255,215,0,0.5);
          letter-spacing: 2px;
        }

        @keyframes dt-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        .dt-preview-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at center, rgba(10,12,20,0.3), rgba(10,12,20,0.78));
          z-index: 2;
        }

        .dt-preview-title {
          font-size: 2.5rem;
          font-weight: 900;
          letter-spacing: 5px;
          background: linear-gradient(135deg, #ffd700, #f39c12, #ffd700);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: dt-shimmer 3s linear infinite;
          margin-bottom: 0.4rem;
          white-space: nowrap;
        }

        @keyframes dt-shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }

        .dt-preview-subtitle {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.55);
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        /* ===== SETUP CONTROLS ===== */
        .dt-setup-controls {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        /* ===== 3 BET BUTTONS ===== */
        .dt-bet-buttons {
          display: grid;
          grid-template-columns: 1fr 0.7fr 1fr;
          gap: 0.6rem;
          align-items: center;
        }

        .dt-bet-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          padding: 0.85rem 0.5rem;
          border-radius: var(--radius);
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          position: relative;
          overflow: hidden;
        }

        .dt-bet-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0);
          transition: background 0.2s;
        }

        .dt-bet-btn:hover:not(:disabled)::before {
          background: rgba(255,255,255,0.06);
        }

        .dt-bet-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .dt-bet-btn:active:not(:disabled) {
          transform: scale(0.97);
        }

        /* Dragon button — red/fire */
        .dt-bet-dragon {
          background: linear-gradient(145deg, #c0392b, #e74c3c);
          border-color: rgba(255,100,80,0.35);
          box-shadow: 0 4px 16px rgba(192,57,43,0.35);
          color: #fff;
        }
        .dt-bet-dragon:hover:not(:disabled) {
          border-color: rgba(255,120,100,0.6);
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(192,57,43,0.5);
        }

        /* Tie button — gold, smaller middle */
        .dt-bet-tie {
          background: linear-gradient(145deg, #b8860b, #d4a017);
          border-color: rgba(255,215,0,0.35);
          box-shadow: 0 4px 12px rgba(212,160,23,0.3);
          color: #fff;
          padding: 0.7rem 0.4rem;
        }
        .dt-bet-tie:hover:not(:disabled) {
          border-color: rgba(255,215,0,0.6);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(212,160,23,0.45);
        }

        /* Tiger button — orange */
        .dt-bet-tiger {
          background: linear-gradient(145deg, #d35400, #e67e22);
          border-color: rgba(255,140,50,0.35);
          box-shadow: 0 4px 16px rgba(211,84,0,0.35);
          color: #fff;
        }
        .dt-bet-tiger:hover:not(:disabled) {
          border-color: rgba(255,155,70,0.6);
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(211,84,0,0.5);
        }

        .dt-btn-emoji {
          font-size: 1.8rem;
          line-height: 1;
        }
        .dt-btn-tie-eq {
          font-size: 1.6rem;
          font-weight: 900;
          line-height: 1;
        }
        .dt-btn-label {
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }
        .dt-btn-mult {
          font-size: 0.75rem;
          font-weight: 700;
          opacity: 0.85;
          font-family: var(--font-mono);
          background: rgba(0,0,0,0.2);
          padding: 1px 6px;
          border-radius: 4px;
        }

        .dt-stake-display {
          text-align: center;
          font-size: 0.82rem;
          color: var(--text-muted);
        }
        .dt-stake-display strong {
          color: var(--accent-gold);
        }

        /* ===== GAME AREA (dealing + result) ===== */
        .dt-game-area {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        /* ===== DEALING ANIMATION ===== */
        .dt-dealing-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.5px;
          padding: 0.5rem;
        }

        .dt-dealing-dots {
          display: flex;
          gap: 5px;
        }
        .dt-dealing-dots span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent-gold);
          animation: dt-dot-pulse 1.2s ease-in-out infinite;
        }
        .dt-dealing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .dt-dealing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes dt-dot-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1.15); }
        }

        /* ===== CARD TABLE ===== */
        .dt-table {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
        }

        .dt-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          flex: 1;
        }

        .dt-side-label {
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          padding: 3px 12px;
          border-radius: 20px;
        }
        .dt-side-label-dragon {
          color: #e74c3c;
          background: rgba(192,57,43,0.12);
          border: 1px solid rgba(192,57,43,0.25);
        }
        .dt-side-label-tiger {
          color: #e67e22;
          background: rgba(211,84,0,0.12);
          border: 1px solid rgba(211,84,0,0.25);
        }
        .dt-side-label-win {
          color: #00e701;
          background: rgba(0,231,1,0.12);
          border: 1px solid rgba(0,231,1,0.3);
        }
        .dt-side-label-tie {
          color: #ffd700;
          background: rgba(255,215,0,0.12);
          border: 1px solid rgba(255,215,0,0.3);
        }

        .dt-card-wrapper {
          display: flex;
          justify-content: center;
          perspective: 900px;
        }

        /* Dealing slide-in animations */
        .dt-card-dealing {
          animation: dt-deal-left 0.5s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        .dt-card-dealing-right {
          animation: dt-deal-right 0.5s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        @keyframes dt-deal-left {
          from { opacity: 0; transform: translateX(-40px) scale(0.85); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes dt-deal-right {
          from { opacity: 0; transform: translateX(40px) scale(0.85); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }

        /* Card flip-in when revealing */
        .dt-card {
          transform-style: preserve-3d;
        }
        .dt-card-flip-in {
          animation: dt-flip-in 0.45s ease-out both;
        }
        @keyframes dt-flip-in {
          0%   { transform: rotateY(90deg) scale(0.92); opacity: 0.4; }
          100% { transform: rotateY(0deg) scale(1);    opacity: 1; }
        }

        .dt-card-rank-label {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-weight: 600;
          text-align: center;
        }

        /* ===== VS DIVIDER ===== */
        .dt-vs-divider {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
        }

        .dt-vs-text {
          font-size: 1.1rem;
          font-weight: 900;
          color: var(--text-muted);
          letter-spacing: 2px;
          padding: 8px 10px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--bg-tertiary);
          transition: color 0.4s, border-color 0.4s, box-shadow 0.4s;
        }
        .dt-vs-tie {
          color: #ffd700;
          border-color: rgba(255,215,0,0.4);
          box-shadow: 0 0 12px rgba(255,215,0,0.2);
        }

        /* ===== RESULT BANNER ===== */
        .dt-result-banner {
          text-align: center;
          padding: 1.25rem 1rem;
          border-radius: var(--radius);
        }

        .dt-result-win {
          background: rgba(0,231,1,0.08);
          border: 1px solid rgba(0,231,1,0.25);
          animation: dt-win-pulse 1s ease-in-out 3;
        }
        .dt-result-lose {
          background: rgba(220,38,38,0.08);
          border: 1px solid rgba(220,38,38,0.25);
          animation: dt-lose-shake 0.5s ease-in-out;
        }

        @keyframes dt-win-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,231,1,0); }
          50%       { box-shadow: 0 0 28px 4px rgba(0,231,1,0.18); }
        }
        @keyframes dt-lose-shake {
          0%, 100% { transform: translateX(0); }
          15%      { transform: translateX(-7px); }
          35%      { transform: translateX(7px); }
          55%      { transform: translateX(-4px); }
          75%      { transform: translateX(4px); }
        }

        .dt-result-icon {
          font-size: 2.2rem;
          margin-bottom: 0.35rem;
          line-height: 1;
        }
        .dt-result-win .dt-result-icon  { color: #00e701; }
        .dt-result-lose .dt-result-icon { color: #dc2626; }

        .dt-result-title {
          font-size: 1.5rem;
          font-weight: 900;
          margin-bottom: 0.2rem;
        }
        .dt-result-win .dt-result-title  { color: #00e701; }
        .dt-result-lose .dt-result-title { color: #dc2626; }

        .dt-result-payout {
          font-size: 1.9rem;
          font-weight: 900;
          color: #00e701;
          font-family: var(--font-mono);
          margin-bottom: 0.2rem;
        }
        .dt-result-sub {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        /* ===== HISTORY ===== */
        .dt-history-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 0.9rem 1.1rem;
          margin-top: 0.25rem;
        }

        .dt-history-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
          margin-bottom: 0.6rem;
        }

        .dt-history-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 480px) {
          .dt-preview-title {
            font-size: 1.7rem;
            letter-spacing: 3px;
          }
          .dt-preview-subtitle {
            font-size: 0.8rem;
          }
          .dt-bet-buttons {
            grid-template-columns: 1fr 0.65fr 1fr;
            gap: 0.45rem;
          }
          .dt-btn-emoji { font-size: 1.5rem; }
          .dt-btn-label { font-size: 0.7rem; letter-spacing: 1px; }
          .dt-btn-mult  { font-size: 0.68rem; }
          .dt-vs-text   { font-size: 0.9rem; padding: 6px 8px; }
        }
      `}</style>
    </div>
  );
}
