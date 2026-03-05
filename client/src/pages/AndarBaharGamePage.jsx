import { useState, useContext, useCallback, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { playAndarBahar } from '../api/casino';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

const AB_RULES = [
  'Place your bet on Andar (अंदर) or Bahar (बाहर).',
  'A Joker card is placed face-up in the center.',
  'Cards are dealt alternately to Andar and Bahar sides.',
  'The first card matching the Joker\'s value wins!',
  'Both Andar and Bahar pay 1.9x your stake.',
  'Andar is dealt first in each round.',
];

const AB_PAYOUTS = [
  { label: 'Andar wins', value: '1.9x' },
  { label: 'Bahar wins', value: '1.9x' },
  { label: 'Average cards dealt', value: '~6-8 cards' },
];

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const isRedSuit = (suit) => suit === 'hearts' || suit === 'diamonds';

// PlayingCard component
function PlayingCard({ card, size = 'small', highlight = false, faceDown = false, style = {} }) {
  const isLarge = size === 'large';
  const width = isLarge ? 120 : 40;
  const height = isLarge ? 168 : 56;
  const fontSize = isLarge ? '1.4rem' : '0.6rem';
  const suitSize = isLarge ? '2.2rem' : '1rem';
  const red = card && isRedSuit(card.suit);

  const cardStyle = {
    width,
    height,
    minWidth: width,
    background: faceDown
      ? 'linear-gradient(135deg, #1a237e 25%, #283593 75%)'
      : '#fff',
    borderRadius: isLarge ? 10 : 5,
    border: highlight
      ? '2px solid #ffd700'
      : faceDown
      ? '2px solid #1a237e'
      : '1.5px solid #ccc',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: highlight
      ? '0 0 14px rgba(255,215,0,0.65), 0 2px 8px rgba(0,0,0,0.35)'
      : '0 2px 6px rgba(0,0,0,0.3)',
    position: 'relative',
    flexShrink: 0,
    transition: 'all 0.25s ease',
    ...style,
  };

  if (faceDown) {
    return (
      <div style={cardStyle}>
        <div style={{
          width: '70%',
          height: '70%',
          border: '2px solid rgba(255,255,255,0.15)',
          borderRadius: 4,
          background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 2px, transparent 2px, transparent 8px)',
        }} />
      </div>
    );
  }

  if (!card) return null;

  const textColor = red ? '#d32f2f' : '#1a1a2e';

  return (
    <div style={cardStyle}>
      {/* Top-left rank */}
      <div style={{
        position: 'absolute',
        top: isLarge ? 6 : 2,
        left: isLarge ? 7 : 3,
        fontSize,
        fontWeight: 900,
        color: textColor,
        lineHeight: 1,
        fontFamily: 'var(--font-mono)',
      }}>
        {card.display || card.value}
      </div>

      {/* Center suit */}
      <div style={{
        fontSize: suitSize,
        color: textColor,
        lineHeight: 1,
      }}>
        {SUIT_SYMBOLS[card.suit] || card.suit}
      </div>

      {/* Bottom-right rank (rotated) */}
      <div style={{
        position: 'absolute',
        bottom: isLarge ? 6 : 2,
        right: isLarge ? 7 : 3,
        fontSize,
        fontWeight: 900,
        color: textColor,
        lineHeight: 1,
        transform: 'rotate(180deg)',
        fontFamily: 'var(--font-mono)',
      }}>
        {card.display || card.value}
      </div>

      {/* Highlight badge for matching card */}
      {highlight && (
        <div style={{
          position: 'absolute',
          top: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #ffd700, #e6ac00)',
          color: '#1a1a2e',
          fontSize: '0.5rem',
          fontWeight: 900,
          padding: '1px 4px',
          borderRadius: 3,
          whiteSpace: 'nowrap',
          letterSpacing: '0.5px',
        }}>
          MATCH
        </div>
      )}
    </div>
  );
}

export default function AndarBaharGamePage() {
  const { user, updateBalance } = useContext(AuthContext);

  const [stake, setStake] = useState(BET_AMOUNTS[0]);
  const [selectedBet, setSelectedBet] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Build interleaved card sequence from result
  const buildDealSequence = useCallback((result) => {
    if (!result) return [];
    const { andarCards = [], baharCards = [] } = result;
    const maxLen = Math.max(andarCards.length, baharCards.length);
    const sequence = [];
    for (let i = 0; i < maxLen; i++) {
      if (i < andarCards.length) sequence.push({ side: 'andar', card: andarCards[i], index: i });
      if (i < baharCards.length) sequence.push({ side: 'bahar', card: baharCards[i], index: i });
    }
    return sequence;
  }, []);

  const dealSequence = gameResult ? buildDealSequence(gameResult) : [];
  const totalCards = dealSequence.length;

  // Animate card dealing after result arrives
  useEffect(() => {
    if (!gameResult || totalCards === 0) return;

    setAnimating(true);
    setRevealedCount(0);

    let count = 0;
    const interval = setInterval(() => {
      count += 1;
      setRevealedCount(count);
      if (count >= totalCards) {
        clearInterval(interval);
        setAnimating(false);
      }
    }, 220);

    return () => clearInterval(interval);
  }, [gameResult, totalCards]);

  const handleBet = useCallback(async (bet) => {
    if (loading || animating) return;
    if (!user) return toast.error('Please login first');
    if (stake > (user?.balance || 0)) return toast.error('Insufficient balance');

    setSelectedBet(bet);
    setGameResult(null);
    setRevealedCount(0);
    setAnimating(false);
    setLoading(true);

    try {
      const res = await playAndarBahar(stake, bet);
      const data = res.data || res;
      const game = data.gameResult || data;

      if (data.balance !== undefined) {
        updateBalance(data.balance);
      }

      setGameResult(game);
      setHistory(prev => [
        { result: game.result, won: game.won },
        ...prev,
      ].slice(0, 8));

      if (game.won) {
        toast.success(`You won ${formatCurrency(data.payout)}!`);
      } else {
        toast.error(`${game.result === 'andar' ? 'ANDAR' : 'BAHAR'} wins! Better luck next time.`);
      }
    } catch (err) {
      setSelectedBet(null);
      toast.error(err.response?.data?.error || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  }, [loading, animating, user, stake, updateBalance]);

  const resetGame = useCallback(() => {
    setGameResult(null);
    setSelectedBet(null);
    setRevealedCount(0);
    setAnimating(false);
  }, []);

  const allRevealed = revealedCount >= totalCards && totalCards > 0;

  // How many andar / bahar cards are revealed
  const revealedAndar = dealSequence.slice(0, revealedCount).filter(s => s.side === 'andar').map(s => s.card);
  const revealedBahar = dealSequence.slice(0, revealedCount).filter(s => s.side === 'bahar').map(s => s.card);

  const winSide = gameResult?.result; // 'andar' | 'bahar'
  const totalDealt = (gameResult?.andarCards?.length || 0) + (gameResult?.baharCards?.length || 0);

  return (
    <div className="casino-game-page" style={{ maxWidth: 720 }}>
      <h1>Andar Bahar</h1>

      <GameRulesModal
        gameKey="andarbahar"
        title="How to Play Andar Bahar"
        rules={AB_RULES}
        payouts={AB_PAYOUTS}
      />

      {/* ── PREVIEW BANNER (shown always, dims when game is active) ── */}
      <div className="ab-banner" style={{ opacity: gameResult ? 0.55 : 1, transition: 'opacity 0.4s' }}>
        {/* Left side — Andar */}
        <div className="ab-banner-side ab-banner-side--andar">
          <div className="ab-banner-side-label">ANDAR</div>
          <div className="ab-banner-cards ab-banner-cards--left">
            {[0, 1, 2].map(i => (
              <div key={i} className="ab-banner-card-ghost" style={{ marginLeft: i === 0 ? 0 : -14, zIndex: i, opacity: 1 - i * 0.25 }} />
            ))}
          </div>
        </div>

        {/* Center joker placeholder */}
        <div className="ab-banner-center">
          <div className="ab-banner-joker-card">
            <div style={{ fontSize: '2rem', lineHeight: 1 }}>&#9733;</div>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, marginTop: 4, letterSpacing: 2, color: '#ffd700' }}>JOKER</div>
          </div>
        </div>

        {/* Right side — Bahar */}
        <div className="ab-banner-side ab-banner-side--bahar">
          <div className="ab-banner-cards ab-banner-cards--right">
            {[2, 1, 0].map(i => (
              <div key={i} className="ab-banner-card-ghost ab-banner-card-ghost--bahar" style={{ marginRight: i === 0 ? 0 : -14, zIndex: i, opacity: 1 - i * 0.25 }} />
            ))}
          </div>
          <div className="ab-banner-side-label" style={{ color: '#ff8c42' }}>BAHAR</div>
        </div>

        {/* Overlay title */}
        <div className="ab-banner-overlay">
          <div className="ab-banner-title">ANDAR BAHAR</div>
          <div className="ab-banner-subtitle">Classic Indian Card Game</div>
        </div>
      </div>

      {/* ── MAIN GAME CARD ── */}
      <div className="ab-main-card">

        {/* ---- PRE-GAME: Stake selector + bet buttons ---- */}
        {!gameResult && (
          <>
            {/* Stake selector */}
            <div className="stake-selector" style={{ marginBottom: '1.25rem' }}>
              <label>Bet Amount</label>
              <div className="stake-buttons">
                {BET_AMOUNTS.map(amt => (
                  <button
                    key={amt}
                    className={`btn btn-sm ${stake === amt ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setStake(amt)}
                    disabled={loading}
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>
            </div>

            {/* Bet buttons */}
            <div className="ab-bet-buttons">
              {/* ANDAR */}
              <button
                className={`ab-bet-btn ab-bet-btn--andar ${loading && selectedBet === 'andar' ? 'ab-bet-btn--loading' : ''}`}
                onClick={() => handleBet('andar')}
                disabled={loading}
              >
                <div className="ab-bet-btn-top">
                  <span className="ab-bet-hindi">अंदर</span>
                  <div className="ab-bet-stack ab-bet-stack--left">
                    {[2, 1, 0].map(i => (
                      <div key={i} className="ab-bet-stack-card" style={{ right: i * 6 }} />
                    ))}
                    <span className="ab-bet-arrow">&#8592;</span>
                  </div>
                </div>
                <div className="ab-bet-btn-name">ANDAR</div>
                <div className="ab-bet-payout">1.9x payout</div>
              </button>

              {/* BAHAR */}
              <button
                className={`ab-bet-btn ab-bet-btn--bahar ${loading && selectedBet === 'bahar' ? 'ab-bet-btn--loading' : ''}`}
                onClick={() => handleBet('bahar')}
                disabled={loading}
              >
                <div className="ab-bet-btn-top">
                  <div className="ab-bet-stack ab-bet-stack--right">
                    <span className="ab-bet-arrow">&#8594;</span>
                    {[0, 1, 2].map(i => (
                      <div key={i} className="ab-bet-stack-card ab-bet-stack-card--bahar" style={{ left: i * 6 }} />
                    ))}
                  </div>
                  <span className="ab-bet-hindi" style={{ color: '#ff8c42' }}>बाहर</span>
                </div>
                <div className="ab-bet-btn-name" style={{ color: '#ff8c42' }}>BAHAR</div>
                <div className="ab-bet-payout">1.9x payout</div>
              </button>
            </div>

            {loading && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem', fontWeight: 600 }}>
                Dealing cards...
              </div>
            )}
          </>
        )}

        {/* ---- GAME AREA (after API response) ---- */}
        {gameResult && (
          <>
            {/* Joker Card — always visible immediately */}
            <div className="ab-joker-area">
              <div className="ab-joker-label">JOKER CARD</div>
              <div className="ab-joker-wrapper">
                <PlayingCard card={gameResult.joker} size="large" style={{
                  border: '2px solid #ffd700',
                  boxShadow: '0 0 24px rgba(255,215,0,0.6), 0 0 48px rgba(255,215,0,0.25)',
                }} />
              </div>
              <div className="ab-joker-value">
                Value: <strong style={{ color: 'var(--accent-gold)' }}>{gameResult.joker?.display || gameResult.joker?.value}</strong>
                &nbsp;{SUIT_SYMBOLS[gameResult.joker?.suit]}
              </div>
            </div>

            {/* Dealing area — Andar | Bahar split */}
            <div className="ab-dealing-area">
              {/* ANDAR side */}
              <div className="ab-side ab-side--andar">
                <div className="ab-side-label ab-side-label--andar">
                  ANDAR <span style={{ fontSize: '0.75em', opacity: 0.8 }}>अंदर</span>
                  {winSide === 'andar' && allRevealed && (
                    <span className="ab-winner-badge ab-winner-badge--andar">WIN</span>
                  )}
                </div>
                <div className="ab-cards-row ab-cards-row--andar">
                  {revealedAndar.map((card, idx) => {
                    const isLast = idx === revealedAndar.length - 1 && winSide === 'andar' && allRevealed;
                    return (
                      <div key={idx} className="ab-card-slide-in">
                        <PlayingCard
                          card={card}
                          size="small"
                          highlight={isLast}
                        />
                      </div>
                    );
                  })}
                  {/* Placeholder if no cards yet */}
                  {revealedAndar.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                      Waiting...
                    </div>
                  )}
                </div>
                <div className="ab-side-count">
                  {revealedAndar.length} card{revealedAndar.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Center divider */}
              <div className="ab-center-divider">
                <div className="ab-divider-line" />
                <div className="ab-divider-dot">VS</div>
                <div className="ab-divider-line" />
              </div>

              {/* BAHAR side */}
              <div className="ab-side ab-side--bahar">
                <div className="ab-side-label ab-side-label--bahar">
                  BAHAR <span style={{ fontSize: '0.75em', opacity: 0.8 }}>बाहर</span>
                  {winSide === 'bahar' && allRevealed && (
                    <span className="ab-winner-badge ab-winner-badge--bahar">WIN</span>
                  )}
                </div>
                <div className="ab-cards-row ab-cards-row--bahar">
                  {revealedBahar.map((card, idx) => {
                    const isLast = idx === revealedBahar.length - 1 && winSide === 'bahar' && allRevealed;
                    return (
                      <div key={idx} className="ab-card-slide-in">
                        <PlayingCard
                          card={card}
                          size="small"
                          highlight={isLast}
                        />
                      </div>
                    );
                  })}
                  {revealedBahar.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                      Waiting...
                    </div>
                  )}
                </div>
                <div className="ab-side-count">
                  {revealedBahar.length} card{revealedBahar.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Dealing progress indicator */}
            {animating && (
              <div className="ab-dealing-indicator">
                <div className="ab-dealing-dots">
                  <span /><span /><span />
                </div>
                <span>Dealing card {revealedCount} of {totalCards}...</span>
              </div>
            )}

            {/* ---- RESULT BANNER (shown after all cards dealt) ---- */}
            {allRevealed && (
              <div className={`ab-result-banner ${gameResult.won ? 'ab-result-banner--won' : 'ab-result-banner--lost'}`}>
                <div className="ab-result-main">
                  {gameResult.won ? (
                    <>
                      <span className="ab-result-emoji">&#127881;</span>
                      <span className="ab-result-text">You Win!</span>
                      <span className="ab-result-amount">+{formatCurrency(gameResult.payout)}</span>
                    </>
                  ) : (
                    <>
                      <span className="ab-result-emoji">&#128577;</span>
                      <span className="ab-result-text">You Lose!</span>
                    </>
                  )}
                </div>
                <div className="ab-result-details">
                  <span className="ab-result-detail-item">
                    <span style={{ color: 'var(--text-muted)' }}>You bet:</span>
                    &nbsp;<strong style={{ color: selectedBet === 'andar' ? 'var(--accent-green)' : '#ff8c42' }}>
                      {selectedBet === 'andar' ? 'ANDAR' : 'BAHAR'}
                    </strong>
                  </span>
                  <span className="ab-result-divider">|</span>
                  <span className="ab-result-detail-item">
                    <span style={{ color: 'var(--text-muted)' }}>Winner:</span>
                    &nbsp;<strong style={{ color: winSide === 'andar' ? 'var(--accent-green)' : '#ff8c42' }}>
                      {winSide === 'andar' ? 'ANDAR' : 'BAHAR'}
                    </strong>
                  </span>
                  <span className="ab-result-divider">|</span>
                  <span className="ab-result-detail-item">
                    <span style={{ color: 'var(--text-muted)' }}>Cards dealt:</span>
                    &nbsp;<strong style={{ color: 'var(--accent-gold)' }}>{totalDealt}</strong>
                  </span>
                </div>

                <button className="ab-play-again-btn" onClick={resetGame}>
                  Play Again
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── HISTORY ── */}
      {history.length > 0 && (
        <div className="ab-history-section">
          <div className="ab-history-title">Recent Results</div>
          <div className="ab-history-row">
            {history.map((h, i) => (
              <div
                key={i}
                className={`ab-history-badge ${h.result === 'andar' ? 'ab-history-badge--andar' : 'ab-history-badge--bahar'}`}
                title={`${h.result === 'andar' ? 'Andar' : 'Bahar'} won — ${h.won ? 'You won' : 'You lost'}`}
              >
                {h.result === 'andar' ? 'A' : 'B'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── INLINE STYLES ── */}
      <style>{`
        /* -------- Banner -------- */
        .ab-banner {
          position: relative;
          background: linear-gradient(135deg, rgba(0,100,0,0.18) 0%, rgba(13,27,42,0.95) 50%, rgba(160,60,0,0.18) 100%);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.75rem 1.25rem;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          overflow: hidden;
          min-height: 130px;
        }

        .ab-banner-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          z-index: 2;
          flex: 1;
        }

        .ab-banner-side--andar {
          align-items: flex-start;
          padding-left: 0.5rem;
        }

        .ab-banner-side--bahar {
          align-items: flex-end;
          padding-right: 0.5rem;
        }

        .ab-banner-side-label {
          font-size: 1.2rem;
          font-weight: 900;
          letter-spacing: 3px;
          color: var(--accent-green);
          text-shadow: 0 0 12px rgba(0,200,80,0.5);
        }

        .ab-banner-cards {
          display: flex;
          position: relative;
          height: 52px;
        }

        .ab-banner-cards--left {
          flex-direction: row;
        }

        .ab-banner-cards--right {
          flex-direction: row-reverse;
        }

        .ab-banner-card-ghost {
          width: 36px;
          height: 50px;
          border-radius: 5px;
          background: linear-gradient(135deg, rgba(0,180,80,0.25), rgba(0,120,50,0.15));
          border: 1.5px solid rgba(0,200,80,0.3);
          position: relative;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }

        .ab-banner-card-ghost--bahar {
          background: linear-gradient(135deg, rgba(255,120,40,0.25), rgba(200,80,0,0.15));
          border-color: rgba(255,140,66,0.3);
        }

        .ab-banner-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 3;
          flex-shrink: 0;
        }

        .ab-banner-joker-card {
          width: 60px;
          height: 84px;
          background: linear-gradient(145deg, #2a2a1a, #1a1a0a);
          border: 2px solid #ffd700;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(255,215,0,0.5), 0 4px 12px rgba(0,0,0,0.5);
          color: #ffd700;
        }

        .ab-banner-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          padding-bottom: 0.75rem;
          background: linear-gradient(to bottom, transparent 40%, rgba(13,27,42,0.7) 100%);
          pointer-events: none;
          z-index: 4;
        }

        .ab-banner-title {
          font-size: 1.8rem;
          font-weight: 900;
          letter-spacing: 6px;
          background: linear-gradient(135deg, #ffd700 20%, #ffaa00 60%, #ff8c00 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: none;
          line-height: 1.2;
        }

        .ab-banner-subtitle {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.55);
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        /* -------- Main Card -------- */
        .ab-main-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          margin-bottom: 1.25rem;
        }

        /* -------- Bet Buttons -------- */
        .ab-bet-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .ab-bet-btn {
          padding: 1.25rem 1rem;
          border-radius: 14px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid transparent;
          position: relative;
          overflow: hidden;
        }

        .ab-bet-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ab-bet-btn--andar {
          background: linear-gradient(145deg, rgba(0,180,80,0.15), rgba(0,120,50,0.08));
          color: var(--accent-green);
          border-color: rgba(0,200,80,0.25);
        }

        .ab-bet-btn--andar:hover:not(:disabled) {
          background: linear-gradient(145deg, rgba(0,180,80,0.22), rgba(0,120,50,0.14));
          border-color: rgba(0,200,80,0.5);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,200,80,0.2);
        }

        .ab-bet-btn--bahar {
          background: linear-gradient(145deg, rgba(255,120,40,0.15), rgba(200,80,0,0.08));
          color: #ff8c42;
          border-color: rgba(255,140,66,0.25);
        }

        .ab-bet-btn--bahar:hover:not(:disabled) {
          background: linear-gradient(145deg, rgba(255,120,40,0.22), rgba(200,80,0,0.14));
          border-color: rgba(255,140,66,0.5);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(255,120,40,0.2);
        }

        .ab-bet-btn--loading {
          animation: abBtnPulse 0.8s ease-in-out infinite;
        }

        @keyframes abBtnPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }

        .ab-bet-btn-top {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          justify-content: center;
        }

        .ab-bet-hindi {
          font-size: 1.3rem;
          font-weight: 900;
          line-height: 1;
          color: var(--accent-green);
        }

        .ab-bet-btn--bahar .ab-bet-hindi {
          color: #ff8c42;
        }

        .ab-bet-stack {
          display: flex;
          align-items: center;
          position: relative;
          height: 28px;
          gap: 2px;
        }

        .ab-bet-stack-card {
          width: 18px;
          height: 26px;
          border-radius: 3px;
          background: linear-gradient(135deg, rgba(0,180,80,0.4), rgba(0,120,50,0.25));
          border: 1px solid rgba(0,200,80,0.4);
        }

        .ab-bet-stack-card--bahar {
          background: linear-gradient(135deg, rgba(255,120,40,0.4), rgba(200,80,0,0.25));
          border-color: rgba(255,140,66,0.4);
        }

        .ab-bet-arrow {
          font-size: 1.1rem;
          font-weight: 900;
          opacity: 0.8;
          line-height: 1;
        }

        .ab-bet-btn-name {
          font-size: 1.15rem;
          font-weight: 900;
          letter-spacing: 3px;
          line-height: 1;
        }

        .ab-bet-payout {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.5px;
        }

        /* -------- Joker Area -------- */
        .ab-joker-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 1.5rem;
          gap: 0.6rem;
        }

        .ab-joker-label {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 3px;
          color: #ffd700;
          text-transform: uppercase;
          background: rgba(255,215,0,0.1);
          border: 1px solid rgba(255,215,0,0.25);
          border-radius: 4px;
          padding: 2px 10px;
        }

        .ab-joker-wrapper {
          animation: abJokerReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        @keyframes abJokerReveal {
          0% { opacity: 0; transform: scale(0.6) rotateY(90deg); }
          100% { opacity: 1; transform: scale(1) rotateY(0deg); }
        }

        .ab-joker-value {
          font-size: 0.82rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        /* -------- Dealing Area -------- */
        .ab-dealing-area {
          display: flex;
          gap: 0;
          align-items: flex-start;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          overflow: hidden;
          min-height: 110px;
          margin-bottom: 1rem;
        }

        .ab-side {
          flex: 1;
          padding: 0.85rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          min-width: 0;
        }

        .ab-side--andar {
          border-right: 1px solid var(--border-color);
        }

        .ab-side-label {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .ab-side-label--andar {
          color: var(--accent-green);
        }

        .ab-side-label--bahar {
          color: #ff8c42;
        }

        .ab-winner-badge {
          font-size: 0.6rem;
          font-weight: 900;
          padding: 1px 6px;
          border-radius: 3px;
          letter-spacing: 1px;
          animation: abWinPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        .ab-winner-badge--andar {
          background: var(--accent-green);
          color: #0d1b0d;
        }

        .ab-winner-badge--bahar {
          background: #ff8c42;
          color: #1a0a00;
        }

        @keyframes abWinPop {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .ab-cards-row {
          display: flex;
          gap: 4px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
          align-items: center;
          flex-wrap: nowrap;
        }

        .ab-cards-row::-webkit-scrollbar {
          height: 3px;
        }

        .ab-cards-row::-webkit-scrollbar-track {
          background: transparent;
        }

        .ab-cards-row::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
        }

        .ab-card-slide-in {
          animation: abCardDeal 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          flex-shrink: 0;
        }

        @keyframes abCardDeal {
          0% {
            opacity: 0;
            transform: translateY(-20px) scale(0.7) rotate(-8deg);
          }
          60% {
            transform: translateY(3px) scale(1.05) rotate(1deg);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(0deg);
          }
        }

        .ab-side-count {
          font-size: 0.68rem;
          color: var(--text-muted);
          font-weight: 600;
          font-family: var(--font-mono);
        }

        .ab-center-divider {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem 0;
          gap: 0;
          flex-shrink: 0;
        }

        .ab-divider-line {
          width: 1px;
          flex: 1;
          background: var(--border-color);
          min-height: 20px;
        }

        .ab-divider-dot {
          font-size: 0.6rem;
          font-weight: 900;
          color: var(--text-muted);
          padding: 4px 0;
          letter-spacing: 1px;
        }

        /* -------- Dealing Indicator -------- */
        .ab-dealing-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.82rem;
          color: var(--text-muted);
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        .ab-dealing-dots {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .ab-dealing-dots span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent-gold);
          animation: abDotBounce 0.9s ease-in-out infinite;
        }

        .ab-dealing-dots span:nth-child(2) { animation-delay: 0.15s; }
        .ab-dealing-dots span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes abDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }

        /* -------- Result Banner -------- */
        .ab-result-banner {
          border-radius: var(--radius);
          padding: 1.25rem;
          text-align: center;
          animation: abResultSlide 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          margin-top: 0.25rem;
        }

        .ab-result-banner--won {
          background: linear-gradient(135deg, rgba(0,200,80,0.12), rgba(0,150,60,0.06));
          border: 1px solid rgba(0,200,80,0.3);
        }

        .ab-result-banner--lost {
          background: linear-gradient(135deg, rgba(255,68,68,0.12), rgba(200,30,30,0.06));
          border: 1px solid rgba(255,68,68,0.3);
        }

        @keyframes abResultSlide {
          0% { opacity: 0; transform: translateY(16px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        .ab-result-main {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .ab-result-emoji {
          font-size: 1.6rem;
          line-height: 1;
        }

        .ab-result-text {
          font-size: 1.5rem;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .ab-result-banner--won .ab-result-text {
          color: var(--accent-green);
        }

        .ab-result-banner--lost .ab-result-text {
          color: var(--accent-red);
        }

        .ab-result-amount {
          font-size: 1.5rem;
          font-weight: 900;
          color: var(--accent-green);
          font-family: var(--font-mono);
        }

        .ab-result-details {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          flex-wrap: wrap;
          font-size: 0.82rem;
          margin-bottom: 1rem;
        }

        .ab-result-detail-item {
          font-weight: 600;
        }

        .ab-result-divider {
          color: var(--border-color);
          font-weight: 300;
        }

        .ab-play-again-btn {
          padding: 0.7rem 2rem;
          border-radius: var(--radius);
          font-weight: 800;
          font-size: 0.95rem;
          cursor: pointer;
          border: none;
          background: linear-gradient(135deg, #ffd700, #e6ac00);
          color: #1a1a2e;
          transition: all 0.2s;
          letter-spacing: 0.5px;
          box-shadow: 0 3px 12px rgba(255,215,0,0.3);
        }

        .ab-play-again-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 5px 18px rgba(255,215,0,0.4);
        }

        .ab-play-again-btn:active {
          transform: scale(0.97);
        }

        /* -------- History -------- */
        .ab-history-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1rem 1.25rem;
        }

        .ab-history-title {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 0.75rem;
        }

        .ab-history-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .ab-history-badge {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          font-weight: 900;
          font-family: var(--font-mono);
          letter-spacing: 0;
          transition: all 0.3s ease;
          border: 1.5px solid transparent;
        }

        .ab-history-badge--andar {
          background: rgba(0,200,80,0.15);
          color: var(--accent-green);
          border-color: rgba(0,200,80,0.3);
        }

        .ab-history-badge--bahar {
          background: rgba(255,120,40,0.15);
          color: #ff8c42;
          border-color: rgba(255,140,66,0.3);
        }

        /* -------- Responsive -------- */
        @media (max-width: 520px) {
          .ab-banner { min-height: 110px; padding: 1.25rem 0.75rem; }
          .ab-banner-title { font-size: 1.4rem; letter-spacing: 4px; }
          .ab-banner-joker-card { width: 48px; height: 68px; }
          .ab-main-card { padding: 1rem; }
          .ab-bet-buttons { gap: 0.6rem; }
          .ab-bet-btn { padding: 1rem 0.6rem; border-radius: 12px; }
          .ab-bet-btn-name { font-size: 1rem; letter-spacing: 2px; }
          .ab-bet-hindi { font-size: 1.1rem; }
          .ab-bet-stack-card { width: 14px; height: 20px; }
          .ab-result-main { flex-direction: column; gap: 0.4rem; }
          .ab-result-text { font-size: 1.2rem; }
          .ab-result-amount { font-size: 1.2rem; }
          .ab-result-details { flex-direction: column; gap: 0.3rem; }
          .ab-result-divider { display: none; }
          .ab-dealing-area { min-height: 90px; }
          .ab-side { padding: 0.65rem 0.5rem; }
        }

        @media (max-width: 380px) {
          .ab-banner-title { font-size: 1.1rem; letter-spacing: 3px; }
          .ab-bet-btn-name { letter-spacing: 1.5px; }
        }
      `}</style>
    </div>
  );
}
