import { useState, useContext, useRef, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { rollDice } from '../api/casino';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

function getMultiplier(target, direction) {
  const winChance = direction === 'over' ? 100 - target : target - 1;
  if (winChance <= 0) return 0;
  return Math.round((99 / winChance) * 0.97 * 100) / 100;
}

function getWinChance(target, direction) {
  return direction === 'over' ? 100 - target : target - 1;
}

export default function DiceRollGamePage() {
  const { user, updateBalance } = useContext(AuthContext);
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState('over');
  const [stake, setStake] = useState(BET_AMOUNTS[0]);
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [displayNumber, setDisplayNumber] = useState(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  const rollIntervalRef = useRef(null);

  const overChance = getWinChance(target, 'over');
  const underChance = getWinChance(target, 'under');
  const overMultiplier = getMultiplier(target, 'over');
  const underMultiplier = getMultiplier(target, 'under');

  useEffect(() => {
    return () => {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    };
  }, []);

  const handleRoll = async () => {
    if (rolling) return;
    if (stake > (user?.balance || 0)) {
      toast.error('Insufficient balance');
      return;
    }

    const winChance = getWinChance(target, direction);
    if (winChance <= 0 || winChance >= 99) {
      toast.error('Invalid target / direction combination');
      return;
    }

    setRolling(true);
    setLastResult(null);
    setHasPlayed(true);

    // Start rolling animation — rapidly changing numbers
    rollIntervalRef.current = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 100) + 1);
    }, 50);

    try {
      const res = await rollDice(stake, target, direction);
      const data = res.data;

      // Continue animation for at least 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Stop animation
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }

      const result = data.gameResult || data;
      setDisplayNumber(result.result);
      setLastResult({
        result: result.result,
        target: result.target,
        direction: result.direction,
        won: result.won,
        multiplier: result.multiplier,
        winChance: result.winChance,
        payout: data.payout || result.payout || 0,
      });

      if (data.balance !== undefined) {
        updateBalance(data.balance);
      }

      if (result.won) {
        toast.success(`Rolled ${result.result}! You won ${formatCurrency(data.payout || result.payout)}!`);
      } else {
        toast.error(`Rolled ${result.result}! You lost.`);
      }
    } catch (err) {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
      setDisplayNumber(null);
      toast.error(err.response?.data?.error || 'Failed to roll dice');
    }
    setRolling(false);
  };

  const resultColor = lastResult
    ? lastResult.won
      ? 'var(--accent-green)'
      : 'var(--accent-red)'
    : 'var(--accent-gold)';

  return (
    <div className="casino-game-page" style={{ maxWidth: 600 }}>
      <h1>🎲 Dice Roll</h1>

      <GameRulesModal
        gameKey="dice"
        title="How to Play Dice Roll"
        rules={[
          'Pick a target number between 2 and 98.',
          'Choose "Over" or "Under" — you\'re betting the roll will land above or below your target.',
          'The dice rolls a random number from 1 to 100.',
          'Higher risk = higher payout! A narrow win chance pays much more.',
          'Multiplier = (99 / win chance%) × 0.97, with a 3% house edge.',
          'Win chance for "Over" = 100 minus your target. For "Under" = your target minus 1.',
        ]}
        payouts={[
          { label: '95% win chance', value: '1.01x' },
          { label: '75% win chance', value: '1.28x' },
          { label: '50% win chance', value: '1.92x' },
          { label: '25% win chance', value: '3.84x' },
          { label: '10% win chance', value: '9.60x' },
          { label: '5% win chance', value: '19.21x' },
          { label: '2% win chance', value: '48.02x' },
        ]}
      />

      {/* Preview Banner */}
      {!hasPlayed && (
        <div className="dice-preview">
          <div className="dice-preview-visual">
            <div className="dice-preview-numbers">
              {[12, 37, 64, 85, 41, 73, 28, 56, 91].map((n, i) => (
                <span key={i} className="dice-preview-num" style={{ opacity: 0.15 + (i % 3) * 0.1 }}>
                  {n}
                </span>
              ))}
            </div>
            <div className="dice-preview-icon">🎲</div>
          </div>
          <div className="dice-preview-overlay">
            <div className="dice-preview-title">DICE ROLL</div>
            <div className="dice-preview-subtitle">Pick over or under. Risk more, win more.</div>
          </div>
        </div>
      )}

      {/* Result Display */}
      {hasPlayed && (
        <div
          className={`dice-result-area ${lastResult ? (lastResult.won ? 'won' : 'lost') : ''} ${rolling ? 'rolling' : ''}`}
        >
          <div
            className="dice-result-number"
            style={{
              color: rolling ? 'var(--accent-gold)' : resultColor,
            }}
          >
            {displayNumber !== null ? displayNumber : '—'}
          </div>
          {lastResult && !rolling && (
            <div className="dice-result-label" style={{ color: resultColor }}>
              {lastResult.won ? `+${formatCurrency(lastResult.payout)}` : `−${formatCurrency(stake)}`}
            </div>
          )}
          {lastResult && !rolling && (
            <div className="dice-result-detail">
              Rolled {lastResult.result} — Target: {direction === 'over' ? '>' : '<'} {lastResult.target}
            </div>
          )}
          {rolling && (
            <div className="dice-result-detail" style={{ color: 'var(--text-muted)' }}>
              Rolling...
            </div>
          )}
        </div>
      )}

      {/* Game Controls */}
      <div className="dice-controls">
        {/* Target Slider */}
        <div className="dice-target-section">
          <label className="dice-label">Target Number</label>
          <div className="dice-target-display">{target}</div>
          <div className="dice-slider-wrapper">
            <span className="dice-slider-bound">2</span>
            <input
              type="range"
              min={2}
              max={98}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="dice-slider"
              disabled={rolling}
            />
            <span className="dice-slider-bound">98</span>
          </div>
          <div className="dice-slider-zones">
            <div
              className="dice-zone dice-zone-under"
              style={{ width: `${((target - 1) / 98) * 100}%` }}
            >
              {underChance > 10 && <span>Under ({underChance}%)</span>}
            </div>
            <div
              className="dice-zone dice-zone-over"
              style={{ width: `${((100 - target) / 98) * 100}%` }}
            >
              {overChance > 10 && <span>Over ({overChance}%)</span>}
            </div>
          </div>
        </div>

        {/* Over / Under Toggle */}
        <div className="dice-direction-section">
          <label className="dice-label">Direction</label>
          <div className="dice-direction-buttons">
            <button
              className={`dice-dir-btn dice-dir-under ${direction === 'under' ? 'active' : ''}`}
              onClick={() => setDirection('under')}
              disabled={rolling}
            >
              <span className="dice-dir-name">UNDER {target}</span>
              <span className="dice-dir-info">{underChance}% chance</span>
              <span className="dice-dir-multi">{underMultiplier.toFixed(2)}x</span>
            </button>
            <button
              className={`dice-dir-btn dice-dir-over ${direction === 'over' ? 'active' : ''}`}
              onClick={() => setDirection('over')}
              disabled={rolling}
            >
              <span className="dice-dir-name">OVER {target}</span>
              <span className="dice-dir-info">{overChance}% chance</span>
              <span className="dice-dir-multi">{overMultiplier.toFixed(2)}x</span>
            </button>
          </div>
        </div>

        {/* Stake Selector */}
        <div className="stake-selector" style={{ marginTop: '0.75rem' }}>
          <label>Bet Amount</label>
          <div className="stake-buttons">
            {BET_AMOUNTS.map(amt => (
              <button
                key={amt}
                className={`btn btn-sm ${stake === amt ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStake(amt)}
                disabled={rolling}
              >
                {formatCurrency(amt)}
              </button>
            ))}
          </div>
        </div>

        {/* Potential Payout Info */}
        <div className="dice-payout-info">
          <div className="dice-payout-row">
            <span>Multiplier</span>
            <span className="dice-payout-val">{getMultiplier(target, direction).toFixed(2)}x</span>
          </div>
          <div className="dice-payout-row">
            <span>Win Chance</span>
            <span className="dice-payout-val">{getWinChance(target, direction)}%</span>
          </div>
          <div className="dice-payout-row">
            <span>Potential Payout</span>
            <span className="dice-payout-val dice-payout-highlight">
              {formatCurrency(Math.round(stake * getMultiplier(target, direction) * 100) / 100)}
            </span>
          </div>
        </div>

        {/* Roll Button */}
        <button
          className="dice-roll-btn"
          onClick={handleRoll}
          disabled={rolling || stake > (user?.balance || 0)}
        >
          {rolling ? 'ROLLING...' : `ROLL — ${formatCurrency(stake)}`}
        </button>
      </div>

      <style>{`
        /* Preview Banner */
        .dice-preview {
          position: relative;
          background: linear-gradient(145deg, #0d1b2a, #1a2c3d);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
          margin-bottom: 1.25rem;
          min-height: 160px;
        }
        .dice-preview-visual {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 1.5rem;
        }
        .dice-preview-numbers {
          position: absolute;
          inset: 0;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 1.25rem;
          padding: 1rem;
          pointer-events: none;
        }
        .dice-preview-num {
          font-size: 1.8rem;
          font-weight: 900;
          font-family: var(--font-mono);
          color: rgba(52, 152, 219, 0.25);
        }
        .dice-preview-icon {
          font-size: 3.5rem;
          position: relative;
          z-index: 1;
          filter: drop-shadow(0 0 20px rgba(52, 152, 219, 0.4));
          animation: dice-float 3s ease-in-out infinite;
        }
        .dice-preview-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at center, rgba(13,27,42,0.3), rgba(13,27,42,0.85));
          z-index: 2;
        }
        .dice-preview-title {
          font-size: 2.5rem;
          font-weight: 900;
          letter-spacing: 6px;
          background: linear-gradient(135deg, #3498db, #2980b9);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: none;
          margin-bottom: 0.3rem;
        }
        .dice-preview-subtitle {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.6);
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        /* Result Area */
        .dice-result-area {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          text-align: center;
          margin-bottom: 1.25rem;
          transition: all 0.3s;
        }
        .dice-result-area.won {
          background: rgba(0, 231, 1, 0.08);
          border-color: rgba(0, 231, 1, 0.3);
          animation: dice-win-pulse 1s ease-in-out 3;
        }
        .dice-result-area.lost {
          background: rgba(255, 68, 68, 0.08);
          border-color: rgba(255, 68, 68, 0.3);
          animation: dice-shake 0.5s ease-in-out;
        }
        .dice-result-area.rolling {
          border-color: rgba(255, 215, 0, 0.3);
        }
        .dice-result-number {
          font-size: 4rem;
          font-weight: 900;
          font-family: var(--font-mono);
          line-height: 1.1;
          transition: color 0.15s;
        }
        .dice-result-area.rolling .dice-result-number {
          animation: dice-number-pulse 0.15s ease-in-out infinite;
        }
        .dice-result-label {
          font-size: 1.4rem;
          font-weight: 800;
          margin-top: 0.25rem;
        }
        .dice-result-detail {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 600;
          margin-top: 0.35rem;
        }

        /* Controls */
        .dice-controls {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
        }
        .dice-label {
          display: block;
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        /* Target Slider */
        .dice-target-section {
          margin-bottom: 1rem;
          text-align: center;
        }
        .dice-target-display {
          font-size: 3rem;
          font-weight: 900;
          font-family: var(--font-mono);
          color: var(--accent-gold);
          line-height: 1.1;
          margin-bottom: 0.25rem;
        }
        .dice-slider-wrapper {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .dice-slider-bound {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          font-family: var(--font-mono);
          min-width: 22px;
          text-align: center;
        }
        .dice-slider {
          flex: 1;
          -webkit-appearance: none;
          appearance: none;
          height: 8px;
          border-radius: 4px;
          background: linear-gradient(
            to right,
            rgba(231, 76, 60, 0.4) 0%,
            rgba(231, 76, 60, 0.4) ${((target - 2) / 96) * 100}%,
            var(--accent-gold) ${((target - 2) / 96) * 100}%,
            var(--accent-gold) ${((target - 2) / 96) * 100 + 1}%,
            rgba(46, 204, 113, 0.4) ${((target - 2) / 96) * 100 + 1}%,
            rgba(46, 204, 113, 0.4) 100%
          );
          outline: none;
          cursor: pointer;
        }
        .dice-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffd700, #b8860b);
          border: 2px solid #fff;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        .dice-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffd700, #b8860b);
          border: 2px solid #fff;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }

        /* Slider zones */
        .dice-slider-zones {
          display: flex;
          gap: 2px;
          border-radius: 6px;
          overflow: hidden;
          height: 26px;
        }
        .dice-zone {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-weight: 700;
          color: rgba(255,255,255,0.8);
          transition: width 0.15s;
        }
        .dice-zone-under {
          background: rgba(231, 76, 60, 0.25);
          border-radius: 6px 0 0 6px;
        }
        .dice-zone-over {
          background: rgba(46, 204, 113, 0.25);
          border-radius: 0 6px 6px 0;
        }

        /* Direction Buttons */
        .dice-direction-section {
          margin-bottom: 0.75rem;
        }
        .dice-direction-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        .dice-dir-btn {
          background: var(--bg-tertiary);
          border: 2px solid transparent;
          border-radius: var(--radius);
          padding: 0.85rem 0.5rem;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          align-items: center;
        }
        .dice-dir-btn:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .dice-dir-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .dice-dir-under {
          border-color: transparent;
        }
        .dice-dir-under.active {
          border-color: var(--accent-red);
          background: rgba(231, 76, 60, 0.1);
          box-shadow: 0 0 12px rgba(231, 76, 60, 0.15);
        }
        .dice-dir-under:hover:not(:disabled) {
          border-color: rgba(231, 76, 60, 0.5);
        }
        .dice-dir-over {
          border-color: transparent;
        }
        .dice-dir-over.active {
          border-color: var(--accent-green);
          background: rgba(46, 204, 113, 0.1);
          box-shadow: 0 0 12px rgba(46, 204, 113, 0.15);
        }
        .dice-dir-over:hover:not(:disabled) {
          border-color: rgba(46, 204, 113, 0.5);
        }
        .dice-dir-name {
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-primary);
        }
        .dice-dir-under.active .dice-dir-name {
          color: var(--accent-red);
        }
        .dice-dir-over.active .dice-dir-name {
          color: var(--accent-green);
        }
        .dice-dir-info {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 600;
        }
        .dice-dir-multi {
          font-size: 0.8rem;
          color: var(--accent-gold);
          font-weight: 700;
          font-family: var(--font-mono);
        }

        /* Payout Info */
        .dice-payout-info {
          margin-top: 1rem;
          background: var(--bg-tertiary);
          border-radius: var(--radius);
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
        }
        .dice-payout-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.3rem 0;
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 600;
        }
        .dice-payout-row + .dice-payout-row {
          border-top: 1px solid rgba(255,255,255,0.04);
        }
        .dice-payout-val {
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-weight: 700;
        }
        .dice-payout-highlight {
          color: var(--accent-gold);
          font-size: 0.9rem;
          font-weight: 800;
        }

        /* Roll Button */
        .dice-roll-btn {
          width: 100%;
          padding: 1rem;
          border-radius: var(--radius);
          font-weight: 800;
          font-size: 1.1rem;
          cursor: pointer;
          border: none;
          background: linear-gradient(135deg, #3498db, #2471a3);
          color: #fff;
          transition: all 0.15s;
          letter-spacing: 0.5px;
        }
        .dice-roll-btn:hover:not(:disabled) {
          transform: scale(1.02);
          box-shadow: 0 0 20px rgba(52, 152, 219, 0.3);
        }
        .dice-roll-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .dice-roll-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Animations */
        @keyframes dice-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes dice-win-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 231, 1, 0); }
          50% { box-shadow: 0 0 24px 4px rgba(0, 231, 1, 0.2); }
        }
        @keyframes dice-shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
          90% { transform: translateX(2px); }
        }
        @keyframes dice-number-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        /* Mobile */
        @media (max-width: 480px) {
          .dice-target-display { font-size: 2.2rem; }
          .dice-result-number { font-size: 3rem; }
          .dice-direction-buttons { gap: 0.5rem; }
          .dice-dir-btn { padding: 0.65rem 0.35rem; }
          .dice-preview-title { font-size: 2rem; letter-spacing: 4px; }
        }
      `}</style>
    </div>
  );
}
