import { useState, useContext, useRef, useMemo, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { spinRoulette } from '../api/casino';
import { formatCurrency } from '../utils/constants';
import GameRulesModal from '../components/common/GameRulesModal';
import toast from 'react-hot-toast';
import './CasinoGame.css';

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

const getNumberColor = (n) => {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
};

// European roulette wheel order
const WHEEL_ORDER = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,
  5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
];

const CHIP_VALUES = [100, 500, 1000, 5000, 10000];

const CHIP_COLORS = {
  100: '#4a90d9',
  500: '#e74c3c',
  1000: '#27ae60',
  5000: '#8e44ad',
  10000: '#f39c12',
};

const OUTSIDE_BETS = [
  { label: 'Red', type: 'red', className: 'ob-red' },
  { label: 'Black', type: 'black', className: 'ob-black' },
  { label: 'Green (0)', type: 'straight', number: 0, className: 'ob-green' },
  { label: 'Odd', type: 'odd', className: 'ob-neutral' },
  { label: 'Even', type: 'even', className: 'ob-neutral' },
  { label: '1-18', type: 'low', className: 'ob-neutral' },
  { label: '19-36', type: 'high', className: 'ob-neutral' },
  { label: '1st 12', type: 'dozen', dozen: 1, className: 'ob-neutral' },
  { label: '2nd 12', type: 'dozen', dozen: 2, className: 'ob-neutral' },
  { label: '3rd 12', type: 'dozen', dozen: 3, className: 'ob-neutral' },
];

/* ── Rules data for the modal ── */
const ROULETTE_RULES = [
  'European roulette with numbers 0-36 on the wheel.',
  'Select one or more bets by clicking numbers on the grid or outside bet buttons.',
  'Each click adds a new bet with the currently selected chip value.',
  'Click a bet in the "Your Bets" list to remove it.',
  'Press SPIN to play all your bets at once.',
  'Winnings are paid based on the payout multiplier for each bet type.',
];

const ROULETTE_PAYOUTS = [
  { label: 'Straight (single number)', value: '35:1' },
  { label: 'Red / Black', value: '1:1' },
  { label: 'Odd / Even', value: '1:1' },
  { label: '1-18 / 19-36', value: '1:1' },
  { label: '1st / 2nd / 3rd 12', value: '2:1' },
  { label: 'Green (0)', value: '35:1' },
];

export default function RouletteGamePage() {
  const { user, updateBalance } = useContext(AuthContext);
  const [chipValue, setChipValue] = useState(100);
  const [bets, setBets] = useState([]); // array of { id, type, number?, dozen?, label, stake }
  const [result, setResult] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [history, setHistory] = useState([]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [payout, setPayout] = useState(null);
  const wheelRef = useRef(null);
  const betIdRef = useRef(0);

  /* ── helpers ── */
  const totalStake = useMemo(() => bets.reduce((s, b) => s + b.stake, 0), [bets]);

  const addBet = useCallback((betObj) => {
    if (spinning) return;
    betIdRef.current += 1;
    setBets(prev => [...prev, { ...betObj, stake: chipValue, id: betIdRef.current }]);
  }, [chipValue, spinning]);

  const removeBet = useCallback((id) => {
    if (spinning) return;
    setBets(prev => prev.filter(b => b.id !== id));
  }, [spinning]);

  const clearBets = useCallback(() => {
    if (spinning) return;
    setBets([]);
  }, [spinning]);

  /* ── wheel background ── */
  const wheelBackground = useMemo(() => {
    const segAngle = 360 / WHEEL_ORDER.length;
    const stops = WHEEL_ORDER.map((num, i) => {
      const color = getNumberColor(num);
      const hex = color === 'red' ? '#c0392b' : color === 'black' ? '#1a1a2e' : '#27ae60';
      return `${hex} ${(i * segAngle).toFixed(2)}deg ${((i + 1) * segAngle).toFixed(2)}deg`;
    });
    return `conic-gradient(from 0deg, ${stops.join(', ')})`;
  }, []);

  const getRotationForNumber = useCallback((winNum) => {
    const idx = WHEEL_ORDER.indexOf(winNum);
    const segAngle = 360 / WHEEL_ORDER.length;
    const segCenter = idx * segAngle + segAngle / 2;
    const fullSpins = 5 * 360;
    return fullSpins + (360 - segCenter);
  }, []);

  /* ── which numbers / outside types have bets ── */
  const numberBetCounts = useMemo(() => {
    const map = {};
    bets.forEach(b => {
      if (b.type === 'straight') map[b.number] = (map[b.number] || 0) + 1;
    });
    return map;
  }, [bets]);

  const outsideBetCounts = useMemo(() => {
    const map = {};
    bets.forEach(b => {
      if (b.type !== 'straight') {
        const key = b.type + (b.dozen || '');
        map[key] = (map[key] || 0) + 1;
      }
    });
    return map;
  }, [bets]);

  /* ── spin ── */
  const handleSpin = async () => {
    if (!user) return toast.error('Please login first');
    if (bets.length === 0) return toast.error('Place at least one bet');
    if (totalStake > user.balance) return toast.error('Insufficient balance');

    setSpinning(true);
    setResult(null);
    setPayout(null);

    // Build the bets payload (strip id/label for server)
    const payload = bets.map(b => {
      const obj = { type: b.type, stake: b.stake };
      if (b.number !== undefined) obj.number = b.number;
      if (b.dozen !== undefined) obj.dozen = b.dozen;
      return obj;
    });

    try {
      const res = await spinRoulette(payload);
      const gameResult = res.data.gameResult;

      const targetRotation = getRotationForNumber(gameResult.winningNumber);
      setWheelRotation(prev => prev + targetRotation);

      setTimeout(() => {
        setResult(gameResult);
        setPayout(res.data.payout);
        updateBalance(res.data.balance);
        setHistory(prev => [gameResult, ...prev].slice(0, 10));

        if (res.data.payout > 0) {
          toast.success(`Won ${formatCurrency(res.data.payout)}! Number: ${gameResult.winningNumber}`);
        } else {
          toast(`Number: ${gameResult.winningNumber} (${gameResult.color})`, { icon: '\uD83C\uDFAF' });
        }
        setSpinning(false);
        setBets([]); // clear bets after spin
      }, 4200);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Spin failed');
      setSpinning(false);
    }
  };

  /* ── click handlers ── */
  const onNumberClick = (num) => {
    addBet({ type: 'straight', number: num, label: `#${num}` });
  };

  const onOutsideClick = (bet) => {
    const obj = { type: bet.type, label: bet.label };
    if (bet.number !== undefined) obj.number = bet.number;
    if (bet.dozen !== undefined) obj.dozen = bet.dozen;
    addBet(obj);
  };

  /* ── number grid ── */
  const numberGrid = useMemo(() => {
    const rows = [[], [], []];
    for (let col = 0; col < 12; col++) {
      rows[0].push(3 + col * 3);
      rows[1].push(2 + col * 3);
      rows[2].push(1 + col * 3);
    }
    return rows;
  }, []);

  const resultColorHex = result
    ? result.color === 'red' ? '#c0392b' : result.color === 'black' ? '#1a1a2e' : '#27ae60'
    : null;

  return (
    <div className="casino-game-page roulette-page">
      <GameRulesModal
        gameKey="roulette"
        title="How to Play Roulette"
        rules={ROULETTE_RULES}
        payouts={ROULETTE_PAYOUTS}
      />

      <h1>Roulette</h1>

      {/* ── WHEEL ── */}
      <div className="rl-wheel-section">
        <div className="rl-wheel-container">
          <div className="rl-ball-pointer" />
          <div
            className="rl-wheel"
            ref={wheelRef}
            style={{
              background: wheelBackground,
              transform: `rotate(${wheelRotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            }}
          >
            {WHEEL_ORDER.map((num, i) => {
              const segAngle = 360 / WHEEL_ORDER.length;
              const angle = i * segAngle + segAngle / 2;
              return (
                <span key={num} className="rl-wheel-number"
                  style={{ transform: `rotate(${angle}deg) translateY(-120px) rotate(-${angle}deg)` }}>
                  {num}
                </span>
              );
            })}
            <div className="rl-wheel-center">
              {result && !spinning ? (
                <span className="rl-center-result"
                  style={{ color: resultColorHex === '#1a1a2e' ? '#fff' : resultColorHex }}>
                  {result.winningNumber}
                </span>
              ) : spinning ? (
                <span className="rl-center-spinning">...</span>
              ) : (
                <span className="rl-center-idle">?</span>
              )}
            </div>
          </div>
        </div>

        {/* Result display */}
        {result && !spinning && (
          <div className="rl-result-display">
            <div className="rl-result-circle" style={{
              background: resultColorHex,
              border: result.color === 'black' ? '2px solid #555' : '2px solid transparent',
            }}>
              {result.winningNumber}
            </div>
            <div className="rl-result-text">
              {payout > 0 ? (
                <span className="rl-win-text">WIN +{formatCurrency(payout)}</span>
              ) : (
                <span className="rl-lose-text">No win</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── HISTORY ── */}
      {history.length > 0 && (
        <div className="rl-history">
          <span className="rl-history-label">Last results:</span>
          <div className="rl-history-dots">
            {history.map((h, i) => (
              <div key={i} className="rl-history-dot" style={{
                background: h.color === 'red' ? '#c0392b' : h.color === 'black' ? '#1a1a2e' : '#27ae60',
                border: h.color === 'black' ? '1px solid #555' : '1px solid transparent',
              }} title={`${h.winningNumber} (${h.color})`}>
                {h.winningNumber}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TABLE SECTION ── */}
      <div className="rl-table-section card">
        {/* Number Grid */}
        <div className="rl-number-grid-wrapper">
          <div
            className={`rl-zero-cell ${numberBetCounts[0] ? 'rl-has-bet' : ''} ${
              result && !spinning && result.winningNumber === 0 ? 'rl-winning' : ''
            }`}
            onClick={() => onNumberClick(0)}
          >
            0
            {numberBetCounts[0] && <span className="rl-bet-badge">{numberBetCounts[0]}</span>}
          </div>
          <div className="rl-number-grid">
            {numberGrid.map((row, ri) => (
              <div key={ri} className="rl-number-row">
                {row.map((num) => {
                  const color = getNumberColor(num);
                  const isWinning = result && !spinning && result.winningNumber === num;
                  const betCount = numberBetCounts[num];
                  return (
                    <div
                      key={num}
                      className={`rl-number-cell rl-num-${color} ${betCount ? 'rl-has-bet' : ''} ${isWinning ? 'rl-winning' : ''}`}
                      onClick={() => onNumberClick(num)}
                    >
                      {num}
                      {betCount && <span className="rl-bet-badge">{betCount}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Outside Bets */}
        <div className="rl-outside-bets">
          {OUTSIDE_BETS.map((bet, i) => {
            const key = bet.type + (bet.dozen || '');
            const count = outsideBetCounts[key];
            return (
              <button
                key={i}
                className={`rl-outside-btn ${bet.className} ${count ? 'rl-has-bet' : ''}`}
                onClick={() => onOutsideClick(bet)}
                disabled={spinning}
              >
                {bet.label}
                {count && <span className="rl-outside-badge">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Chip Selector */}
        <div className="rl-chip-selector">
          <label className="rl-chip-label">Select Chip Value</label>
          <div className="rl-chips">
            {CHIP_VALUES.map((val) => (
              <button
                key={val}
                className={`rl-chip ${chipValue === val ? 'rl-chip-active' : ''}`}
                style={{
                  '--chip-color': CHIP_COLORS[val],
                  background: chipValue === val ? CHIP_COLORS[val] : 'transparent',
                  borderColor: CHIP_COLORS[val],
                  color: chipValue === val ? '#fff' : CHIP_COLORS[val],
                }}
                onClick={() => setChipValue(val)}
              >
                {formatCurrency(val)}
              </button>
            ))}
          </div>
        </div>

        {/* ── YOUR BETS LIST ── */}
        {bets.length > 0 && (
          <div className="rl-bets-list">
            <div className="rl-bets-header">
              <span className="rl-bets-title">Your Bets ({bets.length})</span>
              <button className="rl-clear-btn" onClick={clearBets} disabled={spinning}>Clear All</button>
            </div>
            <div className="rl-bets-items">
              {bets.map((b) => (
                <div key={b.id} className="rl-bet-item" onClick={() => removeBet(b.id)} title="Click to remove">
                  <span className="rl-bet-item-label">{b.label}</span>
                  <span className="rl-bet-item-stake">{formatCurrency(b.stake)}</span>
                  <span className="rl-bet-item-x">&times;</span>
                </div>
              ))}
            </div>
            <div className="rl-bets-total">
              Total: <strong>{formatCurrency(totalStake)}</strong>
            </div>
          </div>
        )}

        {/* Spin Button */}
        <div className="rl-spin-area">
          <button
            className="btn btn-primary btn-lg rl-spin-btn"
            onClick={handleSpin}
            disabled={spinning || !user || bets.length === 0}
          >
            {spinning ? 'SPINNING...' : `SPIN  ( ${formatCurrency(totalStake)} )`}
          </button>
        </div>
      </div>

      {/* ── INLINE STYLES ── */}
      <style>{`
        .roulette-page { max-width: 900px; margin: 0 auto; padding-bottom: 2rem; }

        /* ======== WHEEL ======== */
        .rl-wheel-section { display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5rem; }
        .rl-wheel-container { position: relative; width: 290px; height: 290px; margin: 0 auto 1rem; }
        .rl-ball-pointer {
          position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
          width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent;
          border-top: 18px solid var(--accent-gold); z-index: 10;
          filter: drop-shadow(0 2px 4px rgba(255,215,0,0.5));
        }
        .rl-wheel {
          width: 100%; height: 100%; border-radius: 50%; position: relative;
          border: 6px solid var(--accent-gold);
          box-shadow: 0 0 0 4px #0e1b28, 0 0 0 8px var(--accent-gold), 0 0 30px rgba(255,215,0,0.25);
          display: flex; align-items: center; justify-content: center;
        }
        .rl-wheel-number {
          position: absolute; font-size: 0.55rem; font-weight: 700; color: #fff;
          text-shadow: 0 1px 2px rgba(0,0,0,0.8); pointer-events: none; width: 18px; text-align: center;
        }
        .rl-wheel-center {
          width: 70px; height: 70px; border-radius: 50%; background: var(--bg-primary);
          border: 3px solid var(--accent-gold); display: flex; align-items: center; justify-content: center;
          z-index: 5; box-shadow: inset 0 0 12px rgba(0,0,0,0.5);
        }
        .rl-center-result { font-size: 1.6rem; font-weight: 900; font-family: var(--font-mono); }
        .rl-center-spinning { font-size: 1.4rem; font-weight: 700; color: var(--text-muted); animation: pulse 0.6s ease-in-out infinite; }
        .rl-center-idle { font-size: 1.8rem; font-weight: 700; color: var(--text-muted); }

        /* ======== RESULT ======== */
        .rl-result-display { display: flex; align-items: center; gap: 1rem; animation: rl-fadeInUp 0.4s ease-out; margin-top: 0.5rem; }
        .rl-result-circle {
          width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 1.6rem; font-weight: 900; color: #fff; font-family: var(--font-mono); box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .rl-win-text { font-size: 1.3rem; font-weight: 800; color: var(--accent-green); text-shadow: 0 0 10px rgba(0,231,1,0.3); }
        .rl-lose-text { font-size: 1rem; font-weight: 600; color: var(--text-muted); }
        @keyframes rl-fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        /* ======== HISTORY ======== */
        .rl-history { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .rl-history-label { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
        .rl-history-dots { display: flex; gap: 0.4rem; flex-wrap: wrap; }
        .rl-history-dot {
          width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 0.6rem; font-weight: 700; color: #fff; font-family: var(--font-mono); cursor: default;
        }

        /* ======== NUMBER GRID ======== */
        .rl-table-section { padding: 1.25rem; }
        .rl-number-grid-wrapper { display: flex; gap: 0; margin-bottom: 0.75rem; }
        .rl-zero-cell {
          background: #27ae60; color: #fff; font-weight: 800; font-size: 1.1rem;
          display: flex; align-items: center; justify-content: center; min-width: 40px;
          border-radius: var(--radius-sm) 0 0 var(--radius-sm); cursor: pointer;
          border: 2px solid transparent; transition: all 0.15s; font-family: var(--font-mono);
          position: relative;
        }
        .rl-zero-cell:hover { filter: brightness(1.2); }
        .rl-zero-cell.rl-has-bet { border-color: var(--accent-gold); box-shadow: 0 0 8px rgba(255,215,0,0.5); }
        .rl-zero-cell.rl-winning { animation: rl-winPulse 0.6s ease-in-out 3; box-shadow: 0 0 16px rgba(39,174,96,0.8); }
        .rl-number-grid { display: flex; flex-direction: column; flex: 1; }
        .rl-number-row { display: grid; grid-template-columns: repeat(12, 1fr); }
        .rl-number-cell {
          padding: 0.5rem 0; text-align: center; font-weight: 700; font-size: 0.8rem; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.08); transition: all 0.15s; font-family: var(--font-mono);
          color: #fff; user-select: none; position: relative;
        }
        .rl-number-cell:hover { filter: brightness(1.3); transform: scale(1.05); z-index: 2; }
        .rl-num-red { background: #c0392b; }
        .rl-num-black { background: #1a1a2e; }
        .rl-number-cell.rl-has-bet {
          border-color: var(--accent-gold) !important;
          box-shadow: inset 0 0 8px rgba(255,215,0,0.4), 0 0 6px rgba(255,215,0,0.4);
          z-index: 3;
        }
        .rl-number-cell.rl-winning { animation: rl-winPulse 0.6s ease-in-out 3; box-shadow: 0 0 16px rgba(255,215,0,0.8); z-index: 5; }
        @keyframes rl-winPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 8px rgba(255,215,0,0.4); }
          50% { transform: scale(1.15); box-shadow: 0 0 20px rgba(255,215,0,0.9); }
        }

        /* Bet count badge on number cells */
        .rl-bet-badge {
          position: absolute; top: -4px; right: -4px; background: var(--accent-gold); color: #000;
          font-size: 0.55rem; font-weight: 800; width: 16px; height: 16px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; pointer-events: none;
        }

        /* ======== OUTSIDE BETS ======== */
        .rl-outside-bets { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem; justify-content: center; }
        .rl-outside-btn {
          padding: 0.55rem 0.85rem; border-radius: var(--radius-sm); font-weight: 700; font-size: 0.78rem;
          cursor: pointer; border: 2px solid transparent; transition: all 0.2s; color: #fff; position: relative;
        }
        .rl-outside-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .rl-outside-btn.ob-red { background: #c0392b; }
        .rl-outside-btn.ob-black { background: #1a1a2e; border-color: #444; }
        .rl-outside-btn.ob-green { background: #27ae60; }
        .rl-outside-btn.ob-neutral { background: var(--bg-tertiary); color: var(--text-primary); }
        .rl-outside-btn:hover:not(:disabled) { filter: brightness(1.2); }
        .rl-outside-btn.rl-has-bet { border-color: var(--accent-gold) !important; box-shadow: 0 0 10px rgba(255,215,0,0.5); }
        .rl-outside-badge {
          position: absolute; top: -6px; right: -6px; background: var(--accent-gold); color: #000;
          font-size: 0.55rem; font-weight: 800; width: 18px; height: 18px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }

        /* ======== CHIP SELECTOR ======== */
        .rl-chip-selector { text-align: center; margin-bottom: 1rem; }
        .rl-chip-label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 600; }
        .rl-chips { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
        .rl-chip {
          width: 56px; height: 56px; border-radius: 50%; border: 3px dashed; font-size: 0.65rem;
          font-weight: 800; cursor: pointer; transition: all 0.2s; display: flex; align-items: center;
          justify-content: center; font-family: var(--font-mono);
        }
        .rl-chip:hover { transform: scale(1.1); }
        .rl-chip-active { border-style: solid !important; transform: scale(1.1); box-shadow: 0 0 12px rgba(255,215,0,0.4); }

        /* ======== BETS LIST ======== */
        .rl-bets-list {
          background: var(--bg-tertiary); border-radius: var(--radius-sm); padding: 0.75rem;
          margin-bottom: 1rem; border: 1px solid rgba(255,215,0,0.15);
        }
        .rl-bets-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .rl-bets-title { font-size: 0.85rem; font-weight: 700; color: var(--accent-gold); }
        .rl-clear-btn {
          background: rgba(231,76,60,0.2); color: #e74c3c; border: 1px solid rgba(231,76,60,0.3);
          padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; cursor: pointer;
        }
        .rl-clear-btn:hover { background: rgba(231,76,60,0.35); }
        .rl-clear-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .rl-bets-items { display: flex; flex-wrap: wrap; gap: 0.35rem; max-height: 120px; overflow-y: auto; margin-bottom: 0.5rem; }
        .rl-bet-item {
          display: flex; align-items: center; gap: 0.35rem; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0.3rem 0.5rem;
          cursor: pointer; transition: all 0.15s; font-size: 0.75rem;
        }
        .rl-bet-item:hover { background: rgba(231,76,60,0.15); border-color: #e74c3c; }
        .rl-bet-item-label { color: #ccc; font-weight: 600; }
        .rl-bet-item-stake { color: var(--accent-gold); font-weight: 700; font-family: var(--font-mono); }
        .rl-bet-item-x { color: #e74c3c; font-weight: 800; font-size: 0.9rem; margin-left: 0.15rem; }
        .rl-bets-total {
          text-align: right; font-size: 0.85rem; color: var(--text-secondary); padding-top: 0.4rem;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .rl-bets-total strong { color: var(--accent-gold); font-family: var(--font-mono); }

        /* ======== SPIN BUTTON ======== */
        .rl-spin-area { text-align: center; }
        .rl-spin-btn { min-width: 240px; font-size: 1rem; letter-spacing: 0.5px; text-transform: uppercase; }

        /* ======== RESPONSIVE ======== */
        @media (max-width: 640px) {
          .rl-wheel-container { width: 230px; height: 230px; }
          .rl-wheel-number { display: none; }
          .rl-wheel-center { width: 55px; height: 55px; }
          .rl-number-cell { padding: 0.35rem 0; font-size: 0.65rem; }
          .rl-zero-cell { min-width: 28px; font-size: 0.9rem; }
          .rl-outside-btn { padding: 0.4rem 0.6rem; font-size: 0.7rem; }
          .rl-chip { width: 44px; height: 44px; font-size: 0.55rem; }
          .rl-result-circle { width: 50px; height: 50px; font-size: 1.3rem; }
          .rl-spin-btn { min-width: 180px; }
        }
      `}</style>
    </div>
  );
}
