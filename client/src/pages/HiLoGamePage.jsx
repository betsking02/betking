import { useState, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { startHiLo, guessHiLo, cashoutHiLo } from '../api/casino';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

const HILO_RULES = [
  'Place your bet and a card is dealt face-up.',
  'Guess whether the next card will be HIGHER or LOWER than the current card.',
  'Each correct guess increases your streak and multiplier.',
  'Cash out anytime after your first correct guess to lock in your winnings.',
  'If your guess is wrong, you lose your entire bet.',
  'Cards rank from A (1) to K (13). Suits do not affect rank.',
  'The probability of each outcome is shown on the buttons to help you decide.',
  'Equal value cards count as a loss.',
];

const HILO_PAYOUTS = [
  { label: '1 correct guess', value: '~1.2x - 12x' },
  { label: '3 correct guesses', value: '~1.7x - 1,728x' },
  { label: '5 correct guesses', value: '~2.5x - ~248,832x' },
  { label: '10 correct guesses', value: '~9.3x+' },
  { label: 'Cash out anytime', value: 'Lock in winnings' },
  { label: 'Wrong guess', value: 'Lose bet' },
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
  clubs: '#ffffff',
  spades: '#ffffff',
};

function PlayingCard({ card, size = 'large', highlight = '', flipping = false }) {
  if (!card) return null;

  const suitSymbol = SUIT_SYMBOLS[card.suit] || '';
  const suitColor = SUIT_COLORS[card.suit] || '#ffffff';
  const isLarge = size === 'large';
  const isSmall = size === 'small';

  const cardWidth = isLarge ? 140 : isSmall ? 48 : 80;
  const cardHeight = isLarge ? 196 : isSmall ? 68 : 112;
  const rankFont = isLarge ? '1.6rem' : isSmall ? '0.65rem' : '0.95rem';
  const suitFont = isLarge ? '3.5rem' : isSmall ? '1.1rem' : '1.8rem';

  let borderColor = 'rgba(255,255,255,0.15)';
  let bgExtra = '';
  if (highlight === 'wrong') {
    borderColor = '#dc2626';
    bgExtra = ', rgba(220,38,38,0.1) 0%, rgba(220,38,38,0.02) 100%';
  } else if (highlight === 'correct') {
    borderColor = '#00e701';
    bgExtra = ', rgba(0,231,1,0.08) 0%, rgba(0,231,1,0.02) 100%';
  }

  return (
    <div
      className={`hilo-card ${flipping ? 'hilo-card-flip' : ''} ${highlight === 'wrong' ? 'hilo-card-wrong' : ''}`}
      style={{
        width: cardWidth,
        height: cardHeight,
        background: `linear-gradient(145deg, #ffffff, #f0f0f0${bgExtra})`,
        borderRadius: isLarge ? 14 : isSmall ? 6 : 10,
        border: `2px solid ${borderColor}`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: highlight === 'wrong'
          ? '0 0 20px rgba(220,38,38,0.4)'
          : highlight === 'correct'
          ? '0 0 16px rgba(0,231,1,0.3)'
          : '0 4px 16px rgba(0,0,0,0.4)',
        flexShrink: 0,
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}
    >
      {/* Top-left rank + suit */}
      <div style={{
        position: 'absolute',
        top: isLarge ? 8 : isSmall ? 3 : 6,
        left: isLarge ? 10 : isSmall ? 4 : 7,
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
          fontSize: isLarge ? '1rem' : isSmall ? '0.5rem' : '0.7rem',
          color: suitColor,
          marginTop: -2,
        }}>{suitSymbol}</span>
      </div>

      {/* Center suit */}
      <span style={{
        fontSize: suitFont,
        color: suitColor,
        lineHeight: 1,
      }}>{suitSymbol}</span>

      {/* Bottom-right rank + suit (inverted) */}
      <div style={{
        position: 'absolute',
        bottom: isLarge ? 8 : isSmall ? 3 : 6,
        right: isLarge ? 10 : isSmall ? 4 : 7,
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
          fontSize: isLarge ? '1rem' : isSmall ? '0.5rem' : '0.7rem',
          color: suitColor,
          marginTop: -2,
        }}>{suitSymbol}</span>
      </div>
    </div>
  );
}

export default function HiLoGamePage() {
  const { user, updateBalance } = useContext(AuthContext);
  const [stake, setStake] = useState(BET_AMOUNTS[0]);
  const [gameId, setGameId] = useState(null);
  const [gameActive, setGameActive] = useState(false);
  const [currentCard, setCurrentCard] = useState(null);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [higherChance, setHigherChance] = useState(50);
  const [lowerChance, setLowerChance] = useState(50);
  const [history, setHistory] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState(null); // 'won' | 'lost' | null
  const [lastPayout, setLastPayout] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastWrongCard, setLastWrongCard] = useState(null);
  const [flipping, setFlipping] = useState(false);

  const potentialPayout = Math.round(stake * multiplier * 100) / 100;

  const handleStart = useCallback(async () => {
    if (!user) return toast.error('Please login first');
    if (stake > user.balance) return toast.error('Insufficient balance');
    setLoading(true);
    try {
      const res = await startHiLo(stake);
      const data = res.data;
      setGameId(data.gameId);
      setGameActive(true);
      setCurrentCard(data.currentCard);
      setStreak(data.streak || 0);
      setMultiplier(data.multiplier || 1);
      setHigherChance(data.higherChance || 50);
      setLowerChance(data.lowerChance || 50);
      setHistory([]);
      setGameOver(false);
      setGameResult(null);
      setLastPayout(0);
      setLastWrongCard(null);
      setFlipping(false);
      updateBalance(data.balance);
      toast.success('Game started! Make your guess.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start game');
    }
    setLoading(false);
  }, [stake, user, updateBalance]);

  const handleGuess = useCallback(async (direction) => {
    if (!gameActive || gameOver || loading) return;
    setLoading(true);
    setFlipping(true);

    try {
      const res = await guessHiLo(gameId, direction);
      const data = res.data;

      // Short delay for flip animation
      await new Promise(resolve => setTimeout(resolve, 400));

      if (data.won) {
        // Correct guess
        setHistory(prev => [...prev, currentCard]);
        setCurrentCard(data.card);
        setStreak(data.streak);
        setMultiplier(data.multiplier);
        setHigherChance(data.nextHigherChance || 50);
        setLowerChance(data.nextLowerChance || 50);
        updateBalance(data.balance);

        if (data.gameOver) {
          // Max streak or deck exhausted - auto cashout
          setGameOver(true);
          setGameActive(false);
          setGameResult('won');
          setLastPayout(data.payout);
          toast.success(`Max streak! Won ${formatCurrency(data.payout)}!`);
        } else {
          toast.success(`Correct! Streak: ${data.streak} | ${data.multiplier.toFixed(2)}x`);
        }
      } else {
        // Wrong guess
        setHistory(data.history || [...history, currentCard]);
        setLastWrongCard(data.card);
        setCurrentCard(data.card);
        setGameOver(true);
        setGameActive(false);
        setGameResult('lost');
        updateBalance(data.balance);
        toast.error('Wrong guess! You lost.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to make guess');
    }
    setFlipping(false);
    setLoading(false);
  }, [gameActive, gameOver, loading, gameId, currentCard, history, updateBalance]);

  const handleCashout = useCallback(async () => {
    if (!gameActive || gameOver || streak < 1 || loading) return;
    setLoading(true);
    try {
      const res = await cashoutHiLo(gameId);
      const data = res.data;
      setHistory(data.history || history);
      setMultiplier(data.multiplier);
      setStreak(data.streak);
      setGameOver(true);
      setGameActive(false);
      setGameResult('won');
      setLastPayout(data.payout);
      updateBalance(data.balance);
      toast.success(`Cashed out ${formatCurrency(data.payout)}!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cash out');
    }
    setLoading(false);
  }, [gameActive, gameOver, streak, loading, gameId, history, updateBalance]);

  const resetGame = () => {
    setGameId(null);
    setGameActive(false);
    setCurrentCard(null);
    setStreak(0);
    setMultiplier(1);
    setHigherChance(50);
    setLowerChance(50);
    setHistory([]);
    setGameOver(false);
    setGameResult(null);
    setLastPayout(0);
    setLastWrongCard(null);
    setFlipping(false);
  };

  return (
    <div className="casino-game-page" style={{ maxWidth: 600 }}>
      <h1>{'\uD83C\uDCCF'} Hi-Lo</h1>

      <GameRulesModal
        gameKey="hilo"
        title="How to Play Hi-Lo"
        rules={HILO_RULES}
        payouts={HILO_PAYOUTS}
      />

      {/* ====== PRE-GAME: Preview + Setup ====== */}
      {!gameActive && !gameOver && (
        <div className="hilo-setup">
          {/* Banner / Preview */}
          <div className="hilo-preview">
            <div className="hilo-preview-cards">
              <div className="hilo-preview-card hilo-preview-card-1">
                <span style={{ fontSize: '2rem' }}>{'\u2660'}</span>
              </div>
              <div className="hilo-preview-card hilo-preview-card-2">
                <span style={{ fontSize: '1.5rem', color: '#dc2626' }}>{'\u2665'}</span>
              </div>
              <div className="hilo-preview-card hilo-preview-card-3">
                <span style={{ fontSize: '1.8rem' }}>?</span>
              </div>
            </div>
            <div className="hilo-preview-overlay">
              <div className="hilo-preview-title">HI-LO</div>
              <div className="hilo-preview-subtitle">Higher or lower? Build your streak.</div>
            </div>
          </div>

          {/* Controls */}
          <div className="hilo-setup-controls">
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

            <button
              className="btn btn-primary hilo-start-btn"
              onClick={handleStart}
              disabled={loading || !user || stake > (user?.balance || 0)}
              style={{ marginTop: '1rem', width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 800 }}
            >
              {loading ? 'Starting...' : `START GAME \u2014 ${formatCurrency(stake)}`}
            </button>
          </div>
        </div>
      )}

      {/* ====== ACTIVE GAME ====== */}
      {gameActive && !gameOver && (
        <div className="hilo-game-area">
          {/* Info Bar */}
          <div className="hilo-info-bar">
            <div className="hilo-info-item">
              <span className="hilo-info-label">Bet</span>
              <span className="hilo-info-value">{formatCurrency(stake)}</span>
            </div>
            <div className="hilo-info-item">
              <span className="hilo-info-label">Streak</span>
              <span className="hilo-info-value" style={{ color: '#ffd700' }}>{streak}</span>
            </div>
            <div className="hilo-info-item">
              <span className="hilo-info-label">Multiplier</span>
              <span className="hilo-info-value" style={{ color: '#00e701' }}>{multiplier.toFixed(2)}x</span>
            </div>
            <div className="hilo-info-item">
              <span className="hilo-info-label">Payout</span>
              <span className="hilo-info-value" style={{ color: '#00e701' }}>{formatCurrency(potentialPayout)}</span>
            </div>
          </div>

          {/* Card History */}
          {history.length > 0 && (
            <div className="hilo-history">
              <div className="hilo-history-label">Previous Cards</div>
              <div className="hilo-history-cards">
                {history.map((card, i) => (
                  <PlayingCard key={i} card={card} size="small" />
                ))}
              </div>
            </div>
          )}

          {/* Current Card */}
          <div className="hilo-current-card-area">
            <div className="hilo-card-label">Current Card</div>
            <div className="hilo-card-wrapper">
              <PlayingCard card={currentCard} size="large" flipping={flipping} />
            </div>
            {currentCard && (
              <div className="hilo-card-value-label">
                {currentCard.display} (Value: {currentCard.numericValue})
              </div>
            )}
          </div>

          {/* Higher / Lower Buttons */}
          <div className="hilo-guess-buttons">
            <button
              className="hilo-guess-btn hilo-guess-higher"
              onClick={() => handleGuess('higher')}
              disabled={loading}
            >
              <span className="hilo-guess-arrow">{'\u25B2'}</span>
              <span className="hilo-guess-text">HIGHER</span>
              <span className="hilo-guess-chance">{higherChance.toFixed(1)}%</span>
            </button>
            <button
              className="hilo-guess-btn hilo-guess-lower"
              onClick={() => handleGuess('lower')}
              disabled={loading}
            >
              <span className="hilo-guess-arrow">{'\u25BC'}</span>
              <span className="hilo-guess-text">LOWER</span>
              <span className="hilo-guess-chance">{lowerChance.toFixed(1)}%</span>
            </button>
          </div>

          {/* Cash Out Button — only after at least 1 correct guess */}
          {streak >= 1 && (
            <button
              className="hilo-cashout-btn"
              onClick={handleCashout}
              disabled={loading}
            >
              {loading ? 'Cashing out...' : `CASH OUT \u2014 ${formatCurrency(potentialPayout)}`}
            </button>
          )}
        </div>
      )}

      {/* ====== GAME OVER: LOST ====== */}
      {gameOver && gameResult === 'lost' && (
        <div className="hilo-game-area">
          <div className="hilo-result-banner hilo-result-lost">
            <div className="hilo-result-icon">{'\u2716'}</div>
            <div className="hilo-result-title">Wrong!</div>
            <div className="hilo-result-subtitle">
              You lost {formatCurrency(stake)} &mdash; Streak: {streak}
            </div>
          </div>

          {/* Show card history */}
          {history.length > 0 && (
            <div className="hilo-history" style={{ marginBottom: '1rem' }}>
              <div className="hilo-history-label">Card History</div>
              <div className="hilo-history-cards">
                {history.map((card, i) => (
                  <PlayingCard key={i} card={card} size="small" />
                ))}
              </div>
            </div>
          )}

          {/* Wrong card displayed large with red highlight */}
          <div className="hilo-current-card-area">
            <div className="hilo-card-label" style={{ color: '#dc2626' }}>The Card Was</div>
            <div className="hilo-card-wrapper">
              <PlayingCard card={lastWrongCard || currentCard} size="large" highlight="wrong" />
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={resetGame}
            style={{ marginTop: '1.25rem', width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 700 }}
          >
            NEW GAME
          </button>
        </div>
      )}

      {/* ====== GAME OVER: WON (Cashed Out) ====== */}
      {gameOver && gameResult === 'won' && (
        <div className="hilo-game-area">
          <div className="hilo-result-banner hilo-result-won">
            <div className="hilo-result-icon">{'\u2714'}</div>
            <div className="hilo-result-title">You Won!</div>
            <div className="hilo-result-payout">+{formatCurrency(lastPayout)}</div>
            <div className="hilo-result-subtitle">
              {multiplier.toFixed(2)}x multiplier &mdash; Streak: {streak}
            </div>
          </div>

          {/* Full card history */}
          {history.length > 0 && (
            <div className="hilo-history" style={{ marginBottom: '1rem' }}>
              <div className="hilo-history-label">All Cards</div>
              <div className="hilo-history-cards">
                {history.map((card, i) => (
                  <PlayingCard key={i} card={card} size="small" highlight="correct" />
                ))}
              </div>
            </div>
          )}

          {/* Final card */}
          {currentCard && (
            <div className="hilo-current-card-area">
              <div className="hilo-card-label" style={{ color: '#00e701' }}>Final Card</div>
              <div className="hilo-card-wrapper">
                <PlayingCard card={currentCard} size="large" highlight="correct" />
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={resetGame}
            style={{ marginTop: '1.25rem', width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 700 }}
          >
            NEW GAME
          </button>
        </div>
      )}

      <style>{`
        /* ===== SETUP / PREVIEW ===== */
        .hilo-setup {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .hilo-preview {
          position: relative;
          padding: 2.5rem 1.5rem;
          background: linear-gradient(145deg, #0d1b2a, #1a2c3d);
          border-bottom: 1px solid var(--border-color);
          overflow: hidden;
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hilo-preview-cards {
          display: flex;
          gap: 12px;
          justify-content: center;
          opacity: 0.25;
        }
        .hilo-preview-card {
          width: 72px;
          height: 100px;
          background: linear-gradient(145deg, #ffffff, #e8e8e8);
          border-radius: 10px;
          border: 2px solid rgba(255,255,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .hilo-preview-card-1 {
          transform: rotate(-8deg) translateY(4px);
        }
        .hilo-preview-card-2 {
          transform: rotate(3deg) translateY(-6px);
        }
        .hilo-preview-card-3 {
          transform: rotate(10deg) translateY(2px);
          background: linear-gradient(145deg, #1e3a4f, #162d3e);
          border-color: rgba(255,215,0,0.3);
          color: rgba(255,215,0,0.6);
        }
        .hilo-preview-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at center, rgba(13,27,42,0.35), rgba(13,27,42,0.85));
          z-index: 2;
        }
        .hilo-preview-title {
          font-size: 2.8rem;
          font-weight: 900;
          letter-spacing: 8px;
          background: linear-gradient(135deg, #ffd700, #e67e22);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: none;
          margin-bottom: 0.4rem;
        }
        .hilo-preview-subtitle {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.6);
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .hilo-setup-controls {
          padding: 1.25rem;
        }

        /* ===== GAME AREA ===== */
        .hilo-game-area {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
        }

        /* Info Bar */
        .hilo-info-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
          background: var(--bg-tertiary);
          border-radius: var(--radius);
          padding: 0.75rem;
        }
        .hilo-info-item {
          text-align: center;
        }
        .hilo-info-label {
          display: block;
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .hilo-info-value {
          display: block;
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        /* Card History Row */
        .hilo-history {
          margin-bottom: 1rem;
        }
        .hilo-history-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .hilo-history-cards {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        .hilo-history-cards::-webkit-scrollbar {
          height: 4px;
        }
        .hilo-history-cards::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 4px;
        }

        /* Current Card Area */
        .hilo-current-card-area {
          text-align: center;
          margin-bottom: 1.25rem;
        }
        .hilo-card-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }
        .hilo-card-wrapper {
          display: flex;
          justify-content: center;
          perspective: 800px;
        }
        .hilo-card-value-label {
          margin-top: 0.6rem;
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 600;
          font-family: var(--font-mono);
        }

        /* Card Flip Animation */
        .hilo-card {
          transition: transform 0.4s ease-in-out;
          transform-style: preserve-3d;
        }
        .hilo-card-flip {
          animation: hilo-flip 0.4s ease-in-out;
        }
        @keyframes hilo-flip {
          0% { transform: rotateY(0deg) scale(1); }
          50% { transform: rotateY(90deg) scale(0.95); }
          100% { transform: rotateY(0deg) scale(1); }
        }

        /* Wrong card shake */
        .hilo-card-wrong {
          animation: hilo-shake 0.5s ease-in-out;
        }
        @keyframes hilo-shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-5px); }
          60% { transform: translateX(5px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }

        /* Guess Buttons */
        .hilo-guess-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .hilo-guess-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 1rem 0.75rem;
          border-radius: var(--radius);
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .hilo-guess-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .hilo-guess-higher {
          background: linear-gradient(135deg, #1a3a2e, #0d2b1e);
          border-color: rgba(0,231,1,0.25);
          color: #00e701;
        }
        .hilo-guess-higher:hover:not(:disabled) {
          border-color: rgba(0,231,1,0.5);
          background: linear-gradient(135deg, #1f4a35, #12382a);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,231,1,0.2);
        }
        .hilo-guess-higher:active:not(:disabled) {
          transform: translateY(0);
        }
        .hilo-guess-lower {
          background: linear-gradient(135deg, #3a1a1a, #2b0d0d);
          border-color: rgba(220,38,38,0.25);
          color: #dc2626;
        }
        .hilo-guess-lower:hover:not(:disabled) {
          border-color: rgba(220,38,38,0.5);
          background: linear-gradient(135deg, #4a1f1f, #381212);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(220,38,38,0.2);
        }
        .hilo-guess-lower:active:not(:disabled) {
          transform: translateY(0);
        }
        .hilo-guess-arrow {
          font-size: 1.5rem;
          line-height: 1;
        }
        .hilo-guess-text {
          font-size: 1rem;
          font-weight: 800;
          letter-spacing: 1px;
        }
        .hilo-guess-chance {
          font-size: 0.8rem;
          font-weight: 700;
          font-family: var(--font-mono);
          opacity: 0.8;
        }

        /* Cash Out Button */
        .hilo-cashout-btn {
          width: 100%;
          padding: 1rem;
          border-radius: var(--radius);
          font-weight: 800;
          font-size: 1.1rem;
          cursor: pointer;
          border: none;
          background: linear-gradient(135deg, #00e701, #00a801);
          color: #000;
          animation: hilo-cashout-pulse 1.5s ease-in-out infinite;
          transition: transform 0.15s;
          font-family: inherit;
        }
        .hilo-cashout-btn:hover {
          transform: scale(1.02);
        }
        .hilo-cashout-btn:active {
          transform: scale(0.98);
        }
        .hilo-cashout-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          animation: none;
        }
        @keyframes hilo-cashout-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 231, 1, 0.3); }
          50% { box-shadow: 0 0 20px 4px rgba(0, 231, 1, 0.25); }
        }

        /* ===== RESULT BANNERS ===== */
        .hilo-result-banner {
          text-align: center;
          padding: 1.5rem 1rem;
          border-radius: var(--radius);
          margin-bottom: 1.25rem;
        }
        .hilo-result-lost {
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid rgba(220, 38, 38, 0.3);
          animation: hilo-shake 0.5s ease-in-out;
        }
        .hilo-result-won {
          background: rgba(0, 231, 1, 0.08);
          border: 1px solid rgba(0, 231, 1, 0.25);
          animation: hilo-win-pulse 1s ease-in-out 3;
        }
        .hilo-result-icon {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
          line-height: 1;
        }
        .hilo-result-lost .hilo-result-icon {
          color: #dc2626;
        }
        .hilo-result-won .hilo-result-icon {
          color: #00e701;
        }
        .hilo-result-title {
          font-size: 1.6rem;
          font-weight: 900;
          margin-bottom: 0.25rem;
        }
        .hilo-result-lost .hilo-result-title {
          color: #dc2626;
        }
        .hilo-result-won .hilo-result-title {
          color: #00e701;
        }
        .hilo-result-payout {
          font-size: 1.8rem;
          font-weight: 900;
          color: #00e701;
          font-family: var(--font-mono);
          margin-bottom: 0.25rem;
        }
        .hilo-result-subtitle {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        @keyframes hilo-win-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 231, 1, 0); }
          50% { box-shadow: 0 0 24px 4px rgba(0, 231, 1, 0.2); }
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 480px) {
          .hilo-info-bar {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
          }
          .hilo-guess-buttons {
            gap: 0.5rem;
          }
          .hilo-guess-btn {
            padding: 0.75rem 0.5rem;
          }
          .hilo-guess-arrow {
            font-size: 1.2rem;
          }
          .hilo-guess-text {
            font-size: 0.85rem;
          }
          .hilo-preview-title {
            font-size: 2.2rem;
            letter-spacing: 5px;
          }
          .hilo-preview-subtitle {
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
}
