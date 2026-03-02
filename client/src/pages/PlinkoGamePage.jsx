import { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { dropPlinko } from '../api/casino';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import toast from 'react-hot-toast';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

const ROWS = 12;
const MULTIPLIERS = [10, 3, 1.6, 1.2, 1.1, 0.5, 0.3, 0.5, 1.1, 1.2, 1.6, 3, 10];

const getSlotColor = (multiplier) => {
  if (multiplier >= 10) return { bg: 'linear-gradient(135deg, #ffd700, #f0a800)', text: '#000', border: '#ffd700' };
  if (multiplier >= 3) return { bg: 'linear-gradient(135deg, #00e701, #00a801)', text: '#000', border: '#00e701' };
  if (multiplier >= 1.5) return { bg: 'linear-gradient(135deg, #1da1f2, #0d8ecf)', text: '#fff', border: '#1da1f2' };
  if (multiplier >= 1.1) return { bg: 'linear-gradient(135deg, #3a7bd5, #2c5ea0)', text: '#fff', border: '#3a7bd5' };
  if (multiplier >= 0.5) return { bg: 'linear-gradient(135deg, #e67e22, #c0652a)', text: '#fff', border: '#e67e22' };
  return { bg: 'linear-gradient(135deg, #e74c3c, #c0392b)', text: '#fff', border: '#e74c3c' };
};

const PLINKO_RULES = [
  'Choose your bet amount and click DROP to release the ball.',
  'The ball bounces through 12 rows of pegs, going left or right at each row.',
  'Where the ball lands determines your multiplier and payout.',
  'Edge slots have the highest multipliers (up to 10x).',
  'Center slots have the lowest multipliers (0.3x).',
  'Each drop is independent and provably fair.',
  'Your payout = Bet Amount x Landing Multiplier.',
];

const PLINKO_PAYOUTS = [
  { label: 'Edge slots (far left/right)', value: '10x' },
  { label: 'Near-edge slots', value: '3x' },
  { label: 'Outer-mid slots', value: '1.6x' },
  { label: 'Mid slots', value: '1.1x - 1.2x' },
  { label: 'Inner slots', value: '0.5x' },
  { label: 'Center slot', value: '0.3x' },
];

export default function PlinkoGamePage() {
  const { user, updateBalance } = useContext(AuthContext);
  const [stake, setStake] = useState(BET_AMOUNTS[0]);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [ballPosition, setBallPosition] = useState(null);
  const [ballRow, setBallRow] = useState(-1);
  const [result, setResult] = useState(null);
  const [landedSlot, setLandedSlot] = useState(null);
  const [history, setHistory] = useState([]);
  const [activePath, setActivePath] = useState([]);
  const animationRef = useRef(null);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, []);

  const handleDrop = async () => {
    if (!user) return toast.error('Please login first');
    if (stake > user.balance) return toast.error('Insufficient balance');
    if (loading || animating) return;

    setLoading(true);
    setResult(null);
    setLandedSlot(null);
    setBallPosition(null);
    setBallRow(-1);
    setActivePath([]);

    try {
      const res = await dropPlinko(stake);
      const data = res.data;
      const path = data.gameResult.path;
      const slotIndex = data.gameResult.slotIndex;
      const multiplier = data.gameResult.multiplier;
      const payout = data.payout;

      setLoading(false);
      setAnimating(true);

      // Animate ball through pegs
      let currentRow = -1;
      // Ball starts centered: position represents offset from center in half-peg units
      // At each row the ball goes L (-1) or R (+1) relative to center tracking
      let positionOffset = 0;
      const pathPositions = [];

      if (animationRef.current) {
        clearInterval(animationRef.current);
      }

      animationRef.current = setInterval(() => {
        currentRow++;

        if (currentRow < path.length) {
          const direction = path[currentRow];
          if (direction === 'L') {
            positionOffset -= 1;
          } else {
            positionOffset += 1;
          }
          pathPositions.push({ row: currentRow, offset: positionOffset });
          setActivePath([...pathPositions]);
          setBallRow(currentRow);
          setBallPosition(positionOffset);
        } else {
          // Animation complete
          clearInterval(animationRef.current);
          animationRef.current = null;
          setAnimating(false);
          setLandedSlot(slotIndex);
          setResult({ multiplier, payout, slotIndex });
          updateBalance(data.balance);

          if (multiplier >= 1) {
            toast.success(`Landed on ${multiplier}x! Won ${formatCurrency(payout)}!`);
          } else {
            toast(`Landed on ${multiplier}x - Payout: ${formatCurrency(payout)}`);
          }

          setHistory(prev => [
            { multiplier, payout, slotIndex, stake },
            ...prev,
          ].slice(0, 5));
        }
      }, 150);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to drop ball');
      setLoading(false);
    }
  };

  // Build peg positions for rendering
  // Row i has (3 + i) pegs
  const renderPegBoard = () => {
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      const pegCount = 3 + r;
      const pegs = [];
      for (let p = 0; p < pegCount; p++) {
        pegs.push(
          <div key={p} className="plinko-peg" />
        );
      }
      rows.push(
        <div key={r} className="plinko-peg-row" style={{ '--peg-count': pegCount }}>
          {pegs}
        </div>
      );
    }
    return rows;
  };

  // Calculate ball visual position within the board
  // The ball starts above row 0 center. Each step it moves to the next row.
  // positionOffset: each L = -1, each R = +1 from start
  // The board widens by 1 peg per row. The ball can land in positions mapping to multiplier slots.
  const getBallStyle = () => {
    if (ballRow < 0 || ballPosition === null) return null;

    // The board container is 100% wide. Each row is centered.
    // Row r has (3+r) pegs spread across the row width.
    // The ball's horizontal position is determined by its offset.
    // At row r, the peg positions range from -(2+r)/2 to +(2+r)/2 in half-unit steps.
    // The ball offset ranges from -currentRow-1 to +currentRow+1 (but constrained by path).
    // Map the offset to a percentage of the board width.

    const maxPegsInLastRow = 3 + ROWS - 1; // 14 pegs in row 11
    const totalSlots = maxPegsInLastRow + 1; // conceptual width
    // Ball offset of 0 = center, max offset = +/- ROWS
    // Map to percentage: center is 50%, each offset unit is about (100 / totalSlots / 2)%
    const centerPercent = 50;
    const unitWidth = 100 / (totalSlots + 1);
    const leftPercent = centerPercent + (ballPosition * unitWidth / 2);

    // Vertical position: each row is evenly distributed
    const rowHeight = 100 / (ROWS + 1);
    const topPercent = (ballRow + 1) * rowHeight;

    return {
      left: `${leftPercent}%`,
      top: `${topPercent}%`,
      transform: 'translate(-50%, -50%)',
    };
  };

  const getSlotHighlightIndex = () => {
    if (landedSlot !== null) return landedSlot;
    return -1;
  };

  return (
    <div className="casino-game-page" style={{ maxWidth: 650 }}>
      <h1>{'\uD83D\uDCCD'} Plinko</h1>

      <GameRulesModal
        gameKey="plinko"
        title="How to Play Plinko"
        rules={PLINKO_RULES}
        payouts={PLINKO_PAYOUTS}
      />

      {/* Preview Banner */}
      {!animating && !result && (
        <div className="plinko-setup">
          <div className="plinko-preview">
            <div className="plinko-preview-dots">
              {Array.from({ length: 6 }, (_, r) => (
                <div key={r} className="plinko-preview-row">
                  {Array.from({ length: 3 + r }, (_, p) => (
                    <div key={p} className="plinko-preview-peg" />
                  ))}
                </div>
              ))}
            </div>
            <div className="plinko-preview-overlay">
              <div className="plinko-preview-title">PLINKO</div>
              <div className="plinko-preview-subtitle">Watch it drop!</div>
            </div>
          </div>

          <div className="plinko-setup-controls">
            <div className="stake-selector" style={{ marginBottom: '1rem' }}>
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
              className="btn btn-primary plinko-drop-btn"
              onClick={handleDrop}
              disabled={loading || !user || stake > (user?.balance || 0)}
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 800 }}
            >
              {loading ? 'DROPPING...' : `DROP BALL \u2014 \u20B9${formatCurrency(stake)}`}
            </button>
          </div>
        </div>
      )}

      {/* Game Board - visible during animation and after result */}
      {(animating || result) && (
        <div className="plinko-game-area">
          {/* Info Bar */}
          <div className="plinko-info-bar">
            <div className="plinko-info-item">
              <span className="plinko-info-label">Bet</span>
              <span className="plinko-info-value">{'\u20B9'}{formatCurrency(stake)}</span>
            </div>
            <div className="plinko-info-item">
              <span className="plinko-info-label">Rows</span>
              <span className="plinko-info-value">{ROWS}</span>
            </div>
            <div className="plinko-info-item">
              <span className="plinko-info-label">Slots</span>
              <span className="plinko-info-value">{MULTIPLIERS.length}</span>
            </div>
            {result && (
              <div className="plinko-info-item">
                <span className="plinko-info-label">Payout</span>
                <span className="plinko-info-value" style={{ color: result.multiplier >= 1 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {'\u20B9'}{formatCurrency(result.payout)}
                </span>
              </div>
            )}
          </div>

          {/* Peg Board */}
          <div className="plinko-board">
            <div className="plinko-pegs-container">
              {renderPegBoard()}
              {/* Ball */}
              {(animating || (result && ballPosition !== null)) && getBallStyle() && (
                <div
                  className={`plinko-ball ${!animating && result ? 'plinko-ball--landed' : ''}`}
                  style={getBallStyle()}
                />
              )}
            </div>

            {/* Multiplier Slots */}
            <div className="plinko-slots">
              {MULTIPLIERS.map((mult, i) => {
                const colors = getSlotColor(mult);
                const isHighlighted = getSlotHighlightIndex() === i;
                return (
                  <div
                    key={i}
                    className={`plinko-slot ${isHighlighted ? 'plinko-slot--active' : ''}`}
                    style={{
                      background: colors.bg,
                      color: colors.text,
                      borderColor: isHighlighted ? '#fff' : colors.border,
                      boxShadow: isHighlighted ? `0 0 20px ${colors.border}88, 0 0 40px ${colors.border}44` : 'none',
                      transform: isHighlighted ? 'scale(1.15)' : 'scale(1)',
                    }}
                  >
                    {mult}x
                  </div>
                );
              })}
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <div className={`plinko-result-display ${result.multiplier >= 1 ? 'win' : 'loss'}`}>
              <div className="plinko-result-multiplier">{result.multiplier}x</div>
              <div className="plinko-result-payout">
                {result.multiplier >= 1 ? '+' : ''}{'\u20B9'}{formatCurrency(result.payout)}
              </div>
            </div>
          )}

          {/* Play Again */}
          {result && !animating && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <div className="stake-selector" style={{ flex: 1 }}>
                <div className="stake-buttons" style={{ justifyContent: 'flex-start' }}>
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
            </div>
          )}
          {result && !animating && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setResult(null);
                setLandedSlot(null);
                setBallPosition(null);
                setBallRow(-1);
                setActivePath([]);
                handleDrop();
              }}
              disabled={loading || !user || stake > (user?.balance || 0)}
              style={{ marginTop: '0.75rem', width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 700 }}
            >
              {loading ? 'DROPPING...' : `DROP AGAIN \u2014 \u20B9${formatCurrency(stake)}`}
            </button>
          )}
          {result && !animating && (
            <button
              className="btn btn-outline"
              onClick={() => {
                setResult(null);
                setLandedSlot(null);
                setBallPosition(null);
                setBallRow(-1);
                setActivePath([]);
              }}
              style={{ marginTop: '0.5rem', width: '100%', padding: '0.65rem', fontSize: '0.85rem' }}
            >
              CHANGE BET
            </button>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="plinko-history">
          <div className="plinko-history-label">Last Drops</div>
          <div className="plinko-history-list">
            {history.map((h, i) => {
              const colors = getSlotColor(h.multiplier);
              return (
                <div key={i} className="plinko-history-item">
                  <div
                    className="plinko-history-mult"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {h.multiplier}x
                  </div>
                  <div className="plinko-history-details">
                    <span className="plinko-history-bet">{'\u20B9'}{formatCurrency(h.stake)}</span>
                    <span
                      className="plinko-history-payout"
                      style={{ color: h.multiplier >= 1 ? 'var(--accent-green)' : 'var(--accent-red)' }}
                    >
                      {h.multiplier >= 1 ? '+' : ''}{'\u20B9'}{formatCurrency(h.payout)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        /* ── Plinko Setup ── */
        .plinko-setup {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .plinko-preview {
          position: relative;
          padding: 2rem 1.5rem;
          background: linear-gradient(145deg, #0d1b2a, #1a2c3d);
          border-bottom: 1px solid var(--border-color);
          overflow: hidden;
          min-height: 160px;
        }
        .plinko-preview-dots {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          opacity: 0.25;
        }
        .plinko-preview-row {
          display: flex;
          gap: 14px;
          justify-content: center;
        }
        .plinko-preview-peg {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 215, 0, 0.6);
          box-shadow: 0 0 4px rgba(255, 215, 0, 0.3);
        }
        .plinko-preview-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at center, rgba(13,27,42,0.3), rgba(13,27,42,0.85));
          z-index: 2;
        }
        .plinko-preview-title {
          font-size: 2.5rem;
          font-weight: 900;
          letter-spacing: 8px;
          background: linear-gradient(135deg, #ffd700, #9b59b6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.3rem;
        }
        .plinko-preview-subtitle {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.6);
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .plinko-setup-controls {
          padding: 1.25rem;
        }

        /* ── Game Area ── */
        .plinko-game-area {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
        }
        .plinko-info-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
          background: var(--bg-tertiary);
          border-radius: var(--radius);
          padding: 0.75rem;
        }
        .plinko-info-bar:has(.plinko-info-item:nth-child(4)) {
          grid-template-columns: repeat(4, 1fr);
        }
        .plinko-info-item {
          text-align: center;
        }
        .plinko-info-label {
          display: block;
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .plinko-info-value {
          display: block;
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        /* ── Peg Board ── */
        .plinko-board {
          background: linear-gradient(180deg, #0a1520, #0d1b2a);
          border-radius: var(--radius-lg);
          border: 2px solid rgba(255, 255, 255, 0.06);
          padding: 1.25rem 0.75rem 0.75rem;
          margin-bottom: 1rem;
          overflow: hidden;
        }
        .plinko-pegs-container {
          position: relative;
          width: 100%;
          aspect-ratio: 1.1;
          margin-bottom: 0.75rem;
        }
        .plinko-peg-row {
          display: flex;
          justify-content: center;
          gap: 0px;
          padding: 0 10px;
          height: calc(100% / 12);
          align-items: center;
        }
        .plinko-peg {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #e0e0e0, #888);
          box-shadow: 0 1px 3px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3);
          flex-shrink: 0;
          margin: 0 calc((100% - var(--peg-count) * 10px) / (var(--peg-count) * 2));
        }

        /* ── Ball ── */
        .plinko-ball {
          position: absolute;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #fff700, #ffaa00, #ff8800);
          box-shadow: 0 0 12px rgba(255, 215, 0, 0.7), 0 0 24px rgba(255, 170, 0, 0.4);
          z-index: 10;
          transition: left 0.13s ease-out, top 0.13s ease-out;
          pointer-events: none;
        }
        .plinko-ball--landed {
          animation: plinko-ball-bounce 0.4s ease-out;
        }

        /* ── Multiplier Slots ── */
        .plinko-slots {
          display: flex;
          gap: 3px;
          justify-content: center;
        }
        .plinko-slot {
          flex: 1;
          text-align: center;
          padding: 6px 2px;
          border-radius: 6px;
          font-size: 0.65rem;
          font-weight: 800;
          font-family: var(--font-mono);
          border: 2px solid transparent;
          transition: all 0.3s ease;
          min-width: 0;
        }
        .plinko-slot--active {
          z-index: 5;
          position: relative;
          animation: plinko-slot-glow 0.8s ease-in-out 3;
        }

        /* ── Result Display ── */
        .plinko-result-display {
          text-align: center;
          padding: 1rem;
          border-radius: var(--radius);
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          transition: all 0.3s;
        }
        .plinko-result-display.win {
          background: rgba(0, 231, 1, 0.1);
          border-color: rgba(0, 231, 1, 0.3);
          animation: plinko-result-pulse 1s ease-in-out 3;
        }
        .plinko-result-display.loss {
          background: rgba(255, 68, 68, 0.08);
          border-color: rgba(255, 68, 68, 0.2);
        }
        .plinko-result-multiplier {
          font-size: 2.2rem;
          font-weight: 900;
          font-family: var(--font-mono);
          line-height: 1.2;
        }
        .plinko-result-display.win .plinko-result-multiplier {
          color: var(--accent-green);
        }
        .plinko-result-display.loss .plinko-result-multiplier {
          color: var(--accent-red);
        }
        .plinko-result-payout {
          font-size: 1.1rem;
          font-weight: 800;
          margin-top: 0.25rem;
        }
        .plinko-result-display.win .plinko-result-payout {
          color: var(--accent-green);
        }
        .plinko-result-display.loss .plinko-result-payout {
          color: var(--accent-red);
        }

        /* ── History ── */
        .plinko-history {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1rem;
          margin-top: 1rem;
        }
        .plinko-history-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 600;
          margin-bottom: 0.75rem;
          text-align: center;
        }
        .plinko-history-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .plinko-history-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          background: var(--bg-tertiary);
          border-radius: var(--radius);
          border: 1px solid rgba(255,255,255,0.04);
        }
        .plinko-history-mult {
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 800;
          font-family: var(--font-mono);
          min-width: 50px;
          text-align: center;
        }
        .plinko-history-details {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .plinko-history-bet {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
        }
        .plinko-history-payout {
          font-size: 0.85rem;
          font-weight: 800;
          font-family: var(--font-mono);
        }

        /* ── Animations ── */
        @keyframes plinko-ball-bounce {
          0% { transform: translate(-50%, -50%) scale(1); }
          30% { transform: translate(-50%, -50%) scale(1.4); }
          50% { transform: translate(-50%, -50%) scale(0.9); }
          70% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes plinko-slot-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(255, 215, 0, 0.3); }
          50% { box-shadow: 0 0 24px rgba(255, 215, 0, 0.6), 0 0 48px rgba(255, 215, 0, 0.3); }
        }
        @keyframes plinko-result-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 231, 1, 0); }
          50% { box-shadow: 0 0 24px 4px rgba(0, 231, 1, 0.2); }
        }

        @media (max-width: 480px) {
          .plinko-peg {
            width: 7px;
            height: 7px;
          }
          .plinko-ball {
            width: 14px;
            height: 14px;
          }
          .plinko-slot {
            font-size: 0.55rem;
            padding: 4px 1px;
          }
          .plinko-info-bar {
            grid-template-columns: repeat(2, 1fr);
          }
          .plinko-slots {
            gap: 2px;
          }
        }
      `}</style>
    </div>
  );
}
