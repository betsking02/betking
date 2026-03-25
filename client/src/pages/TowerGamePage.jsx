import { useState, useContext, useCallback, useRef, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import GameRulesModal from '../components/common/GameRulesModal';
import toast from 'react-hot-toast';
import api from '../api/axios';
import './CasinoGame.css';

const TOWER_RULES = [
  'Place your bet and choose a difficulty level.',
  'Press BUILD to add a new floor to your tower.',
  'Each floor has a chance of collapsing — the harder the difficulty, the riskier!',
  'Your multiplier grows with every floor you successfully build.',
  'Press CASHOUT anytime to collect your winnings.',
  'If the building collapses, you lose your entire bet!',
  'Build as high as you dare!',
];

const TOWER_PAYOUTS = [
  { label: 'Easy (15% risk)', value: 'Up to ~20x' },
  { label: 'Medium (25% risk)', value: 'Up to ~50x' },
  { label: 'Hard (40% risk)', value: 'Up to ~170x' },
  { label: 'Building collapses', value: 'Lose bet' },
];

const DIFF_CONFIG = {
  easy:   { label: 'Easy',   color: '#00e701', risk: '15%', maxFloors: 15 },
  medium: { label: 'Medium', color: '#ffa500', risk: '25%', maxFloors: 12 },
  hard:   { label: 'Hard',   color: '#ff4444', risk: '40%', maxFloors: 10 },
};

// Building floor colors/styles — cycle through these
const FLOOR_STYLES = [
  { bg: '#c8956c', windows: '#87CEEB', trim: '#a0724e', roof: '#d4a574' },
  { bg: '#d4a574', windows: '#FFE4B5', trim: '#b8906a', roof: '#c8956c' },
  { bg: '#b8860b', windows: '#87CEEB', trim: '#8b6914', roof: '#cd9b1d' },
  { bg: '#cd853f', windows: '#B0E0E6', trim: '#a0724e', roof: '#d2b48c' },
  { bg: '#deb887', windows: '#87CEEB', trim: '#c8a882', roof: '#d4a574' },
  { bg: '#bc8f8f', windows: '#FFE4B5', trim: '#a67b7b', roof: '#c9a0a0' },
];

export default function TowerGamePage() {
  const { user, refreshBalance } = useContext(AuthContext);
  const towerRef = useRef(null);

  const [difficulty, setDifficulty] = useState('easy');
  const [stake, setStake] = useState(100);
  const [loading, setLoading] = useState(false);

  const [gameId, setGameId] = useState(null);
  const [gameActive, setGameActive] = useState(false);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [maxFloors, setMaxFloors] = useState(15);
  const [multiplier, setMultiplier] = useState(1);
  const [nextMultiplier, setNextMultiplier] = useState(1);
  const [gameResult, setGameResult] = useState(null); // 'won' | 'lost' | null
  const [payout, setPayout] = useState(0);
  const [collapseFloor, setCollapseFloor] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [collapsing, setCollapsing] = useState(false);

  // Auto-scroll tower into view when new floor is added
  useEffect(() => {
    if (towerRef.current && currentFloor > 0) {
      towerRef.current.scrollTop = 0;
    }
  }, [currentFloor]);

  const handleStart = useCallback(async () => {
    if (!user) return toast.error('Please login first');
    setLoading(true);
    try {
      const res = await api.post('/casino/tower/start', { stake, difficulty });
      const data = res.data;
      setGameId(data.gameId);
      setGameActive(true);
      setMaxFloors(data.maxFloors);
      setCurrentFloor(0);
      setMultiplier(1);
      setNextMultiplier(data.nextMultiplier);
      setGameResult(null);
      setPayout(0);
      setCollapseFloor(null);
      setAnimating(false);
      setCollapsing(false);
      refreshBalance?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start game');
    }
    setLoading(false);
  }, [user, stake, difficulty, refreshBalance]);

  const handleBuild = useCallback(async () => {
    if (!gameId || !gameActive || loading || animating) return;
    setLoading(true);
    setAnimating(true);

    try {
      const res = await api.post('/casino/tower/build', { gameId });
      const data = res.data;

      if (data.collapsed) {
        // Show the floor being built, then collapse
        setCurrentFloor(prev => prev + 1);
        await new Promise(r => setTimeout(r, 600));
        setCollapsing(true);
        setCollapseFloor(data.collapseFloor);
        await new Promise(r => setTimeout(r, 1200));
        setGameResult('lost');
        setGameActive(false);
        setMultiplier(0);
        setPayout(0);
        refreshBalance?.();
        toast.error('The building collapsed!');
      } else {
        setCurrentFloor(data.currentFloor);
        setMultiplier(data.multiplier);
        setPayout(data.payout);

        if (data.reachedTop) {
          await new Promise(r => setTimeout(r, 500));
          setGameResult('won');
          setGameActive(false);
          refreshBalance?.();
          toast.success(`Tower complete! Won ₹${formatCurrency(data.payout)}!`);
        } else {
          setNextMultiplier(data.nextMultiplier);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to build');
    }

    setAnimating(false);
    setLoading(false);
  }, [gameId, gameActive, loading, animating, refreshBalance]);

  const handleCashout = useCallback(async () => {
    if (!gameId || !gameActive || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/casino/tower/cashout', { gameId });
      const data = res.data;
      setMultiplier(data.multiplier);
      setPayout(data.payout);
      setCollapseFloor(data.collapseFloor);
      setGameResult('won');
      setGameActive(false);
      refreshBalance?.();
      toast.success(`Cashed out! Won ₹${formatCurrency(data.payout)}!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cash out');
    }
    setLoading(false);
  }, [gameId, gameActive, loading, refreshBalance]);

  const resetGame = () => {
    setGameId(null);
    setGameActive(false);
    setCurrentFloor(0);
    setMultiplier(1);
    setPayout(0);
    setGameResult(null);
    setCollapseFloor(null);
    setAnimating(false);
    setCollapsing(false);
  };

  const diffConfig = DIFF_CONFIG[difficulty];

  // ===================== RENDER =====================

  // Pre-game setup
  if (!gameActive && !gameResult) {
    return (
      <div className="casino-game-page" style={{ maxWidth: 600 }}>
        <GameRulesModal gameKey="tower" title="How to Play Tower Rush" rules={TOWER_RULES} payouts={TOWER_PAYOUTS} />
        <h1>🏗️ Tower Rush</h1>

        <div className="tr-setup">
          {/* Preview building */}
          <div className="tr-scene tr-scene--preview">
            <div className="tr-sky">
              <div className="tr-cloud tr-cloud--1"></div>
              <div className="tr-cloud tr-cloud--2"></div>
            </div>
            <div className="tr-crane-hook"></div>
            <div className="tr-building-area">
              <div className="tr-floor tr-floor--preview" style={{ '--floor-bg': '#c8956c' }}>
                <div className="tr-windows">
                  <div className="tr-window"></div>
                  <div className="tr-door"></div>
                  <div className="tr-window"></div>
                </div>
              </div>
            </div>
            <div className="tr-ground">
              <div className="tr-ground-label">🏗️ TAP BUILD TO START</div>
            </div>
          </div>

          {/* Difficulty */}
          <div className="tr-diff-tabs">
            {Object.entries(DIFF_CONFIG).map(([key, cfg]) => (
              <button key={key}
                className={`tr-diff-tab ${difficulty === key ? 'active' : ''}`}
                style={{ '--dc': cfg.color }}
                onClick={() => setDifficulty(key)}>
                <strong>{cfg.label}</strong>
                <span>Risk: {cfg.risk}/floor</span>
              </button>
            ))}
          </div>

          {/* Stake */}
          <div className="stake-selector" style={{ marginTop: '1rem' }}>
            <label>Bet Amount</label>
            <div className="stake-buttons">
              {BET_AMOUNTS.map(amt => (
                <button key={amt} className={`btn btn-sm ${stake === amt ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setStake(amt)}>{formatCurrency(amt)}</button>
              ))}
            </div>
          </div>

          <button className="tr-build-btn" onClick={handleStart} disabled={loading || !user}
            style={{ marginTop: '1rem' }}>
            {loading ? 'Starting...' : `🏗️ START — ₹${formatCurrency(stake)}`}
          </button>
        </div>
        <style>{towerCSS}</style>
      </div>
    );
  }

  // Active game or result
  return (
    <div className="casino-game-page" style={{ maxWidth: 600 }}>
      <GameRulesModal gameKey="tower" title="How to Play Tower Rush" rules={TOWER_RULES} payouts={TOWER_PAYOUTS} />
      <h1>🏗️ Tower Rush</h1>

      {/* Info bar */}
      <div className="tr-info-bar">
        <div className="tr-info-item">
          <span className="tr-info-label">Risk</span>
          <span style={{ color: diffConfig.color, fontWeight: 700 }}>{diffConfig.label}</span>
        </div>
        <div className="tr-info-item">
          <span className="tr-info-label">Bet</span>
          <span>₹{formatCurrency(stake)}</span>
        </div>
        <div className="tr-info-item">
          <span className="tr-info-label">Floor</span>
          <span style={{ color: '#ffd700', fontWeight: 700 }}>{currentFloor}/{maxFloors}</span>
        </div>
        <div className="tr-info-item">
          <span className="tr-info-label">Multiplier</span>
          <span style={{ color: '#ffd700', fontWeight: 700 }}>{multiplier > 0 ? `${multiplier}x` : '—'}</span>
        </div>
      </div>

      {/* Tower Scene */}
      <div className={`tr-scene ${collapsing ? 'tr-scene--collapsing' : ''}`} ref={towerRef}>
        {/* Sky with clouds */}
        <div className="tr-sky">
          <div className="tr-cloud tr-cloud--1"></div>
          <div className="tr-cloud tr-cloud--2"></div>
          <div className="tr-cloud tr-cloud--3"></div>
        </div>

        {/* Multiplier display */}
        {currentFloor > 0 && !collapsing && (
          <div className="tr-multiplier-float">
            x{multiplier}
          </div>
        )}

        {/* Crane hook */}
        {gameActive && !collapsing && (
          <div className="tr-crane-hook tr-crane-hook--active"></div>
        )}

        {/* Collapse explosion */}
        {collapsing && (
          <div className="tr-collapse-fx">
            <div className="tr-collapse-text">CRASH!</div>
            <div className="tr-dust">💨💨💨</div>
          </div>
        )}

        {/* Building floors */}
        <div className={`tr-building-area ${collapsing ? 'tr-building--collapse' : ''}`}>
          {Array.from({ length: currentFloor }, (_, i) => {
            const floorNum = currentFloor - i; // top floor first
            const style = FLOOR_STYLES[(floorNum - 1) % FLOOR_STYLES.length];
            const isNew = floorNum === currentFloor && animating;
            const isCollapsed = collapsing && floorNum === currentFloor;

            return (
              <div key={floorNum}
                className={`tr-floor ${isNew ? 'tr-floor--new' : ''} ${isCollapsed ? 'tr-floor--collapsed' : ''}`}
                style={{ '--floor-bg': style.bg, '--floor-trim': style.trim }}>
                <div className="tr-floor-num">{floorNum}</div>
                <div className="tr-windows">
                  {floorNum % 3 === 0 ? (
                    <>
                      <div className="tr-window tr-window--big" style={{ '--win-bg': style.windows }}></div>
                      <div className="tr-window" style={{ '--win-bg': style.windows }}></div>
                    </>
                  ) : floorNum % 2 === 0 ? (
                    <>
                      <div className="tr-window" style={{ '--win-bg': style.windows }}></div>
                      <div className="tr-door"></div>
                      <div className="tr-window" style={{ '--win-bg': style.windows }}></div>
                    </>
                  ) : (
                    <>
                      <div className="tr-window" style={{ '--win-bg': style.windows }}></div>
                      <div className="tr-window" style={{ '--win-bg': style.windows }}></div>
                      <div className="tr-window" style={{ '--win-bg': style.windows }}></div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Ground */}
        <div className="tr-ground">
          {currentFloor === 0 && gameActive && (
            <div className="tr-ground-label">Press BUILD to start!</div>
          )}
        </div>
      </div>

      {/* Control buttons */}
      {gameActive && (
        <div className="tr-controls">
          {currentFloor > 0 && (
            <button className="tr-cashout-btn" onClick={handleCashout} disabled={loading || animating}>
              CASHOUT<br />
              <span className="tr-cashout-amount">₹{formatCurrency(payout)}</span>
            </button>
          )}
          <button className="tr-build-btn" onClick={handleBuild} disabled={loading || animating}>
            {animating ? '🔨 BUILDING...' : `🏗️ BUILD`}
            {!animating && currentFloor > 0 && (
              <span className="tr-build-next"> → {nextMultiplier}x</span>
            )}
          </button>
        </div>
      )}

      {/* Game Result */}
      {gameResult && (
        <div className={`tr-result ${gameResult}`}>
          {gameResult === 'won' ? (
            <>
              <div className="tr-result-title">🎉 CASHED OUT!</div>
              <div className="tr-result-amount">₹{formatCurrency(payout)}</div>
              <div className="tr-result-detail">{multiplier}x — {currentFloor} floor{currentFloor !== 1 ? 's' : ''} built</div>
              {collapseFloor && (
                <div className="tr-result-hint">Building would have collapsed on floor {collapseFloor}</div>
              )}
            </>
          ) : (
            <>
              <div className="tr-result-title">💥 COLLAPSED!</div>
              <div className="tr-result-amount" style={{ color: '#ff4444' }}>-₹{formatCurrency(stake)}</div>
              <div className="tr-result-detail">Building collapsed on floor {currentFloor}</div>
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

const towerCSS = `
  /* ============ SETUP ============ */
  .tr-setup {
    background: #1a2c38;
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid #2a3a4a;
  }

  .tr-diff-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .tr-diff-tab {
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

  .tr-diff-tab strong { font-size: 0.85rem; }
  .tr-diff-tab span { font-size: 0.65rem; color: #7a8a9e; }

  .tr-diff-tab.active {
    border-color: var(--dc);
    background: color-mix(in srgb, var(--dc) 10%, #0f1923);
    color: #fff;
  }
  .tr-diff-tab:hover { border-color: var(--dc); }

  /* ============ INFO BAR ============ */
  .tr-info-bar {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    background: #1a2c38;
    border-radius: 8px;
    padding: 0.6rem;
    border: 1px solid #2a3a4a;
  }

  .tr-info-item {
    flex: 1; text-align: center;
    display: flex; flex-direction: column; gap: 2px;
  }

  .tr-info-label {
    font-size: 0.6rem; color: #7a8a9e;
    text-transform: uppercase; letter-spacing: 0.5px;
  }

  .tr-info-item > span:last-child {
    font-size: 0.85rem; font-weight: 600; color: #e0e0e0;
  }

  /* ============ SCENE ============ */
  .tr-scene {
    position: relative;
    min-height: 380px;
    background: linear-gradient(180deg, #87CEEB 0%, #B0E0E6 40%, #E0F0FF 100%);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 0.75rem;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    border: 2px solid #2a3a4a;
  }

  .tr-scene--preview { min-height: 200px; }

  /* Sky & clouds */
  .tr-sky {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }

  .tr-cloud {
    position: absolute;
    background: white;
    border-radius: 50px;
    opacity: 0.7;
  }

  .tr-cloud::before, .tr-cloud::after {
    content: '';
    position: absolute;
    background: white;
    border-radius: 50%;
  }

  .tr-cloud--1 {
    width: 80px; height: 28px;
    top: 15%; left: 10%;
    animation: cloud-drift 20s linear infinite;
  }
  .tr-cloud--1::before { width: 36px; height: 36px; top: -18px; left: 14px; }
  .tr-cloud--1::after { width: 24px; height: 24px; top: -10px; right: 14px; }

  .tr-cloud--2 {
    width: 60px; height: 22px;
    top: 25%; right: 15%;
    animation: cloud-drift 25s linear infinite reverse;
  }
  .tr-cloud--2::before { width: 28px; height: 28px; top: -14px; left: 10px; }
  .tr-cloud--2::after { width: 20px; height: 20px; top: -8px; right: 10px; }

  .tr-cloud--3 {
    width: 50px; height: 18px;
    top: 10%; left: 50%;
    animation: cloud-drift 18s linear infinite;
  }
  .tr-cloud--3::before { width: 22px; height: 22px; top: -11px; left: 8px; }
  .tr-cloud--3::after { width: 16px; height: 16px; top: -6px; right: 8px; }

  @keyframes cloud-drift {
    0% { transform: translateX(-20px); }
    50% { transform: translateX(20px); }
    100% { transform: translateX(-20px); }
  }

  /* Crane hook */
  .tr-crane-hook {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 40px;
    background: #555;
    z-index: 5;
  }

  .tr-crane-hook::after {
    content: '⚓';
    position: absolute;
    bottom: -12px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 16px;
  }

  .tr-crane-hook--active {
    animation: hook-sway 2s ease-in-out infinite;
  }

  @keyframes hook-sway {
    0%, 100% { transform: translateX(-50%) rotate(-3deg); }
    50% { transform: translateX(-50%) rotate(3deg); }
  }

  /* Multiplier float */
  .tr-multiplier-float {
    position: absolute;
    top: 12px;
    right: 16px;
    background: rgba(0,0,0,0.6);
    color: #ffd700;
    font-size: 1.4rem;
    font-weight: 900;
    padding: 0.3rem 0.8rem;
    border-radius: 8px;
    z-index: 10;
    text-shadow: 0 0 10px rgba(255,215,0,0.5);
  }

  /* ============ BUILDING ============ */
  .tr-building-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 20px;
    z-index: 2;
    transition: all 0.3s;
  }

  .tr-building--collapse {
    animation: building-collapse 1s ease-in forwards;
  }

  @keyframes building-collapse {
    0% { transform: rotate(0deg); opacity: 1; }
    30% { transform: rotate(5deg) translateX(10px); }
    60% { transform: rotate(15deg) translateX(30px); opacity: 0.7; }
    100% { transform: rotate(45deg) translateX(80px) translateY(50px); opacity: 0; }
  }

  /* Floor block */
  .tr-floor {
    width: 180px;
    height: 54px;
    background: var(--floor-bg, #c8956c);
    border: 2px solid var(--floor-trim, #a0724e);
    border-bottom: 3px solid var(--floor-trim, #a0724e);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
    box-shadow: 2px 2px 8px rgba(0,0,0,0.15);
  }

  .tr-floor:last-child {
    border-radius: 0 0 4px 4px;
  }

  .tr-floor:first-child {
    border-radius: 4px 4px 0 0;
  }

  .tr-floor:first-child::before {
    content: '';
    position: absolute;
    top: -8px;
    left: -4px;
    right: -4px;
    height: 8px;
    background: var(--floor-trim, #a0724e);
    border-radius: 3px 3px 0 0;
  }

  .tr-floor--preview {
    width: 160px;
    border-radius: 4px;
  }

  .tr-floor--new {
    animation: floor-drop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes floor-drop {
    0% { transform: translateY(-80px) scale(1.05); opacity: 0; }
    60% { transform: translateY(5px) scale(1); opacity: 1; }
    80% { transform: translateY(-3px); }
    100% { transform: translateY(0); }
  }

  .tr-floor--collapsed {
    animation: floor-crack 0.4s ease-out;
    background: #ff6b6b !important;
    border-color: #ff4444 !important;
  }

  @keyframes floor-crack {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); background: #ff4444; }
    100% { transform: scale(1); }
  }

  .tr-floor-num {
    position: absolute;
    left: 6px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.6rem;
    font-weight: 800;
    color: rgba(255,255,255,0.5);
  }

  /* Windows */
  .tr-windows {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
  }

  .tr-window {
    width: 22px;
    height: 28px;
    background: var(--win-bg, #87CEEB);
    border: 2px solid var(--floor-trim, #a0724e);
    border-radius: 2px 2px 0 0;
    position: relative;
  }

  .tr-window::after {
    content: '';
    position: absolute;
    top: 0; left: 50%;
    width: 2px; height: 100%;
    background: var(--floor-trim, #a0724e);
    transform: translateX(-50%);
  }

  .tr-window--big {
    width: 36px;
    height: 32px;
    border-radius: 6px 6px 0 0;
  }

  .tr-door {
    width: 22px;
    height: 34px;
    background: #8B4513;
    border: 2px solid #654321;
    border-radius: 4px 4px 0 0;
    margin-top: 4px;
  }

  .tr-door::after {
    content: '';
    position: absolute;
    width: 4px; height: 4px;
    background: #ffd700;
    border-radius: 50%;
    right: -2px; top: 50%;
  }

  /* Collapse FX */
  .tr-collapse-fx {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 20;
    text-align: center;
    animation: collapse-appear 0.5s ease-out;
  }

  .tr-collapse-text {
    font-size: 3rem;
    font-weight: 900;
    color: #ff4444;
    text-shadow: 0 0 20px rgba(255,68,68,0.8), 2px 2px 0 #000;
    animation: shake 0.5s ease-in-out;
  }

  .tr-dust {
    font-size: 2rem;
    margin-top: 0.5rem;
    animation: dust-spread 1s ease-out;
  }

  @keyframes collapse-appear {
    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px) rotate(-2deg); }
    40% { transform: translateX(8px) rotate(2deg); }
    60% { transform: translateX(-5px) rotate(-1deg); }
    80% { transform: translateX(5px) rotate(1deg); }
  }

  @keyframes dust-spread {
    0% { transform: scale(0.5); opacity: 1; }
    100% { transform: scale(2); opacity: 0; }
  }

  /* Ground */
  .tr-ground {
    height: 50px;
    background: linear-gradient(180deg, #8B7355 0%, #6B5B45 50%, #554a3a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3;
    border-top: 3px solid #9B8B75;
    position: relative;
  }

  .tr-ground::before {
    content: '';
    position: absolute;
    top: -3px;
    left: 0; right: 0;
    height: 6px;
    background: repeating-linear-gradient(90deg, #ffd700 0px, #ffd700 20px, #333 20px, #333 22px);
  }

  .tr-ground-label {
    color: #ffd700;
    font-weight: 700;
    font-size: 0.8rem;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
  }

  /* ============ CONTROLS ============ */
  .tr-controls {
    display: flex;
    gap: 10px;
    margin-bottom: 0.75rem;
  }

  .tr-build-btn {
    flex: 1;
    padding: 1rem;
    background: linear-gradient(135deg, #f5a623, #e8951f);
    border: 3px solid #c77d15;
    border-bottom: 5px solid #a06010;
    border-radius: 10px;
    color: #000;
    font-size: 1.2rem;
    font-weight: 900;
    cursor: pointer;
    transition: all 0.15s;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-shadow: 0 1px 0 rgba(255,255,255,0.3);
  }

  .tr-build-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(245, 166, 35, 0.4);
  }

  .tr-build-btn:active:not(:disabled) {
    transform: translateY(1px);
    border-bottom-width: 3px;
  }

  .tr-build-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .tr-build-next {
    font-size: 0.8rem;
    opacity: 0.7;
  }

  .tr-cashout-btn {
    flex: 0.7;
    padding: 0.8rem;
    background: linear-gradient(135deg, #00e701, #00c853);
    border: 3px solid #00a040;
    border-bottom: 5px solid #008530;
    border-radius: 10px;
    color: #000;
    font-size: 0.85rem;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
    text-transform: uppercase;
    animation: cashout-pulse 1.5s ease-in-out infinite;
  }

  .tr-cashout-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0, 231, 1, 0.4);
  }

  .tr-cashout-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .tr-cashout-amount {
    font-size: 1.1rem;
    display: block;
    margin-top: 2px;
  }

  @keyframes cashout-pulse {
    0%, 100% { box-shadow: 0 0 5px rgba(0,231,1,0.2); }
    50% { box-shadow: 0 0 20px rgba(0,231,1,0.4); }
  }

  /* ============ RESULT ============ */
  .tr-result {
    text-align: center;
    padding: 1.5rem;
    background: #1a2c38;
    border-radius: 12px;
    border: 1px solid #2a3a4a;
  }

  .tr-result.won {
    border-color: #00e701;
    background: linear-gradient(135deg, #0f1923, #0a2e0a);
  }
  .tr-result.lost {
    border-color: #ff4444;
    background: linear-gradient(135deg, #0f1923, #2e0a0a);
  }

  .tr-result-title {
    font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem;
  }
  .tr-result.won .tr-result-title { color: #00e701; }
  .tr-result.lost .tr-result-title { color: #ff4444; }

  .tr-result-amount {
    font-size: 1.8rem; font-weight: 800; color: #00e701; margin-bottom: 0.25rem;
  }

  .tr-result-detail {
    font-size: 0.85rem; color: #aaa;
  }

  .tr-result-hint {
    font-size: 0.75rem; color: #7a8a9e; margin-top: 0.5rem; font-style: italic;
  }

  /* ============ MOBILE ============ */
  @media (max-width: 480px) {
    .tr-scene { min-height: 320px; }
    .tr-floor { width: 150px; height: 48px; }
    .tr-window { width: 18px; height: 22px; }
    .tr-window--big { width: 30px; height: 26px; }
    .tr-door { width: 18px; height: 28px; }
    .tr-build-btn { font-size: 1rem; padding: 0.8rem; }
    .tr-controls { flex-direction: column; }
    .tr-cashout-btn { flex: 1; }
  }
`;
