import { useState, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import GameRulesModal from '../components/common/GameRulesModal';
import toast from 'react-hot-toast';
import api from '../api/axios';
import './CasinoGame.css';

const TOWER_RULES = [
  'Choose a difficulty: Easy (4 tiles, 1 trap), Medium (3 tiles, 1 trap), Hard (2 tiles, 1 trap).',
  'Each floor has hidden tiles — one or more are traps!',
  'Pick a safe tile to climb to the next floor.',
  'The higher you climb, the bigger your multiplier grows.',
  'Cash out anytime to lock in your winnings.',
  'Hit a trap and you lose your entire bet!',
  'Reach the top (Floor 8) for the maximum payout.',
];

const TOWER_PAYOUTS = [
  { label: 'Easy - Floor 8', value: 'Up to ~4.01x' },
  { label: 'Medium - Floor 8', value: 'Up to ~6.30x' },
  { label: 'Hard - Floor 8', value: 'Up to ~248x' },
  { label: 'Hit a trap', value: 'Lose bet' },
];

const DIFF_CONFIG = {
  easy:   { label: 'Easy',   color: '#00e701', columns: 4, desc: '4 tiles, 1 trap' },
  medium: { label: 'Medium', color: '#ffa500', columns: 3, desc: '3 tiles, 1 trap' },
  hard:   { label: 'Hard',   color: '#ff4444', columns: 2, desc: '2 tiles, 1 trap' },
};

export default function TowerGamePage() {
  const { user, refreshBalance } = useContext(AuthContext);

  // Setup state
  const [difficulty, setDifficulty] = useState('easy');
  const [stake, setStake] = useState(100);
  const [loading, setLoading] = useState(false);

  // Game state
  const [gameId, setGameId] = useState(null);
  const [gameActive, setGameActive] = useState(false);
  const [columns, setColumns] = useState(4);
  const [rows] = useState(8);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [nextMultiplier, setNextMultiplier] = useState(1);
  const [revealedTiles, setRevealedTiles] = useState([]); // [{row, col, safe: bool}]
  const [trapMap, setTrapMap] = useState(null);
  const [gameResult, setGameResult] = useState(null); // 'won' | 'lost' | null
  const [payout, setPayout] = useState(0);
  const [animatingTile, setAnimatingTile] = useState(null);

  const diffConfig = DIFF_CONFIG[difficulty];

  const handleStart = useCallback(async () => {
    if (!user) return toast.error('Please login first');
    setLoading(true);
    try {
      const res = await api.post('/casino/tower/start', { stake, difficulty });
      const data = res.data;
      setGameId(data.gameId);
      setGameActive(true);
      setColumns(data.columns);
      setCurrentFloor(0);
      setMultiplier(1);
      setNextMultiplier(data.nextMultiplier);
      setRevealedTiles([]);
      setTrapMap(null);
      setGameResult(null);
      setPayout(0);
      setAnimatingTile(null);
      refreshBalance?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start game');
    }
    setLoading(false);
  }, [user, stake, difficulty, refreshBalance]);

  const handleClimb = useCallback(async (col) => {
    if (!gameId || !gameActive || loading) return;
    if (animatingTile) return;

    setLoading(true);
    setAnimatingTile({ row: currentFloor, col });

    try {
      const res = await api.post('/casino/tower/climb', { gameId, column: col });
      const data = res.data;

      // Small delay for animation
      await new Promise(r => setTimeout(r, 400));

      if (data.isTrap) {
        setRevealedTiles(prev => [...prev, { row: data.row, col, safe: false }]);
        setTrapMap(data.trapMap);
        setGameResult('lost');
        setGameActive(false);
        setMultiplier(0);
        setPayout(0);
        refreshBalance?.();
        toast.error('You hit a trap! Game over.');
      } else {
        setRevealedTiles(prev => [...prev, { row: data.row, col, safe: true }]);
        setCurrentFloor(data.currentFloor);
        setMultiplier(data.multiplier);
        setPayout(data.payout);

        if (data.reachedTop) {
          setTrapMap(data.trapMap);
          setGameResult('won');
          setGameActive(false);
          refreshBalance?.();
          toast.success(`You reached the top! Won ${formatCurrency(data.payout)}!`);
        } else {
          setNextMultiplier(data.nextMultiplier);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to climb');
    }

    setAnimatingTile(null);
    setLoading(false);
  }, [gameId, gameActive, loading, currentFloor, animatingTile, refreshBalance]);

  const handleCashout = useCallback(async () => {
    if (!gameId || !gameActive || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/casino/tower/cashout', { gameId });
      const data = res.data;
      setTrapMap(data.trapMap);
      setMultiplier(data.multiplier);
      setPayout(data.payout);
      setGameResult('won');
      setGameActive(false);
      refreshBalance?.();
      toast.success(`Cashed out! Won ${formatCurrency(data.payout)}!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cash out');
    }
    setLoading(false);
  }, [gameId, gameActive, loading, refreshBalance]);

  const resetGame = () => {
    setGameId(null);
    setGameActive(false);
    setRevealedTiles([]);
    setTrapMap(null);
    setGameResult(null);
    setCurrentFloor(0);
    setMultiplier(1);
    setPayout(0);
    setAnimatingTile(null);
  };

  // Get tile state for rendering
  const getTileState = (row, col) => {
    const revealed = revealedTiles.find(t => t.row === row && t.col === col);
    if (revealed) return revealed.safe ? 'safe' : 'trap';

    // After game over, show all traps
    if (trapMap && trapMap[row]?.includes(col)) return 'trap-revealed';

    // Animating tile
    if (animatingTile?.row === row && animatingTile?.col === col) return 'animating';

    return 'hidden';
  };

  const isClickableRow = (row) => {
    return gameActive && row === currentFloor && !loading;
  };

  // ===================== RENDER =====================

  // Pre-game setup
  if (!gameActive && !gameResult) {
    return (
      <div className="casino-game-page" style={{ maxWidth: 560 }}>
        <GameRulesModal gameKey="tower" title="How to Play Tower" rules={TOWER_RULES} payouts={TOWER_PAYOUTS} />
        <h1>🏗️ Tower</h1>

        <div className="tower-setup">
          {/* Preview tower */}
          <div className="tower-preview">
            {Array.from({ length: 8 }, (_, i) => 8 - 1 - i).map(row => (
              <div key={row} className="tower-preview-row">
                <span className="tower-floor-label">{row + 1}</span>
                {Array.from({ length: DIFF_CONFIG[difficulty].columns }, (_, col) => (
                  <div key={col} className="tower-preview-tile" style={{ borderColor: diffConfig.color + '44' }}>
                    <span style={{ opacity: 0.2 }}>?</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Difficulty tabs */}
          <div className="tower-diff-tabs">
            {Object.entries(DIFF_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                className={`tower-diff-tab ${difficulty === key ? 'active' : ''}`}
                style={{ '--tab-color': cfg.color }}
                onClick={() => setDifficulty(key)}
              >
                <strong>{cfg.label}</strong>
                <span>{cfg.desc}</span>
              </button>
            ))}
          </div>

          {/* Stake selector */}
          <div className="stake-selector" style={{ marginTop: '1rem' }}>
            <label>Bet Amount</label>
            <div className="stake-buttons">
              {BET_AMOUNTS.map(amt => (
                <button key={amt} className={`btn btn-sm ${stake === amt ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setStake(amt)}>
                  {formatCurrency(amt)}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary btn-lg w-full" style={{ marginTop: '1rem' }}
            onClick={handleStart} disabled={loading || !user}>
            {loading ? 'Starting...' : `🏗️ START TOWER — ₹${formatCurrency(stake)}`}
          </button>
        </div>

        <style>{towerCSS}</style>
      </div>
    );
  }

  // Active game or game over
  return (
    <div className="casino-game-page" style={{ maxWidth: 560 }}>
      <GameRulesModal gameKey="tower" title="How to Play Tower" rules={TOWER_RULES} payouts={TOWER_PAYOUTS} />
      <h1>🏗️ Tower</h1>

      {/* Info bar */}
      <div className="tower-info-bar">
        <div className="tower-info-item">
          <span className="tower-info-label">Difficulty</span>
          <span style={{ color: diffConfig.color, fontWeight: 700 }}>{diffConfig.label}</span>
        </div>
        <div className="tower-info-item">
          <span className="tower-info-label">Bet</span>
          <span>₹{formatCurrency(stake)}</span>
        </div>
        <div className="tower-info-item">
          <span className="tower-info-label">Floor</span>
          <span>{currentFloor}/{rows}</span>
        </div>
        <div className="tower-info-item">
          <span className="tower-info-label">Multiplier</span>
          <span style={{ color: '#ffd700', fontWeight: 700 }}>{multiplier}x</span>
        </div>
      </div>

      {/* Multiplier / payout display */}
      {gameActive && currentFloor > 0 && (
        <div className="tower-payout-display">
          <div className="tower-payout-amount">₹{formatCurrency(payout)}</div>
          <div className="tower-payout-hint">Next floor: {nextMultiplier}x</div>
        </div>
      )}

      {/* Tower grid — rendered bottom to top */}
      <div className="tower-grid">
        {Array.from({ length: rows }, (_, i) => rows - 1 - i).map(row => {
          const clickable = isClickableRow(row);
          const isCleared = row < currentFloor;
          const isCurrent = row === currentFloor && gameActive;

          return (
            <div key={row} className={`tower-row ${isCleared ? 'cleared' : ''} ${isCurrent ? 'current' : ''}`}>
              <span className="tower-floor-num">{row + 1}</span>
              <div className="tower-tiles">
                {Array.from({ length: columns }, (_, col) => {
                  const state = getTileState(row, col);
                  return (
                    <button
                      key={col}
                      className={`tower-tile tower-tile--${state} ${clickable ? 'clickable' : ''}`}
                      onClick={() => clickable && handleClimb(col)}
                      disabled={!clickable}
                      style={{
                        '--tile-color': diffConfig.color,
                      }}
                    >
                      {state === 'safe' && <span className="tower-tile-icon">⭐</span>}
                      {state === 'trap' && <span className="tower-tile-icon">💀</span>}
                      {state === 'trap-revealed' && <span className="tower-tile-icon trap-fade">💀</span>}
                      {state === 'animating' && <span className="tower-tile-icon pulse">⭐</span>}
                      {state === 'hidden' && <span className="tower-tile-icon hidden-q">?</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cashout button */}
      {gameActive && currentFloor > 0 && (
        <button className="tower-cashout-btn" onClick={handleCashout} disabled={loading}>
          💰 CASH OUT — ₹{formatCurrency(payout)} ({multiplier}x)
        </button>
      )}

      {gameActive && currentFloor === 0 && (
        <div className="tower-hint">👆 Pick a tile on Floor 1 to start climbing!</div>
      )}

      {/* Game over */}
      {gameResult && (
        <div className={`tower-result ${gameResult}`}>
          {gameResult === 'won' ? (
            <>
              <div className="tower-result-title">🎉 YOU WON!</div>
              <div className="tower-result-amount">₹{formatCurrency(payout)}</div>
              <div className="tower-result-mult">{multiplier}x multiplier — Floor {currentFloor}</div>
            </>
          ) : (
            <>
              <div className="tower-result-title">💀 GAME OVER</div>
              <div className="tower-result-amount" style={{ color: '#ff4444' }}>You lost ₹{formatCurrency(stake)}</div>
              <div className="tower-result-mult">Hit a trap on Floor {currentFloor + 1}</div>
            </>
          )}
          <button className="btn btn-primary btn-lg" style={{ marginTop: '1rem' }} onClick={resetGame}>
            🔄 NEW GAME
          </button>
        </div>
      )}

      <style>{towerCSS}</style>
    </div>
  );
}

// ===================== STYLES =====================
const towerCSS = `
  /* Setup */
  .tower-setup {
    background: #1a2c38;
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid #2a3a4a;
  }

  .tower-preview {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 1.2rem;
    padding: 0.75rem;
    background: #0f1923;
    border-radius: 8px;
  }

  .tower-preview-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .tower-floor-label {
    width: 24px;
    text-align: center;
    font-size: 0.7rem;
    color: #7a8a9e;
    font-weight: 600;
  }

  .tower-preview-tile {
    flex: 1;
    height: 28px;
    background: #1a2c38;
    border: 1px solid;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    color: #7a8a9e;
  }

  /* Difficulty tabs */
  .tower-diff-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .tower-diff-tab {
    background: #0f1923;
    border: 2px solid #2a3a4a;
    border-radius: 8px;
    padding: 0.6rem 0.4rem;
    text-align: center;
    cursor: pointer;
    color: #ccc;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tower-diff-tab strong { font-size: 0.85rem; }
  .tower-diff-tab span { font-size: 0.65rem; color: #7a8a9e; }

  .tower-diff-tab.active {
    border-color: var(--tab-color);
    background: color-mix(in srgb, var(--tab-color) 10%, #0f1923);
    color: #fff;
  }

  .tower-diff-tab:hover { border-color: var(--tab-color); }

  /* Info bar */
  .tower-info-bar {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    background: #1a2c38;
    border-radius: 8px;
    padding: 0.6rem;
    border: 1px solid #2a3a4a;
  }

  .tower-info-item {
    flex: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tower-info-label {
    font-size: 0.6rem;
    color: #7a8a9e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tower-info-item > span:last-child {
    font-size: 0.85rem;
    font-weight: 600;
    color: #e0e0e0;
  }

  /* Payout display */
  .tower-payout-display {
    text-align: center;
    margin-bottom: 0.75rem;
    padding: 0.6rem;
    background: linear-gradient(135deg, #1a2c38, #0f1923);
    border-radius: 8px;
    border: 1px solid #ffd70044;
  }

  .tower-payout-amount {
    font-size: 1.5rem;
    font-weight: 800;
    color: #ffd700;
  }

  .tower-payout-hint {
    font-size: 0.75rem;
    color: #7a8a9e;
    margin-top: 2px;
  }

  /* Tower grid */
  .tower-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0.75rem;
    background: #0f1923;
    border-radius: 12px;
    border: 1px solid #2a3a4a;
    margin-bottom: 0.75rem;
  }

  .tower-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    transition: all 0.3s;
  }

  .tower-row.current {
    background: rgba(255, 215, 0, 0.05);
    border-radius: 8px;
    padding: 4px 6px;
  }

  .tower-row.cleared {
    opacity: 0.6;
  }

  .tower-floor-num {
    width: 24px;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: #7a8a9e;
  }

  .tower-row.current .tower-floor-num {
    color: #ffd700;
  }

  .tower-tiles {
    display: flex;
    gap: 6px;
    flex: 1;
  }

  /* Tiles */
  .tower-tile {
    flex: 1;
    height: 48px;
    border-radius: 8px;
    border: 2px solid #2a3a4a;
    background: #1a2c38;
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.25s;
    position: relative;
    overflow: hidden;
  }

  .tower-tile.clickable {
    cursor: pointer;
    border-color: var(--tile-color, #ffd700);
    animation: tile-glow 1.5s ease-in-out infinite;
  }

  .tower-tile.clickable:hover {
    background: color-mix(in srgb, var(--tile-color, #ffd700) 20%, #1a2c38);
    transform: scale(1.05);
    box-shadow: 0 0 15px color-mix(in srgb, var(--tile-color, #ffd700) 30%, transparent);
  }

  .tower-tile--safe {
    background: linear-gradient(135deg, #00e701, #00c853) !important;
    border-color: #00e701 !important;
    animation: safe-reveal 0.4s ease-out !important;
  }

  .tower-tile--trap {
    background: linear-gradient(135deg, #ff4444, #cc0000) !important;
    border-color: #ff4444 !important;
    animation: trap-shake 0.5s ease-out !important;
  }

  .tower-tile--trap-revealed {
    background: rgba(255, 68, 68, 0.15) !important;
    border-color: rgba(255, 68, 68, 0.3) !important;
  }

  .tower-tile--animating {
    background: color-mix(in srgb, var(--tile-color, #ffd700) 30%, #1a2c38) !important;
    border-color: var(--tile-color, #ffd700) !important;
  }

  .tower-tile-icon {
    font-size: 1.3rem;
    z-index: 1;
  }

  .tower-tile-icon.hidden-q {
    font-size: 0.9rem;
    color: #4a5a6a;
    font-weight: 700;
  }

  .tower-tile-icon.pulse {
    animation: icon-pulse 0.4s ease-in-out;
  }

  .tower-tile-icon.trap-fade {
    opacity: 0.4;
  }

  /* Cashout button */
  .tower-cashout-btn {
    width: 100%;
    padding: 1rem;
    background: linear-gradient(135deg, #00e701, #00c853);
    border: none;
    border-radius: 10px;
    color: #000;
    font-size: 1.1rem;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s;
    animation: cashout-glow 1.5s ease-in-out infinite;
    margin-bottom: 0.75rem;
  }

  .tower-cashout-btn:hover {
    transform: scale(1.02);
    box-shadow: 0 0 25px rgba(0, 231, 1, 0.4);
  }

  .tower-cashout-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Hint */
  .tower-hint {
    text-align: center;
    padding: 0.75rem;
    color: #7a8a9e;
    font-size: 0.85rem;
  }

  /* Result */
  .tower-result {
    text-align: center;
    padding: 1.5rem;
    background: #1a2c38;
    border-radius: 12px;
    border: 1px solid #2a3a4a;
    margin-top: 0.75rem;
  }

  .tower-result.won {
    border-color: #00e701;
    background: linear-gradient(135deg, #0f1923, #0a2e0a);
  }

  .tower-result.lost {
    border-color: #ff4444;
    background: linear-gradient(135deg, #0f1923, #2e0a0a);
  }

  .tower-result-title {
    font-size: 1.5rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
  }

  .tower-result.won .tower-result-title { color: #00e701; }
  .tower-result.lost .tower-result-title { color: #ff4444; }

  .tower-result-amount {
    font-size: 1.8rem;
    font-weight: 800;
    color: #00e701;
    margin-bottom: 0.25rem;
  }

  .tower-result-mult {
    font-size: 0.85rem;
    color: #7a8a9e;
  }

  /* Animations */
  @keyframes tile-glow {
    0%, 100% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.1); }
    50% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.2); }
  }

  @keyframes safe-reveal {
    0% { transform: scale(0.8); opacity: 0; }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes trap-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(3px); }
  }

  @keyframes icon-pulse {
    0% { transform: scale(0); }
    60% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  @keyframes cashout-glow {
    0%, 100% { box-shadow: 0 0 10px rgba(0, 231, 1, 0.2); }
    50% { box-shadow: 0 0 25px rgba(0, 231, 1, 0.4); }
  }

  /* Mobile */
  @media (max-width: 480px) {
    .tower-tile { height: 42px; }
    .tower-tile-icon { font-size: 1.1rem; }
    .tower-info-bar { flex-wrap: wrap; }
    .tower-info-item { min-width: 45%; }
  }
`;
