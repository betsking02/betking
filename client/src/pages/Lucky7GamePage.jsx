import { useState, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { playLucky7 } from '../api/casino';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

const L7_RULES = [
  'Place your bet on Under 7, Lucky 7, or Over 7.',
  'One card is drawn from the deck.',
  'Ace counts as 1. Jack=11, Queen=12, King=13.',
  'Under 7: card value is 1-6 (A to 6).',
  'Lucky 7: card value is exactly 7.',
  'Over 7: card value is 8-13 (8 to K).',
  'Under/Over pays 1.94x. Lucky 7 pays 11x!',
];

const L7_PAYOUTS = [
  { label: 'Under 7 (A-6)', value: '1.94x' },
  { label: 'Lucky 7', value: '11x' },
  { label: 'Over 7 (8-K)', value: '1.94x' },
  { label: 'Chance of Lucky 7', value: '1 in 13' },
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

/* ── Playing Card Component ─────────────────────────────────── */
function PlayingCard({ card, faceDown = false, flipping = false }) {
  const cardWidth = 140;
  const cardHeight = 196;

  if (faceDown) {
    return (
      <div
        className={`l7-card${flipping ? ' l7-card-flipping' : ''}`}
        style={{
          width: cardWidth,
          height: cardHeight,
          borderRadius: 14,
          border: '2px solid rgba(255,215,0,0.25)',
          background: 'linear-gradient(145deg, #0d1b4a, #1a2c6e)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Pattern grid */}
        <div style={{
          position: 'absolute',
          inset: 8,
          backgroundImage: `repeating-linear-gradient(
            45deg,
            rgba(255,215,0,0.06) 0px,
            rgba(255,215,0,0.06) 2px,
            transparent 2px,
            transparent 12px
          ), repeating-linear-gradient(
            -45deg,
            rgba(255,215,0,0.06) 0px,
            rgba(255,215,0,0.06) 2px,
            transparent 2px,
            transparent 12px
          )`,
          borderRadius: 8,
          border: '1px solid rgba(255,215,0,0.12)',
        }} />
        <span style={{
          fontSize: '2.8rem',
          color: 'rgba(255,215,0,0.35)',
          position: 'relative',
          zIndex: 1,
          filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.2))',
        }}>7</span>
      </div>
    );
  }

  if (!card) return null;

  const suitSymbol = SUIT_SYMBOLS[card.suit] || '';
  const suitColor = SUIT_COLORS[card.suit] || '#1a1a2e';

  return (
    <div
      className={`l7-card l7-card-revealed${flipping ? ' l7-card-flip-in' : ''}`}
      style={{
        width: cardWidth,
        height: cardHeight,
        background: 'linear-gradient(145deg, #ffffff, #f0f0f0)',
        borderRadius: 14,
        border: '2px solid rgba(255,255,255,0.15)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        flexShrink: 0,
      }}
    >
      {/* Top-left */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
      }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: suitColor, fontFamily: 'Georgia, serif' }}>
          {card.value}
        </span>
        <span style={{ fontSize: '1rem', color: suitColor, marginTop: -2 }}>{suitSymbol}</span>
      </div>

      {/* Center suit */}
      <span style={{ fontSize: '3.5rem', color: suitColor, lineHeight: 1 }}>{suitSymbol}</span>

      {/* Bottom-right (inverted) */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        right: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
        transform: 'rotate(180deg)',
      }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: suitColor, fontFamily: 'Georgia, serif' }}>
          {card.value}
        </span>
        <span style={{ fontSize: '1rem', color: suitColor, marginTop: -2 }}>{suitSymbol}</span>
      </div>
    </div>
  );
}

/* ── History Badge Component ────────────────────────────────── */
function HistoryBadge({ result }) {
  if (result === 'lucky7') {
    return (
      <div className="l7-history-badge l7-badge-lucky">
        <span>7</span>
      </div>
    );
  }
  if (result === 'under') {
    return (
      <div className="l7-history-badge l7-badge-under">
        <span>U</span>
      </div>
    );
  }
  return (
    <div className="l7-history-badge l7-badge-over">
      <span>O</span>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function Lucky7GamePage() {
  const { user, updateBalance } = useContext(AuthContext);
  const [stake, setStake] = useState(BET_AMOUNTS[0]);
  const [selectedBet, setSelectedBet] = useState(null); // 'under' | 'lucky7' | 'over'
  const [result, setResult] = useState(null);           // API result object
  const [loading, setLoading] = useState(false);
  const [dealing, setDealing] = useState(false);        // card flip animation phase
  const [history, setHistory] = useState([]);            // array of result strings

  const isLucky7Win = result && result.won && result.result === 'lucky7';
  const isRegularWin = result && result.won && result.result !== 'lucky7';
  const isLoss = result && !result.won;

  const handlePlay = useCallback(async () => {
    if (!user) return toast.error('Please login first');
    if (!selectedBet) return toast.error('Select Under 7, Lucky 7, or Over 7 first');
    if (stake > (user?.balance || 0)) return toast.error('Insufficient balance');

    setLoading(true);
    setResult(null);
    setDealing(true);   // show face-down card spinning

    try {
      // Give the spin animation a moment to show before the API resolves
      const [res] = await Promise.all([
        playLucky7(stake, selectedBet),
        new Promise(resolve => setTimeout(resolve, 800)),
      ]);

      const data = res.data || res;
      setDealing(false);

      // Brief pause at edge-on moment before flip-in
      await new Promise(resolve => setTimeout(resolve, 120));

      setResult(data);
      setHistory(prev => [data.result, ...prev].slice(0, 8));

      if (data.balance != null) updateBalance(data.balance);

      if (data.won) {
        if (data.result === 'lucky7') {
          toast.success(`LUCKY 7! You won ${formatCurrency(data.payout)}!`, { duration: 4000 });
        } else {
          toast.success(`You won ${formatCurrency(data.payout)}!`);
        }
      } else {
        toast.error('Better luck next time!');
      }
    } catch (err) {
      setDealing(false);
      toast.error(err.response?.data?.error || 'Failed to play');
    }

    setLoading(false);
  }, [user, stake, selectedBet, updateBalance]);

  const handlePlayAgain = () => {
    setResult(null);
    setDealing(false);
    setSelectedBet(null);
  };

  const showCard = dealing || result;
  const cardPhase = dealing ? 'facedown' : result ? 'revealed' : null;

  return (
    <div className="casino-game-page" style={{ maxWidth: 600 }}>
      <h1>&#127183; Lucky 7</h1>

      <GameRulesModal
        gameKey="lucky7"
        title="How to Play Lucky 7"
        rules={L7_RULES}
        payouts={L7_PAYOUTS}
      />

      {/* ====== PREVIEW SECTION ====== */}
      {!result && !dealing && (
        <div className="l7-setup">
          <div className="l7-preview">
            {/* Faded cards left: A-6 */}
            <div className="l7-preview-side l7-preview-left">
              {['A','2','3','4','5','6'].map((v, i) => (
                <div
                  key={v}
                  className="l7-preview-mini-card"
                  style={{ opacity: 0.18 + i * 0.04, transform: `rotate(${-15 + i * 4}deg) translateY(${Math.abs(i - 2.5) * 4}px)` }}
                >
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1a1a2e' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Center golden 7 */}
            <div className="l7-preview-center">
              <div className="l7-golden-seven">7</div>
              <div className="l7-preview-title">LUCKY 7</div>
              <div className="l7-preview-subtitle">Under, Lucky 7, or Over?</div>
            </div>

            {/* Faded card right: K */}
            <div className="l7-preview-side l7-preview-right">
              {['8','9','10','J','Q','K'].map((v, i) => (
                <div
                  key={v}
                  className="l7-preview-mini-card"
                  style={{ opacity: 0.35 - i * 0.04, transform: `rotate(${4 + i * 4}deg) translateY(${Math.abs(i - 2.5) * 4}px)` }}
                >
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#dc2626' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stake Selector */}
          <div className="l7-controls-wrap">
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

            {/* 3 Bet Buttons */}
            <div className="l7-bet-grid">
              {/* UNDER 7 */}
              <button
                className={`l7-bet-btn l7-bet-under${selectedBet === 'under' ? ' l7-bet-selected' : ''}`}
                onClick={() => setSelectedBet(prev => prev === 'under' ? null : 'under')}
              >
                <div className="l7-bet-symbol">&lt; 7</div>
                <div className="l7-bet-label">UNDER 7</div>
                <div className="l7-bet-cards">A &middot; 2 &middot; 3 &middot; 4 &middot; 5 &middot; 6</div>
                <div className="l7-bet-pays">Pays 1.94x</div>
                <div className="l7-bet-odds">6/13 chance</div>
              </button>

              {/* LUCKY 7 */}
              <button
                className={`l7-bet-btn l7-bet-lucky${selectedBet === 'lucky7' ? ' l7-bet-selected' : ''}`}
                onClick={() => setSelectedBet(prev => prev === 'lucky7' ? null : 'lucky7')}
              >
                <div className="l7-lucky-sparkle-row">
                  <span className="l7-sparkle">&#10024;</span>
                  <div className="l7-lucky-num">7</div>
                  <span className="l7-sparkle">&#10024;</span>
                </div>
                <div className="l7-bet-label">LUCKY 7</div>
                <div className="l7-bet-pays l7-pays-big">Pays 11x</div>
                <div className="l7-bet-odds">1/13 chance</div>
              </button>

              {/* OVER 7 */}
              <button
                className={`l7-bet-btn l7-bet-over${selectedBet === 'over' ? ' l7-bet-selected' : ''}`}
                onClick={() => setSelectedBet(prev => prev === 'over' ? null : 'over')}
              >
                <div className="l7-bet-symbol">&gt; 7</div>
                <div className="l7-bet-label">OVER 7</div>
                <div className="l7-bet-cards">8 &middot; 9 &middot; 10 &middot; J &middot; Q &middot; K</div>
                <div className="l7-bet-pays">Pays 1.94x</div>
                <div className="l7-bet-odds">6/13 chance</div>
              </button>
            </div>

            {/* PLAY Button */}
            <button
              className={`l7-play-btn${selectedBet ? ' l7-play-ready' : ''}`}
              onClick={handlePlay}
              disabled={loading || !selectedBet || !user || stake > (user?.balance || 0)}
            >
              {loading
                ? 'Dealing...'
                : selectedBet
                  ? `PLAY — ${formatCurrency(stake)}`
                  : 'SELECT A BET TO PLAY'
              }
            </button>
          </div>
        </div>
      )}

      {/* ====== DEALING / RESULT AREA ====== */}
      {showCard && (
        <div className={`l7-game-area${isLucky7Win ? ' l7-lucky-win-bg' : ''}`}>

          {/* Result Banner — only shown after reveal */}
          {result && (
            <div className={`l7-result-banner${isLucky7Win ? ' l7-banner-lucky' : isRegularWin ? ' l7-banner-win' : ' l7-banner-loss'}`}>
              {isLucky7Win && (
                <>
                  <div className="l7-sparkles-row">
                    <span>&#10024;</span><span>&#10024;</span><span>&#10024;</span>
                    <span>&#10024;</span><span>&#10024;</span>
                  </div>
                  <div className="l7-result-icon">&#127881;</div>
                  <div className="l7-result-title">LUCKY 7!</div>
                  <div className="l7-result-payout">+{formatCurrency(result.payout)}</div>
                  <div className="l7-result-sub">{result.multiplier}x multiplier</div>
                  <div className="l7-sparkles-row">
                    <span>&#10024;</span><span>&#10024;</span><span>&#10024;</span>
                    <span>&#10024;</span><span>&#10024;</span>
                  </div>
                </>
              )}
              {isRegularWin && (
                <>
                  <div className="l7-result-icon">&#9989;</div>
                  <div className="l7-result-title">You Won!</div>
                  <div className="l7-result-payout">+{formatCurrency(result.payout)}</div>
                  <div className="l7-result-sub">{result.multiplier}x &mdash; {result.result === 'under' ? 'Under 7' : 'Over 7'}</div>
                </>
              )}
              {isLoss && (
                <>
                  <div className="l7-result-icon">&#10060;</div>
                  <div className="l7-result-title">No Luck</div>
                  <div className="l7-result-sub">
                    Card was {result.card?.display} &mdash; That&apos;s {result.result === 'under' ? 'Under' : result.result === 'lucky7' ? 'Lucky 7' : 'Over'} 7
                  </div>
                </>
              )}
            </div>
          )}

          {/* Dealing label */}
          {dealing && (
            <div className="l7-dealing-label">Drawing card...</div>
          )}

          {/* Card Area */}
          <div className="l7-card-stage">
            {cardPhase === 'facedown' && (
              <div className="l7-card-spin-wrap">
                <PlayingCard faceDown={true} flipping={true} />
              </div>
            )}
            {cardPhase === 'revealed' && result?.card && (
              <div className="l7-card-reveal-wrap">
                <PlayingCard card={result.card} flipping={true} />
                {result && (
                  <div className="l7-card-label-below">
                    {result.card.display}
                    {' '}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8em' }}>
                      (value: {result.card.numericValue})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Result detail + Play Again */}
          {result && (
            <>
              <button className="l7-again-btn" onClick={handlePlayAgain}>
                PLAY AGAIN
              </button>

              {/* History */}
              {history.length > 0 && (
                <div className="l7-history-row">
                  <div className="l7-history-label">Recent Results</div>
                  <div className="l7-history-badges">
                    {history.map((r, i) => (
                      <HistoryBadge key={i} result={r} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* History strip visible on pre-game screen too */}
      {!showCard && history.length > 0 && (
        <div className="l7-history-strip">
          <div className="l7-history-label">Recent Results</div>
          <div className="l7-history-badges">
            {history.map((r, i) => (
              <HistoryBadge key={i} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────── CSS ────────────────────── */}
      <style>{`
        /* ── CSS Custom Properties (mirrors app theme) ── */
        /* fallback values keep it self-contained */

        /* ══ SETUP / PREVIEW ══════════════════════════════ */
        .l7-setup {
          background: var(--bg-card, #0e1b2a);
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          border-radius: var(--radius-lg, 16px);
          overflow: hidden;
        }

        /* Preview Banner */
        .l7-preview {
          position: relative;
          min-height: 200px;
          background: linear-gradient(145deg, #050d1a, #0d1b3a);
          border-bottom: 1px solid rgba(255,215,0,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          overflow: hidden;
          padding: 1.5rem;
        }
        .l7-preview::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 80% at 50% 50%, rgba(255,215,0,0.06), transparent 70%);
          pointer-events: none;
        }

        .l7-preview-side {
          display: flex;
          gap: -8px;
          align-items: center;
          flex: 1;
        }
        .l7-preview-left {
          justify-content: flex-end;
          padding-right: 0.75rem;
        }
        .l7-preview-right {
          justify-content: flex-start;
          padding-left: 0.75rem;
        }

        .l7-preview-mini-card {
          width: 34px;
          height: 48px;
          background: linear-gradient(145deg, #fff, #ececec);
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          margin: 0 -6px;
          position: relative;
        }

        /* Center piece */
        .l7-preview-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 2;
          flex-shrink: 0;
          text-align: center;
        }

        .l7-golden-seven {
          font-size: 5rem;
          font-weight: 900;
          font-family: 'Georgia', serif;
          line-height: 1;
          background: linear-gradient(135deg, #fff7a0, #ffd700, #e67e22, #ffd700);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 18px rgba(255,215,0,0.6)) drop-shadow(0 0 36px rgba(255,150,0,0.3));
          animation: l7-seven-glow 2.5s ease-in-out infinite;
          margin-bottom: 0.25rem;
        }
        @keyframes l7-seven-glow {
          0%, 100% { filter: drop-shadow(0 0 16px rgba(255,215,0,0.55)) drop-shadow(0 0 32px rgba(255,150,0,0.25)); }
          50%       { filter: drop-shadow(0 0 28px rgba(255,215,0,0.85)) drop-shadow(0 0 56px rgba(255,150,0,0.45)); }
        }

        .l7-preview-title {
          font-size: 1.6rem;
          font-weight: 900;
          letter-spacing: 6px;
          background: linear-gradient(135deg, #ffd700, #e67e22);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.2rem;
        }
        .l7-preview-subtitle {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.5);
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        /* ══ CONTROLS ══════════════════════════════════════ */
        .l7-controls-wrap {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* ── Bet Grid ── */
        .l7-bet-grid {
          display: grid;
          grid-template-columns: 1fr 1.15fr 1fr;
          gap: 0.6rem;
        }

        .l7-bet-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          padding: 0.9rem 0.5rem;
          border-radius: 14px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          position: relative;
          overflow: hidden;
          text-align: center;
        }
        .l7-bet-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.2s;
          border-radius: 12px;
        }
        .l7-bet-btn:hover:not(:disabled)::before {
          opacity: 1;
        }

        /* UNDER */
        .l7-bet-under {
          background: linear-gradient(145deg, #0e2a4a, #091d35);
          border-color: rgba(29,161,242,0.2);
          color: #5bc8f5;
        }
        .l7-bet-under::before {
          background: linear-gradient(145deg, rgba(29,161,242,0.08), transparent);
        }
        .l7-bet-under:hover:not(:disabled) {
          border-color: rgba(29,161,242,0.5);
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(29,161,242,0.2);
        }
        .l7-bet-under.l7-bet-selected {
          border-color: #1da1f2 !important;
          background: linear-gradient(145deg, #0e2a4a, #0b2040) !important;
          box-shadow: 0 0 0 3px rgba(29,161,242,0.25), 0 6px 24px rgba(29,161,242,0.3) !important;
          transform: translateY(-3px);
        }

        /* LUCKY */
        .l7-bet-lucky {
          background: linear-gradient(145deg, #2a1e00, #1a1200);
          border-color: rgba(255,215,0,0.25);
          color: #ffd700;
        }
        .l7-bet-lucky::before {
          background: linear-gradient(145deg, rgba(255,215,0,0.1), transparent);
        }
        .l7-bet-lucky:hover:not(:disabled) {
          border-color: rgba(255,215,0,0.6);
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 6px 24px rgba(255,215,0,0.3);
        }
        .l7-bet-lucky.l7-bet-selected {
          border-color: #ffd700 !important;
          background: linear-gradient(145deg, #2e2000, #1e1600) !important;
          box-shadow: 0 0 0 3px rgba(255,215,0,0.3), 0 6px 28px rgba(255,215,0,0.4) !important;
          transform: translateY(-3px) scale(1.02);
          animation: l7-lucky-pulse 1.8s ease-in-out infinite;
        }
        @keyframes l7-lucky-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(255,215,0,0.3), 0 6px 28px rgba(255,215,0,0.4); }
          50%       { box-shadow: 0 0 0 5px rgba(255,215,0,0.15), 0 8px 36px rgba(255,215,0,0.55); }
        }

        /* OVER */
        .l7-bet-over {
          background: linear-gradient(145deg, #2a0e0e, #1a0707);
          border-color: rgba(220,38,38,0.2);
          color: #f87171;
        }
        .l7-bet-over::before {
          background: linear-gradient(145deg, rgba(220,38,38,0.08), transparent);
        }
        .l7-bet-over:hover:not(:disabled) {
          border-color: rgba(220,38,38,0.5);
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(220,38,38,0.2);
        }
        .l7-bet-over.l7-bet-selected {
          border-color: #dc2626 !important;
          background: linear-gradient(145deg, #2e1010, #200808) !important;
          box-shadow: 0 0 0 3px rgba(220,38,38,0.25), 0 6px 24px rgba(220,38,38,0.3) !important;
          transform: translateY(-3px);
        }

        /* Bet button internals */
        .l7-bet-symbol {
          font-size: 1.5rem;
          font-weight: 900;
          line-height: 1;
          font-family: 'Georgia', serif;
        }
        .l7-bet-label {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          opacity: 0.9;
        }
        .l7-bet-cards {
          font-size: 0.6rem;
          opacity: 0.6;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .l7-bet-pays {
          font-size: 0.72rem;
          font-weight: 800;
          opacity: 0.85;
          font-family: var(--font-mono, monospace);
        }
        .l7-pays-big {
          font-size: 0.8rem;
          color: #ffd700;
          opacity: 1;
        }
        .l7-bet-odds {
          font-size: 0.58rem;
          opacity: 0.5;
          font-weight: 600;
        }

        /* Lucky 7 number in bet button */
        .l7-lucky-sparkle-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .l7-lucky-num {
          font-size: 2rem;
          font-weight: 900;
          font-family: 'Georgia', serif;
          background: linear-gradient(135deg, #fff7a0, #ffd700, #e67e22);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
          filter: drop-shadow(0 0 6px rgba(255,215,0,0.4));
        }
        .l7-sparkle {
          font-size: 0.85rem;
          line-height: 1;
          animation: l7-sparkle-spin 2s linear infinite;
        }
        .l7-sparkle:last-child {
          animation-direction: reverse;
          animation-duration: 1.5s;
        }
        @keyframes l7-sparkle-spin {
          0%   { transform: rotate(0deg) scale(1); opacity: 0.8; }
          50%  { transform: rotate(180deg) scale(1.2); opacity: 1; }
          100% { transform: rotate(360deg) scale(1); opacity: 0.8; }
        }

        /* ── PLAY Button ── */
        .l7-play-btn {
          width: 100%;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: 1px;
          cursor: pointer;
          border: none;
          font-family: inherit;
          transition: all 0.2s;
          background: var(--bg-tertiary, #1a2535);
          color: var(--text-muted, rgba(255,255,255,0.4));
          border: 2px solid var(--border-color, rgba(255,255,255,0.08));
        }
        .l7-play-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .l7-play-ready {
          background: linear-gradient(135deg, #1a6b3a, #0d4824) !important;
          border-color: rgba(0,231,1,0.35) !important;
          color: #00e701 !important;
          animation: l7-play-pulse 1.8s ease-in-out infinite;
        }
        .l7-play-ready:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0,231,1,0.25);
        }
        .l7-play-ready:active:not(:disabled) {
          transform: translateY(0);
        }
        @keyframes l7-play-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,231,1,0.2); }
          50%       { box-shadow: 0 0 20px 4px rgba(0,231,1,0.15); }
        }

        /* ══ GAME AREA ═════════════════════════════════════ */
        .l7-game-area {
          background: var(--bg-card, #0e1b2a);
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          border-radius: var(--radius-lg, 16px);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          align-items: center;
        }
        .l7-lucky-win-bg {
          background: linear-gradient(145deg, #1a1200, #0e1b2a) !important;
          border-color: rgba(255,215,0,0.2) !important;
          box-shadow: 0 0 60px rgba(255,215,0,0.08);
        }

        /* ── Result Banners ── */
        .l7-result-banner {
          width: 100%;
          padding: 1.25rem 1rem;
          border-radius: 14px;
          text-align: center;
        }
        .l7-banner-lucky {
          background: linear-gradient(145deg, rgba(255,215,0,0.12), rgba(230,126,34,0.08));
          border: 2px solid rgba(255,215,0,0.4);
          animation: l7-lucky-banner-in 0.5s ease-out, l7-lucky-banner-glow 2s ease-in-out infinite 0.5s;
        }
        @keyframes l7-lucky-banner-in {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes l7-lucky-banner-glow {
          0%, 100% { box-shadow: 0 0 12px rgba(255,215,0,0.2); }
          50%       { box-shadow: 0 0 32px rgba(255,215,0,0.45); }
        }
        .l7-banner-win {
          background: rgba(0,231,1,0.08);
          border: 1px solid rgba(0,231,1,0.25);
          animation: l7-banner-in 0.4s ease-out;
        }
        .l7-banner-loss {
          background: rgba(220,38,38,0.08);
          border: 1px solid rgba(220,38,38,0.25);
          animation: l7-banner-in 0.4s ease-out;
        }
        @keyframes l7-banner-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .l7-sparkles-row {
          font-size: 1.1rem;
          letter-spacing: 6px;
          animation: l7-sparkles-dance 1s ease-in-out infinite alternate;
          margin: 0.25rem 0;
        }
        @keyframes l7-sparkles-dance {
          from { letter-spacing: 4px; }
          to   { letter-spacing: 10px; }
        }

        .l7-result-icon {
          font-size: 2.2rem;
          line-height: 1;
          margin: 0.25rem 0;
        }
        .l7-banner-lucky .l7-result-icon {
          font-size: 2.8rem;
          animation: l7-icon-bounce 0.6s ease-out 0.3s both;
        }
        @keyframes l7-icon-bounce {
          0%   { transform: scale(0) rotate(-15deg); }
          60%  { transform: scale(1.2) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .l7-result-title {
          font-size: 1.5rem;
          font-weight: 900;
          margin-bottom: 0.2rem;
        }
        .l7-banner-lucky .l7-result-title {
          font-size: 2rem;
          background: linear-gradient(135deg, #fff7a0, #ffd700, #e67e22);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 2px;
        }
        .l7-banner-win .l7-result-title  { color: #00e701; }
        .l7-banner-loss .l7-result-title { color: #dc2626; }
        .l7-result-payout {
          font-size: 1.75rem;
          font-weight: 900;
          font-family: var(--font-mono, monospace);
          margin: 0.2rem 0;
        }
        .l7-banner-lucky .l7-result-payout { color: #ffd700; }
        .l7-banner-win .l7-result-payout   { color: #00e701; }
        .l7-result-sub {
          font-size: 0.82rem;
          color: rgba(255,255,255,0.55);
          font-weight: 600;
        }

        /* ── Dealing Label ── */
        .l7-dealing-label {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.5);
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          animation: l7-blink 1s ease-in-out infinite;
        }
        @keyframes l7-blink {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }

        /* ── Card Stage ── */
        .l7-card-stage {
          display: flex;
          justify-content: center;
          perspective: 900px;
          min-height: 196px;
        }
        .l7-card-spin-wrap {
          animation: l7-spin-deal 0.9s ease-in-out infinite;
        }
        @keyframes l7-spin-deal {
          0%   { transform: rotateY(0deg) scale(1); }
          25%  { transform: rotateY(90deg) scale(0.95); }
          50%  { transform: rotateY(0deg) scale(1.02); }
          75%  { transform: rotateY(-90deg) scale(0.95); }
          100% { transform: rotateY(0deg) scale(1); }
        }

        .l7-card {
          display: block;
          transition: box-shadow 0.3s;
        }
        .l7-card-flipping {
          /* used on face-down card during deal */
        }
        .l7-card-flip-in {
          animation: l7-flip-reveal 0.55s cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
        @keyframes l7-flip-reveal {
          0%   { transform: rotateY(90deg) scale(0.9); opacity: 0.3; }
          60%  { transform: rotateY(-8deg) scale(1.04); opacity: 1; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        .l7-card-revealed {
          /* revealed card gets extra shadow matching result */
        }

        .l7-card-label-below {
          margin-top: 0.6rem;
          text-align: center;
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-primary, #fff);
          font-family: var(--font-mono, monospace);
        }
        .l7-card-reveal-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* ── Play Again Button ── */
        .l7-again-btn {
          width: 100%;
          max-width: 340px;
          padding: 0.9rem 1.5rem;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 800;
          letter-spacing: 1px;
          cursor: pointer;
          border: none;
          font-family: inherit;
          background: linear-gradient(135deg, #1a3a5c, #0e2540);
          color: #5bc8f5;
          border: 1px solid rgba(29,161,242,0.3);
          transition: all 0.2s;
        }
        .l7-again-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(29,161,242,0.2);
          border-color: rgba(29,161,242,0.55);
        }
        .l7-again-btn:active {
          transform: translateY(0);
        }

        /* ══ HISTORY ═══════════════════════════════════════ */
        .l7-history-strip {
          background: var(--bg-card, #0e1b2a);
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          border-radius: var(--radius-lg, 16px);
          padding: 0.85rem 1.25rem;
          margin-top: 0.75rem;
        }
        .l7-history-row {
          width: 100%;
        }
        .l7-history-label {
          font-size: 0.65rem;
          color: var(--text-muted, rgba(255,255,255,0.4));
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .l7-history-badges {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .l7-history-badge {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 900;
          flex-shrink: 0;
        }
        .l7-badge-under {
          background: rgba(29,161,242,0.18);
          border: 1px solid rgba(29,161,242,0.35);
          color: #5bc8f5;
        }
        .l7-badge-lucky {
          background: rgba(255,215,0,0.15);
          border: 1px solid rgba(255,215,0,0.4);
          color: #ffd700;
          box-shadow: 0 0 6px rgba(255,215,0,0.15);
        }
        .l7-badge-over {
          background: rgba(220,38,38,0.15);
          border: 1px solid rgba(220,38,38,0.3);
          color: #f87171;
        }

        /* ══ RESPONSIVE ════════════════════════════════════ */
        @media (max-width: 480px) {
          .l7-bet-grid {
            grid-template-columns: 1fr 1.1fr 1fr;
            gap: 0.45rem;
          }
          .l7-bet-btn {
            padding: 0.75rem 0.3rem;
          }
          .l7-bet-symbol {
            font-size: 1.25rem;
          }
          .l7-lucky-num {
            font-size: 1.6rem;
          }
          .l7-bet-label {
            font-size: 0.6rem;
            letter-spacing: 0.5px;
          }
          .l7-bet-cards {
            display: none;
          }
          .l7-preview {
            min-height: 160px;
            padding: 1rem;
          }
          .l7-golden-seven {
            font-size: 3.8rem;
          }
          .l7-preview-title {
            font-size: 1.2rem;
            letter-spacing: 4px;
          }
          .l7-preview-mini-card {
            width: 26px;
            height: 36px;
          }
          .l7-preview-mini-card span {
            font-size: 0.7rem !important;
          }
          .l7-banner-lucky .l7-result-title {
            font-size: 1.6rem;
          }
          .l7-result-payout {
            font-size: 1.4rem;
          }
        }
      `}</style>
    </div>
  );
}
