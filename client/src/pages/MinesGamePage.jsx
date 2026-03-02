import { useState, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { startMines, revealMine, cashoutMines } from '../api/casino';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

const DIFFICULTIES = {
  easy:   { mines: 3,  label: 'Easy',   color: '#27ae60', maxMulti: '~8x' },
  medium: { mines: 5,  label: 'Medium', color: '#e67e22', maxMulti: '~24x' },
  hard:   { mines: 7,  label: 'Hard',   color: '#e74c3c', maxMulti: '~72x' },
};

export default function MinesGamePage() {
  const { user, updateBalance } = useContext(AuthContext);
  const [difficulty, setDifficulty] = useState('easy');
  const [stake, setStake] = useState(BET_AMOUNTS[0]);
  const [gameId, setGameId] = useState(null);
  const [gameActive, setGameActive] = useState(false);
  const [tiles, setTiles] = useState(Array(25).fill('hidden'));
  const [multiplier, setMultiplier] = useState(1);
  const [nextMultiplier, setNextMultiplier] = useState(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [minePositions, setMinePositions] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState(null); // 'won' | 'lost' | null
  const [loading, setLoading] = useState(false);
  const [revealingTile, setRevealingTile] = useState(null);
  const [lastPayout, setLastPayout] = useState(0);

  const currentStake = stake;
  const potentialPayout = Math.round(currentStake * multiplier * 100) / 100;

  const handleStart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await startMines(stake, difficulty);
      const data = res.data;
      setGameId(data.gameId);
      setGameActive(true);
      setTiles(Array(25).fill('hidden'));
      setMultiplier(1);
      setNextMultiplier(null);
      setRevealedCount(0);
      setMinePositions([]);
      setGameOver(false);
      setGameResult(null);
      setLastPayout(0);
      updateBalance(data.balance);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start game');
    }
    setLoading(false);
  }, [stake, difficulty, updateBalance]);

  const handleReveal = useCallback(async (index) => {
    if (!gameActive || gameOver || tiles[index] !== 'hidden' || loading) return;

    setRevealingTile(index);
    try {
      const res = await revealMine(gameId, index);
      const data = res.data;

      if (data.isMine) {
        // Hit a mine
        const newTiles = [...tiles];
        newTiles[index] = 'mine';
        // Reveal all mines
        data.minePositions.forEach(pos => {
          if (pos !== index) newTiles[pos] = 'mine-revealed';
        });
        setTiles(newTiles);
        setMinePositions(data.minePositions);
        setMultiplier(0);
        setGameOver(true);
        setGameActive(false);
        setGameResult('lost');
        if (data.balance !== undefined) updateBalance(data.balance);
        toast.error('BOOM! You hit a mine!');
      } else {
        // Safe tile
        const newTiles = [...tiles];
        newTiles[index] = 'gem';
        setTiles(newTiles);
        setMultiplier(data.multiplier);
        setNextMultiplier(data.nextMultiplier || null);
        setRevealedCount(data.revealedTiles.length);
        setLastPayout(data.payout);

        if (data.allRevealed) {
          // All safe tiles found
          data.minePositions.forEach(pos => {
            newTiles[pos] = 'mine-revealed';
          });
          setTiles(newTiles);
          setMinePositions(data.minePositions);
          setGameOver(true);
          setGameActive(false);
          setGameResult('won');
          if (data.balance !== undefined) updateBalance(data.balance);
          toast.success(`All gems found! Won ${formatCurrency(data.payout)}!`);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reveal tile');
    }
    setRevealingTile(null);
  }, [gameActive, gameOver, tiles, loading, gameId, updateBalance]);

  const handleCashout = useCallback(async () => {
    if (!gameActive || gameOver || revealedCount === 0) return;

    setLoading(true);
    try {
      const res = await cashoutMines(gameId);
      const data = res.data;

      // Reveal all mines
      const newTiles = [...tiles];
      data.minePositions.forEach(pos => {
        if (newTiles[pos] === 'hidden') newTiles[pos] = 'mine-revealed';
      });
      setTiles(newTiles);
      setMinePositions(data.minePositions);
      setMultiplier(data.multiplier);
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
  }, [gameActive, gameOver, revealedCount, gameId, tiles, updateBalance]);

  const getTileContent = (index) => {
    const state = tiles[index];
    if (state === 'gem') return { icon: '💎', cls: 'mines-tile--gem' };
    if (state === 'mine') return { icon: '💣', cls: 'mines-tile--mine-hit' };
    if (state === 'mine-revealed') return { icon: '💣', cls: 'mines-tile--mine' };
    if (revealingTile === index) return { icon: '...', cls: 'mines-tile--revealing' };
    return { icon: '', cls: 'mines-tile--hidden' };
  };

  const diff = DIFFICULTIES[difficulty];

  return (
    <div className="casino-game-page" style={{ maxWidth: 640 }}>
      <h1>💣 Mines</h1>

      <GameRulesModal
        gameKey="mines"
        title="How to Play Mines"
        rules={[
          'Choose a difficulty level — more mines means higher risk and bigger rewards.',
          'Place your bet and start the game.',
          'Click tiles to reveal them — find gems to increase your multiplier.',
          'Cash out anytime to lock in your winnings!',
          'Hit a mine and you lose your entire bet.',
          'Each safe tile you reveal increases the risk and the multiplier.',
        ]}
        payouts={[
          { label: 'Easy (3 mines)', value: 'Up to ~8x' },
          { label: 'Medium (5 mines)', value: 'Up to ~24x' },
          { label: 'Hard (7 mines)', value: 'Up to ~72x' },
        ]}
      />

      {/* Difficulty Selector */}
      {!gameActive && !gameOver && (
        <div className="mines-setup">
          <div className="mines-difficulty-tabs">
            {Object.entries(DIFFICULTIES).map(([key, d]) => (
              <button
                key={key}
                className={`mines-diff-tab ${difficulty === key ? 'active' : ''}`}
                onClick={() => setDifficulty(key)}
                style={{
                  '--diff-color': d.color,
                  borderColor: difficulty === key ? d.color : 'transparent',
                }}
              >
                <span className="mines-diff-label">{d.label}</span>
                <span className="mines-diff-info">{d.mines} mines</span>
                <span className="mines-diff-max">{d.maxMulti}</span>
              </button>
            ))}
          </div>

          <div className="stake-selector" style={{ marginTop: '1rem' }}>
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
            className="btn btn-primary mines-start-btn"
            onClick={handleStart}
            disabled={loading || stake > (user?.balance || 0)}
            style={{ marginTop: '1rem', width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 800 }}
          >
            {loading ? 'Starting...' : `START GAME — ${formatCurrency(stake)}`}
          </button>
        </div>
      )}

      {/* Game Grid */}
      {(gameActive || gameOver) && (
        <div className="mines-game-area">
          {/* Info Bar */}
          <div className="mines-info-bar">
            <div className="mines-info-item">
              <span className="mines-info-label">Difficulty</span>
              <span className="mines-info-value" style={{ color: diff.color }}>{diff.label}</span>
            </div>
            <div className="mines-info-item">
              <span className="mines-info-label">Bet</span>
              <span className="mines-info-value">{formatCurrency(currentStake)}</span>
            </div>
            <div className="mines-info-item">
              <span className="mines-info-label">Mines</span>
              <span className="mines-info-value" style={{ color: '#e74c3c' }}>{diff.mines}</span>
            </div>
            <div className="mines-info-item">
              <span className="mines-info-label">Revealed</span>
              <span className="mines-info-value">{revealedCount}/{25 - diff.mines}</span>
            </div>
          </div>

          {/* Multiplier Display */}
          <div className={`mines-multiplier-display ${gameResult === 'won' ? 'won' : ''} ${gameResult === 'lost' ? 'lost' : ''}`}>
            <div className="mines-multiplier-value">
              {gameResult === 'lost' ? '0.00x' : `${multiplier.toFixed(2)}x`}
            </div>
            {gameActive && revealedCount > 0 && (
              <div className="mines-payout-preview">
                Payout: {formatCurrency(potentialPayout)}
              </div>
            )}
            {gameResult === 'won' && (
              <div className="mines-win-amount">
                +{formatCurrency(lastPayout)}
              </div>
            )}
            {gameResult === 'lost' && (
              <div className="mines-lose-text">
                Mine Hit!
              </div>
            )}
          </div>

          {/* 5x5 Grid */}
          <div className="mines-grid">
            {Array.from({ length: 25 }, (_, i) => {
              const { icon, cls } = getTileContent(i);
              const isClickable = gameActive && !gameOver && tiles[i] === 'hidden';
              return (
                <button
                  key={i}
                  className={`mines-tile ${cls}`}
                  onClick={() => isClickable && handleReveal(i)}
                  disabled={!isClickable}
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                >
                  <span className="mines-tile-icon">{icon}</span>
                </button>
              );
            })}
          </div>

          {/* Cash Out Button */}
          {gameActive && !gameOver && revealedCount > 0 && (
            <button
              className="mines-cashout-btn"
              onClick={handleCashout}
              disabled={loading}
            >
              {loading ? 'Cashing out...' : `CASH OUT — ${formatCurrency(potentialPayout)}`}
            </button>
          )}

          {/* Next multiplier hint */}
          {gameActive && !gameOver && nextMultiplier && (
            <div className="mines-next-hint">
              Next tile: {nextMultiplier.toFixed(2)}x ({formatCurrency(Math.round(currentStake * nextMultiplier * 100) / 100)})
            </div>
          )}

          {/* Game Over Actions */}
          {gameOver && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setGameOver(false);
                setGameActive(false);
                setGameResult(null);
                setTiles(Array(25).fill('hidden'));
                setRevealedCount(0);
                setMinePositions([]);
                setMultiplier(1);
                setNextMultiplier(null);
                setLastPayout(0);
              }}
              style={{ marginTop: '1rem', width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 700 }}
            >
              NEW GAME
            </button>
          )}
        </div>
      )}

      <style>{`
        .mines-setup {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
        }
        .mines-difficulty-tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }
        .mines-diff-tab {
          background: var(--bg-tertiary);
          border: 2px solid transparent;
          border-radius: var(--radius);
          padding: 1rem 0.5rem;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          align-items: center;
        }
        .mines-diff-tab:hover {
          border-color: var(--diff-color);
          transform: translateY(-2px);
        }
        .mines-diff-tab.active {
          background: rgba(255,255,255,0.05);
          box-shadow: 0 0 16px rgba(230, 126, 34, 0.15);
        }
        .mines-diff-label {
          font-size: 1rem;
          font-weight: 800;
          color: var(--diff-color);
        }
        .mines-diff-info {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
        }
        .mines-diff-max {
          font-size: 0.7rem;
          color: var(--accent-gold);
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .mines-game-area {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
        }
        .mines-info-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
          background: var(--bg-tertiary);
          border-radius: var(--radius);
          padding: 0.75rem;
        }
        .mines-info-item {
          text-align: center;
        }
        .mines-info-label {
          display: block;
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .mines-info-value {
          display: block;
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        .mines-multiplier-display {
          text-align: center;
          padding: 1rem;
          margin-bottom: 1rem;
          border-radius: var(--radius);
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          transition: all 0.3s;
        }
        .mines-multiplier-display.won {
          background: rgba(0, 231, 1, 0.1);
          border-color: rgba(0, 231, 1, 0.3);
          animation: mines-win-pulse 1s ease-in-out 3;
        }
        .mines-multiplier-display.lost {
          background: rgba(255, 68, 68, 0.1);
          border-color: rgba(255, 68, 68, 0.3);
          animation: mines-shake 0.5s ease-in-out;
        }
        .mines-multiplier-value {
          font-size: 2.2rem;
          font-weight: 900;
          font-family: var(--font-mono);
          color: var(--accent-gold);
          line-height: 1.2;
        }
        .mines-multiplier-display.lost .mines-multiplier-value {
          color: var(--accent-red);
        }
        .mines-multiplier-display.won .mines-multiplier-value {
          color: var(--accent-green);
        }
        .mines-payout-preview {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 600;
          margin-top: 0.25rem;
        }
        .mines-win-amount {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--accent-green);
          margin-top: 0.25rem;
        }
        .mines-lose-text {
          font-size: 1rem;
          font-weight: 700;
          color: var(--accent-red);
          margin-top: 0.25rem;
        }

        .mines-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          margin-bottom: 1rem;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }
        .mines-tile {
          aspect-ratio: 1;
          border-radius: 10px;
          border: 2px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }
        .mines-tile-icon {
          position: relative;
          z-index: 2;
        }
        .mines-tile--hidden {
          background: linear-gradient(145deg, #1e3a4f, #162d3e);
          border-color: rgba(255,255,255,0.08);
        }
        .mines-tile--hidden:hover:not(:disabled) {
          background: linear-gradient(145deg, #264d66, #1e3a4f);
          border-color: rgba(230, 126, 34, 0.4);
          transform: scale(1.03);
          box-shadow: 0 0 12px rgba(230, 126, 34, 0.15);
        }
        .mines-tile--hidden:active:not(:disabled) {
          transform: scale(0.97);
        }
        .mines-tile--gem {
          background: linear-gradient(145deg, #1a4a2e, #0d3b1e);
          border-color: rgba(0, 231, 1, 0.3);
          box-shadow: 0 0 12px rgba(0, 231, 1, 0.15);
          animation: mines-gem-reveal 0.4s ease-out;
        }
        .mines-tile--mine-hit {
          background: linear-gradient(145deg, #5c1a1a, #3b0d0d);
          border-color: rgba(255, 68, 68, 0.5);
          box-shadow: 0 0 16px rgba(255, 68, 68, 0.3);
          animation: mines-shake 0.5s ease-in-out;
        }
        .mines-tile--mine {
          background: linear-gradient(145deg, #3b2020, #2a1515);
          border-color: rgba(255, 68, 68, 0.2);
          animation: mines-mine-fade 0.5s ease-out;
        }
        .mines-tile--revealing {
          background: linear-gradient(145deg, #2a4a5f, #1e3a4f);
          border-color: rgba(230, 126, 34, 0.3);
          animation: mines-tile-pulse 0.6s ease-in-out infinite;
        }

        .mines-cashout-btn {
          width: 100%;
          padding: 1rem;
          border-radius: var(--radius);
          font-weight: 800;
          font-size: 1.1rem;
          cursor: pointer;
          border: none;
          background: linear-gradient(135deg, #00e701, #00a801);
          color: #000;
          animation: mines-cashout-pulse 1.5s ease-in-out infinite;
          transition: transform 0.15s;
          margin-bottom: 0.5rem;
        }
        .mines-cashout-btn:hover {
          transform: scale(1.02);
        }
        .mines-cashout-btn:active {
          transform: scale(0.98);
        }
        .mines-cashout-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          animation: none;
        }

        .mines-next-hint {
          text-align: center;
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 600;
          padding: 0.25rem;
        }

        @keyframes mines-gem-reveal {
          0% { transform: scale(0.5) rotateY(90deg); opacity: 0; }
          50% { transform: scale(1.15) rotateY(0deg); opacity: 1; }
          100% { transform: scale(1) rotateY(0deg); }
        }
        @keyframes mines-shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
          90% { transform: translateX(2px); }
        }
        @keyframes mines-mine-fade {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes mines-tile-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes mines-win-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 231, 1, 0); }
          50% { box-shadow: 0 0 24px 4px rgba(0, 231, 1, 0.2); }
        }
        @keyframes mines-cashout-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 231, 1, 0.3); }
          50% { box-shadow: 0 0 20px 4px rgba(0, 231, 1, 0.25); }
        }

        @media (max-width: 480px) {
          .mines-grid { gap: 4px; }
          .mines-tile { font-size: 1.2rem; border-radius: 8px; }
          .mines-info-bar { grid-template-columns: repeat(2, 1fr); }
          .mines-difficulty-tabs { gap: 0.5rem; }
          .mines-diff-tab { padding: 0.75rem 0.25rem; }
        }
      `}</style>
    </div>
  );
}
