import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { flipCoin } from '../api/casino';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

const COINFLIP_RULES = [
  'Choose Heads or Tails.',
  'Select your bet amount and click FLIP.',
  'The coin will flip in the air for about 1.5 seconds.',
  'If the coin lands on your chosen side, you win 1.94x your bet!',
  'The small house edge (3%) keeps the game fair and sustainable.',
  'Your last 10 flip results are shown at the bottom.',
];

const COINFLIP_PAYOUTS = [
  { label: 'Correct guess', value: '1.94x your bet' },
  { label: 'Wrong guess', value: 'Lose bet' },
  { label: 'House edge', value: '3%' },
];

export default function CoinFlipGamePage() {
  const { user, updateBalance } = useContext(AuthContext);
  const [choice, setChoice] = useState('heads');
  const [stake, setStake] = useState(BET_AMOUNTS[0]);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState(null);
  const [won, setWon] = useState(null);
  const [lastPayout, setLastPayout] = useState(0);
  const [history, setHistory] = useState([]);
  const [showResult, setShowResult] = useState(false);

  const handleFlip = async () => {
    if (flipping) return;
    if (!user) return toast.error('Please login first');
    if (stake > (user?.balance || 0)) return toast.error('Insufficient balance');

    setFlipping(true);
    setShowResult(false);
    setResult(null);
    setWon(null);
    setLastPayout(0);

    try {
      const res = await flipCoin(stake, choice);
      const data = res.data;

      // Wait for the flip animation to finish before revealing result
      setTimeout(() => {
        const gameResult = data.gameResult || data;
        const coinResult = gameResult.result || data.result;
        const didWin = gameResult.won !== undefined ? gameResult.won : data.won;
        const payout = gameResult.payout || data.payout || 0;

        setResult(coinResult);
        setWon(didWin);
        setLastPayout(payout);
        setFlipping(false);
        setShowResult(true);

        if (data.balance !== undefined) {
          updateBalance(data.balance);
        }

        setHistory(prev => [
          { result: coinResult, won: didWin },
          ...prev,
        ].slice(0, 10));

        if (didWin) {
          toast.success(`You won ${formatCurrency(payout)}!`);
        } else {
          toast.error(`It was ${coinResult}! You lost.`);
        }
      }, 1500);
    } catch (err) {
      setFlipping(false);
      toast.error(err.response?.data?.error || 'Failed to flip coin');
    }
  };

  const resetGame = () => {
    setShowResult(false);
    setResult(null);
    setWon(null);
    setLastPayout(0);
  };

  return (
    <div className="casino-game-page" style={{ maxWidth: 550 }}>
      <h1>&#x1FA99; Coin Flip</h1>

      <GameRulesModal
        gameKey="coinflip"
        title="How to Play Coin Flip"
        rules={COINFLIP_RULES}
        payouts={COINFLIP_PAYOUTS}
      />

      {/* Preview / Banner */}
      <div className="cf-banner">
        <div className="cf-banner-coins">
          <div className="cf-banner-coin cf-banner-coin--heads">H</div>
          <div className="cf-banner-coin cf-banner-coin--tails">T</div>
        </div>
        <div className="cf-banner-overlay">
          <div className="cf-banner-title">COIN FLIP</div>
          <div className="cf-banner-subtitle">Heads or tails. Double or nothing.</div>
        </div>
      </div>

      {/* Main Game Card */}
      <div className="cf-card">
        {/* Coin Display */}
        <div className="cf-coin-area">
          <div className={`cf-coin ${flipping ? 'cf-coin--flipping' : ''} ${showResult && won === true ? 'cf-coin--won' : ''} ${showResult && won === false ? 'cf-coin--lost' : ''}`}>
            <div className="cf-coin-face cf-coin-face--front">
              <span className="cf-coin-letter">H</span>
              <span className="cf-coin-label">HEADS</span>
            </div>
            <div className="cf-coin-face cf-coin-face--back">
              <span className="cf-coin-letter">T</span>
              <span className="cf-coin-label">TAILS</span>
            </div>
          </div>
        </div>

        {/* Result Display */}
        {showResult && (
          <div className={`cf-result ${won ? 'cf-result--won' : 'cf-result--lost'}`}>
            <div className={`cf-result-coin ${result === 'heads' ? 'cf-result-coin--heads' : 'cf-result-coin--tails'}`}>
              <span className="cf-result-coin-letter">{result === 'heads' ? 'H' : 'T'}</span>
              <span className="cf-result-coin-name">{result === 'heads' ? 'HEADS' : 'TAILS'}</span>
            </div>
            <div className="cf-result-text">
              {won ? 'YOU WON!' : 'YOU LOST!'}
            </div>
            <div className="cf-result-detail">
              {won && <span className="cf-result-payout">+{formatCurrency(lastPayout)}</span>}
              {!won && <span>Better luck next time!</span>}
            </div>
          </div>
        )}

        {/* Choice Buttons */}
        <div className="cf-choice-buttons">
          <button
            className={`cf-choice-btn cf-choice-btn--heads ${choice === 'heads' ? 'cf-choice-btn--selected' : ''}`}
            onClick={() => { setChoice('heads'); resetGame(); }}
            disabled={flipping}
          >
            <span className="cf-choice-icon">H</span>
            <span className="cf-choice-label">Heads</span>
          </button>
          <button
            className={`cf-choice-btn cf-choice-btn--tails ${choice === 'tails' ? 'cf-choice-btn--selected' : ''}`}
            onClick={() => { setChoice('tails'); resetGame(); }}
            disabled={flipping}
          >
            <span className="cf-choice-icon">T</span>
            <span className="cf-choice-label">Tails</span>
          </button>
        </div>

        {/* Stake Selector */}
        <div className="stake-selector" style={{ marginTop: '1rem' }}>
          <label>Bet Amount</label>
          <div className="stake-buttons">
            {BET_AMOUNTS.map(amt => (
              <button
                key={amt}
                className={`btn btn-sm ${stake === amt ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStake(amt)}
                disabled={flipping}
              >
                {formatCurrency(amt)}
              </button>
            ))}
          </div>
        </div>

        {/* Potential Payout */}
        <div className="cf-payout-preview">
          Potential payout: <strong>{formatCurrency(Math.round(stake * 1.94 * 100) / 100)}</strong> (1.94x)
        </div>

        {/* Flip Button */}
        <button
          className="cf-flip-btn"
          onClick={handleFlip}
          disabled={flipping || !user || stake > (user?.balance || 0)}
        >
          {flipping ? 'FLIPPING...' : `FLIP \u2014 ${formatCurrency(stake)}`}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="cf-history-section">
          <div className="cf-history-title">Recent Flips</div>
          <div className="cf-history-row">
            {history.map((h, i) => (
              <div
                key={i}
                className={`cf-history-dot ${h.result === 'heads' ? 'cf-history-dot--heads' : 'cf-history-dot--tails'} ${h.won ? 'cf-history-dot--won' : 'cf-history-dot--lost'}`}
                title={`${h.result} - ${h.won ? 'Won' : 'Lost'}`}
              >
                {h.result === 'heads' ? 'H' : 'T'}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        /* ---- Banner ---- */
        .cf-banner {
          position: relative;
          background: linear-gradient(145deg, #0d1b2a, #1a2c3d);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 2rem 1.5rem;
          margin-bottom: 1.25rem;
          overflow: hidden;
        }
        .cf-banner-coins {
          display: flex;
          justify-content: center;
          gap: 2rem;
          opacity: 0.2;
        }
        .cf-banner-coin {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.8rem;
          font-weight: 900;
          font-family: var(--font-mono);
        }
        .cf-banner-coin--heads {
          background: linear-gradient(135deg, #ffd700, #b8860b);
          color: #1a1a2e;
          border: 3px solid #e6ac00;
        }
        .cf-banner-coin--tails {
          background: linear-gradient(135deg, #c0c0c0, #808080);
          color: #1a1a2e;
          border: 3px solid #a0a0a0;
        }
        .cf-banner-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at center, rgba(13,27,42,0.3), rgba(13,27,42,0.85));
          z-index: 2;
        }
        .cf-banner-title {
          font-size: 2.2rem;
          font-weight: 900;
          letter-spacing: 6px;
          background: linear-gradient(135deg, #ffd700, #e67e22);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.3rem;
        }
        .cf-banner-subtitle {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.6);
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        /* ---- Card ---- */
        .cf-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
        }

        /* ---- Coin Display ---- */
        .cf-coin-area {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 1.25rem;
          perspective: 600px;
        }
        .cf-coin {
          width: 120px;
          height: 120px;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.3s ease;
        }
        .cf-coin--flipping {
          animation: cfCoinFlip 1.5s ease-in-out;
        }
        .cf-coin--won {
          filter: drop-shadow(0 0 20px rgba(0, 231, 1, 0.5));
        }
        .cf-coin--lost {
          filter: drop-shadow(0 0 20px rgba(255, 68, 68, 0.5));
        }
        .cf-coin-face {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          backface-visibility: hidden;
          border: 4px solid;
        }
        .cf-coin-face--front {
          background: linear-gradient(145deg, #ffd700, #b8860b);
          border-color: #e6ac00;
          box-shadow: inset 0 2px 8px rgba(255,255,255,0.3), 0 4px 16px rgba(255,215,0,0.3);
        }
        .cf-coin-face--back {
          background: linear-gradient(145deg, #c0c0c0, #808080);
          border-color: #a0a0a0;
          transform: rotateX(180deg);
          box-shadow: inset 0 2px 8px rgba(255,255,255,0.3), 0 4px 16px rgba(192,192,192,0.3);
        }
        .cf-coin-letter {
          font-size: 2.5rem;
          font-weight: 900;
          color: #1a1a2e;
          font-family: var(--font-mono);
          line-height: 1;
        }
        .cf-coin-label {
          font-size: 0.6rem;
          font-weight: 700;
          color: #1a1a2e;
          letter-spacing: 2px;
          text-transform: uppercase;
          opacity: 0.7;
        }

        @keyframes cfCoinFlip {
          0% { transform: rotateX(0deg); }
          100% { transform: rotateX(1800deg); }
        }

        /* ---- Result ---- */
        .cf-result {
          text-align: center;
          padding: 0.85rem;
          border-radius: var(--radius);
          margin-bottom: 1.25rem;
          animation: cfResultPop 0.4s ease-out;
        }
        .cf-result--won {
          background: rgba(0, 231, 1, 0.1);
          border: 1px solid rgba(0, 231, 1, 0.3);
        }
        .cf-result--lost {
          background: rgba(255, 68, 68, 0.1);
          border: 1px solid rgba(255, 68, 68, 0.3);
        }
        .cf-result-coin {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 0 auto 0.6rem;
          font-weight: 900;
          animation: cfResultPop 0.4s ease-out;
        }
        .cf-result-coin--heads {
          background: linear-gradient(145deg, #ffd700, #b8860b);
          box-shadow: 0 0 20px rgba(255, 215, 0, 0.4), inset 0 2px 4px rgba(255,255,255,0.3);
          color: #1a1a2e;
        }
        .cf-result-coin--tails {
          background: linear-gradient(145deg, #c0c0c0, #808080);
          box-shadow: 0 0 20px rgba(192, 192, 192, 0.4), inset 0 2px 4px rgba(255,255,255,0.3);
          color: #1a1a2e;
        }
        .cf-result-coin-letter {
          font-size: 1.6rem;
          line-height: 1;
        }
        .cf-result-coin-name {
          font-size: 0.5rem;
          letter-spacing: 1px;
          opacity: 0.8;
        }
        .cf-result-text {
          font-size: 1.5rem;
          font-weight: 900;
          line-height: 1.3;
        }
        .cf-result--won .cf-result-text {
          color: var(--accent-green);
        }
        .cf-result--lost .cf-result-text {
          color: var(--accent-red);
        }
        .cf-result-detail {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
          font-weight: 600;
        }
        .cf-result-payout {
          color: var(--accent-green);
          font-weight: 800;
        }
        @keyframes cfResultPop {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }

        /* ---- Choice Buttons ---- */
        .cf-choice-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .cf-choice-btn {
          padding: 1.25rem 1rem;
          border-radius: 14px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: all 0.25s cubic-bezier(.4,0,.2,1);
          border: 3px solid transparent;
        }
        .cf-choice-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .cf-choice-btn--heads {
          background: linear-gradient(145deg, rgba(255,215,0,0.12), rgba(184,134,11,0.08));
          color: #ffd700;
        }
        .cf-choice-btn--heads:hover:not(:disabled) {
          background: linear-gradient(145deg, rgba(255,215,0,0.18), rgba(184,134,11,0.12));
          transform: translateY(-2px);
        }
        .cf-choice-btn--heads.cf-choice-btn--selected {
          border-color: #ffd700;
          background: linear-gradient(145deg, rgba(255,215,0,0.2), rgba(184,134,11,0.12));
          box-shadow: 0 0 20px rgba(255,215,0,0.2);
        }
        .cf-choice-btn--tails {
          background: linear-gradient(145deg, rgba(192,192,192,0.12), rgba(128,128,128,0.08));
          color: #c0c0c0;
        }
        .cf-choice-btn--tails:hover:not(:disabled) {
          background: linear-gradient(145deg, rgba(192,192,192,0.18), rgba(128,128,128,0.12));
          transform: translateY(-2px);
        }
        .cf-choice-btn--tails.cf-choice-btn--selected {
          border-color: #c0c0c0;
          background: linear-gradient(145deg, rgba(192,192,192,0.2), rgba(128,128,128,0.12));
          box-shadow: 0 0 20px rgba(192,192,192,0.2);
        }
        .cf-choice-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 900;
          font-family: var(--font-mono);
        }
        .cf-choice-btn--heads .cf-choice-icon {
          background: linear-gradient(135deg, #ffd700, #b8860b);
          color: #1a1a2e;
        }
        .cf-choice-btn--tails .cf-choice-icon {
          background: linear-gradient(135deg, #c0c0c0, #808080);
          color: #1a1a2e;
        }
        .cf-choice-label {
          font-size: 1rem;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        /* ---- Payout Preview ---- */
        .cf-payout-preview {
          text-align: center;
          font-size: 0.82rem;
          color: var(--text-muted);
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }
        .cf-payout-preview strong {
          color: var(--accent-gold);
          font-family: var(--font-mono);
        }

        /* ---- Flip Button ---- */
        .cf-flip-btn {
          width: 100%;
          padding: 1rem;
          border-radius: var(--radius);
          font-weight: 800;
          font-size: 1.1rem;
          cursor: pointer;
          border: none;
          background: linear-gradient(135deg, #ffd700, #e6ac00);
          color: #1a1a2e;
          transition: all 0.2s;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 16px rgba(255,215,0,0.3);
        }
        .cf-flip-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(255,215,0,0.4);
        }
        .cf-flip-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .cf-flip-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ---- History ---- */
        .cf-history-section {
          margin-top: 1.25rem;
        }
        .cf-history-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
          margin-bottom: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .cf-history-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .cf-history-dot {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 900;
          font-family: var(--font-mono);
          border: 2px solid;
          transition: all 0.3s ease;
        }
        .cf-history-dot--heads {
          background: linear-gradient(135deg, rgba(255,215,0,0.15), rgba(184,134,11,0.1));
          color: #ffd700;
          border-color: rgba(255,215,0,0.3);
        }
        .cf-history-dot--tails {
          background: linear-gradient(135deg, rgba(192,192,192,0.15), rgba(128,128,128,0.1));
          color: #c0c0c0;
          border-color: rgba(192,192,192,0.3);
        }
        .cf-history-dot--won {
          box-shadow: 0 0 8px rgba(0, 231, 1, 0.3);
          border-color: rgba(0, 231, 1, 0.4);
        }
        .cf-history-dot--lost {
          opacity: 0.55;
        }

        /* ---- Responsive ---- */
        @media (max-width: 480px) {
          .cf-banner { padding: 1.5rem 1rem; }
          .cf-banner-title { font-size: 1.6rem; letter-spacing: 4px; }
          .cf-coin { width: 100px; height: 100px; }
          .cf-coin-letter { font-size: 2rem; }
          .cf-choice-btn { padding: 1rem 0.75rem; border-radius: 12px; }
          .cf-choice-icon { width: 40px; height: 40px; font-size: 1.2rem; }
          .cf-choice-label { font-size: 0.85rem; }
          .cf-history-dot { width: 30px; height: 30px; font-size: 0.7rem; }
        }
      `}</style>
    </div>
  );
}
