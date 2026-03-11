import { useState, useEffect, useMemo } from 'react';
import { useLiveGame } from '../hooks/useLiveGame';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

const DT_RULES = [
  'Each round lasts 30 seconds with a countdown timer.',
  'Place your bet on Dragon, Tiger, or Tie during the betting phase.',
  'Bets are locked when the timer reaches 0.',
  'One card is dealt to Dragon and one to Tiger.',
  'The side with the higher card wins.',
  'Dragon or Tiger bet pays 1.94x your stake.',
  'Tie bet pays 8x your stake.',
  'Cards rank from 2 (lowest) to A (highest). Suits do not matter.',
];

const DT_PAYOUTS = [
  { label: 'Dragon wins', value: '1.94x' },
  { label: 'Tiger wins', value: '1.94x' },
  { label: 'Tie', value: '8x' },
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

/* ── Face-down placeholder card ── */
function CardBack({ size = 'large' }) {
  const cardWidth = size === 'large' ? 140 : 80;
  const cardHeight = size === 'large' ? 196 : 112;

  return (
    <div
      style={{
        width: cardWidth,
        height: cardHeight,
        background: 'linear-gradient(145deg, #1e3a5f, #0d2240)',
        borderRadius: size === 'large' ? 14 : 10,
        border: '2px solid rgba(255,215,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Diamond pattern overlay */}
      <div style={{
        position: 'absolute',
        inset: 6,
        backgroundImage: `repeating-linear-gradient(
          45deg,
          rgba(255,215,0,0.07) 0px,
          rgba(255,215,0,0.07) 2px,
          transparent 2px,
          transparent 10px
        )`,
        borderRadius: 8,
        border: '1px solid rgba(255,215,0,0.15)',
      }} />
      <span style={{ fontSize: size === 'large' ? '2.5rem' : '1.5rem', opacity: 0.5 }}>?</span>
    </div>
  );
}

/* ── Revealed playing card ── */
function PlayingCard({ card, size = 'large', highlight = '', flipping = false }) {
  if (!card) return null;

  const suitSymbol = SUIT_SYMBOLS[card.suit] || '';
  const suitColor = SUIT_COLORS[card.suit] || '#1a1a2e';
  const isLarge = size === 'large';

  const cardWidth = isLarge ? 140 : 80;
  const cardHeight = isLarge ? 196 : 112;
  const rankFont = isLarge ? '1.6rem' : '0.95rem';
  const suitFont = isLarge ? '3.5rem' : '1.8rem';

  let borderColor = 'rgba(255,255,255,0.15)';
  let boxShadow = '0 4px 16px rgba(0,0,0,0.4)';

  if (highlight === 'win') {
    borderColor = '#00e701';
    boxShadow = '0 0 28px rgba(0,231,1,0.5), 0 0 8px rgba(0,231,1,0.3)';
  } else if (highlight === 'lose') {
    borderColor = '#dc2626';
    boxShadow = '0 0 20px rgba(220,38,38,0.45), 0 0 6px rgba(220,38,38,0.2)';
  } else if (highlight === 'tie') {
    borderColor = '#ffd700';
    boxShadow = '0 0 24px rgba(255,215,0,0.5), 0 0 8px rgba(255,215,0,0.25)';
  }

  return (
    <div
      className={`dt-card${flipping === 'in' ? ' dt-card-flip-in' : ''}`}
      style={{
        width: cardWidth,
        height: cardHeight,
        background: 'linear-gradient(145deg, #ffffff, #f0f0f0)',
        borderRadius: isLarge ? 14 : 10,
        border: `2px solid ${borderColor}`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow,
        flexShrink: 0,
        transition: 'box-shadow 0.4s, border-color 0.4s',
      }}
    >
      {/* Top-left */}
      <div style={{
        position: 'absolute',
        top: isLarge ? 8 : 6,
        left: isLarge ? 10 : 7,
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
          fontSize: isLarge ? '1rem' : '0.7rem',
          color: suitColor,
          marginTop: -2,
        }}>{suitSymbol}</span>
      </div>

      {/* Center suit */}
      <span style={{ fontSize: suitFont, color: suitColor, lineHeight: 1 }}>{suitSymbol}</span>

      {/* Bottom-right (rotated) */}
      <div style={{
        position: 'absolute',
        bottom: isLarge ? 8 : 6,
        right: isLarge ? 10 : 7,
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
          fontSize: isLarge ? '1rem' : '0.7rem',
          color: suitColor,
          marginTop: -2,
        }}>{suitSymbol}</span>
      </div>
    </div>
  );
}

/* ── History badge ── */
function HistoryBadge({ result }) {
  const config = {
    dragon: { label: 'D', bg: 'rgba(192,57,43,0.2)', color: '#e74c3c', border: 'rgba(192,57,43,0.4)' },
    tiger:  { label: 'T', bg: 'rgba(211,84,0,0.2)',  color: '#e67e22', border: 'rgba(211,84,0,0.4)' },
    tie:    { label: '=', bg: 'rgba(255,215,0,0.15)', color: '#ffd700', border: 'rgba(255,215,0,0.35)' },
  };
  const c = config[result] || config.tie;

  return (
    <div style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: c.bg,
      border: `1px solid ${c.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.75rem',
      fontWeight: 800,
      color: c.color,
      fontFamily: 'var(--font-mono)',
      flexShrink: 0,
    }}>
      {c.label}
    </div>
  );
}

/* ── Small Circular Countdown Timer (SVG) ── */
function CircularTimer({ secondsLeft, maxSeconds, status }) {
  const size = 48;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const fraction = maxSeconds > 0 ? secondsLeft / maxSeconds : 0;
  const strokeDashoffset = circumference * (1 - fraction);

  const isRevealing = status === 'revealing';
  const timerColor = useMemo(() => {
    if (status === 'result') return '#ffd700';
    if (isRevealing) return '#a855f7';
    if (status === 'locked') return '#ff8c00';
    if (secondsLeft > 15) return '#00e701';
    if (secondsLeft > 7) return '#ffb800';
    return '#ff4444';
  }, [secondsLeft, status, isRevealing]);

  const isPulsing = secondsLeft <= 5 && status === 'betting';

  return (
    <div
      className="dt-circular-timer"
      style={{
        animation: isPulsing ? 'dtTimerPulse 1s ease-in-out infinite' : 'none'
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={timerColor} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 0.95s linear, stroke 0.5s ease', filter: `drop-shadow(0 0 4px ${timerColor}80)` }}
        />
      </svg>
      <div className="dt-timer-center" style={{ color: timerColor }}>
        {status === 'betting' ? (
          <span className="dt-timer-number">{secondsLeft}</span>
        ) : status === 'locked' ? (
          <span style={{ fontSize: '0.9rem' }}>{'\uD83D\uDD12'}</span>
        ) : status === 'revealing' ? (
          <span style={{ fontSize: '0.9rem' }}>{'\uD83C\uDCCF'}</span>
        ) : (
          <span style={{ fontSize: '0.85rem' }}>{'\uD83C\uDF89'}</span>
        )}
      </div>
    </div>
  );
}

/* ── Status Badge ── */
function StatusBadge({ status }) {
  const config = {
    betting:   { label: 'PLACE BETS',   bg: 'rgba(0,231,1,0.12)',   color: '#00e701', border: 'rgba(0,231,1,0.35)' },
    locked:    { label: 'BETS LOCKED',  bg: 'rgba(255,140,0,0.12)', color: '#ff8c00', border: 'rgba(255,140,0,0.35)' },
    revealing: { label: 'REVEALING...',  bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.35)' },
    result:    { label: 'ROUND RESULT', bg: 'rgba(255,215,0,0.12)', color: '#ffd700', border: 'rgba(255,215,0,0.35)' },
  };
  const c = config[status] || config.betting;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 14px',
      borderRadius: 20,
      background: c.bg,
      border: `1px solid ${c.border}`,
      fontSize: '0.72rem',
      fontWeight: 800,
      letterSpacing: '1.5px',
      color: c.color,
      textTransform: 'uppercase',
    }}>
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: c.color,
        animation: status === 'betting' ? 'dtStatusPulse 1.2s ease-in-out infinite' : 'none',
      }} />
      {c.label}
    </div>
  );
}

export default function DragonTigerGamePage() {
  const {
    gameState,
    roundResult,
    selectedBet, setSelectedBet,
    stake, setStake,
    hasBet,
    myBetChoice,
    placeBet,
    isMyWin, myPayout,
  } = useLiveGame('dragontiger');

  const { status, secondsLeft, roundId, betCounts, totalBets, history } = gameState;

  /* Card reveal stagger state */
  const [showDragonCard, setShowDragonCard] = useState(false);
  const [showTigerCard, setShowTigerCard] = useState(false);

  useEffect(() => {
    if (status === 'revealing' && roundResult) {
      setShowDragonCard(false);
      setShowTigerCard(false);
      const t1 = setTimeout(() => setShowDragonCard(true), 200);
      const t2 = setTimeout(() => setShowTigerCard(true), 800);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (status === 'result' && roundResult) {
      setShowDragonCard(true);
      setShowTigerCard(true);
    }
    if (status === 'betting') {
      setShowDragonCard(false);
      setShowTigerCard(false);
    }
  }, [status, roundResult]);

  /* Determine card highlights after result */
  const getDragonHighlight = () => {
    if (!roundResult) return '';
    if (roundResult.result === 'tie') return 'tie';
    return roundResult.result === 'dragon' ? 'win' : 'lose';
  };

  const getTigerHighlight = () => {
    if (!roundResult) return '';
    if (roundResult.result === 'tie') return 'tie';
    return roundResult.result === 'tiger' ? 'win' : 'lose';
  };

  const bettingDisabled = hasBet || status !== 'betting';

  return (
    <div className="casino-game-page" style={{ maxWidth: 600 }}>
      <h1>{'\uD83D\uDC09'} Dragon vs Tiger</h1>

      <GameRulesModal
        gameKey="dragontiger"
        title="How to Play Dragon vs Tiger"
        rules={DT_RULES}
        payouts={DT_PAYOUTS}
      />

      {/* ====== HEADER: Status + Round ====== */}
      <div className="dt-live-header">
        <div className="dt-live-header-info">
          <StatusBadge status={status} />
          <div className="dt-round-number">Round #{roundId || '---'}</div>
          <div className="dt-total-bets">{totalBets || 0} total bets this round</div>
        </div>
      </div>

      {/* ====== CARD TABLE ====== */}
      <div className="dt-game-area" style={{ position: 'relative' }}>
        <CircularTimer secondsLeft={secondsLeft} maxSeconds={30} status={status} />
        {/* Result banner (only during 'result' phase) */}
        {status === 'result' && roundResult && myBetChoice && (
          <div className={`dt-result-banner ${isMyWin ? 'dt-result-win' : 'dt-result-lose'}`}>
            {isMyWin ? (
              <>
                <div className="dt-result-icon">{'\u2714'}</div>
                <div className="dt-result-title">You Won!</div>
                <div className="dt-result-payout">+{formatCurrency(myPayout)}</div>
                <div className="dt-result-sub">
                  {roundResult.result === 'dragon' ? '\uD83D\uDC09 Dragon wins' : roundResult.result === 'tiger' ? '\uD83D\uDC2F Tiger wins' : 'Tie!'}
                </div>
              </>
            ) : (
              <>
                <div className="dt-result-icon">{'\u2716'}</div>
                <div className="dt-result-title">
                  {roundResult.result === 'dragon' ? '\uD83D\uDC09 Dragon Wins' : roundResult.result === 'tiger' ? '\uD83D\uDC2F Tiger Wins' : 'Tie!'}
                </div>
                <div className="dt-result-sub">Better luck next round</div>
              </>
            )}
          </div>
        )}

        {/* Result banner for non-bettors showing round outcome */}
        {status === 'result' && roundResult && !myBetChoice && (
          <div className="dt-result-banner dt-result-neutral">
            <div className="dt-result-title" style={{ fontSize: '1.2rem' }}>
              {roundResult.result === 'dragon' ? '\uD83D\uDC09 Dragon Wins!' : roundResult.result === 'tiger' ? '\uD83D\uDC2F Tiger Wins!' : '= Tie!'}
            </div>
          </div>
        )}

        {/* Card table */}
        <div className="dt-table">
          {/* Dragon side */}
          <div className="dt-side">
            <div className={`dt-side-label ${
              (status === 'result' || (status === 'revealing' && showDragonCard))
                ? (getDragonHighlight() === 'win' ? 'dt-side-label-win' : getDragonHighlight() === 'tie' ? 'dt-side-label-tie' : 'dt-side-label-dragon')
                : 'dt-side-label-dragon'
            }`}>
              {'\uD83D\uDC09'} DRAGON
            </div>
            <div className="dt-card-wrapper">
              {(status === 'revealing' || status === 'result') && showDragonCard && roundResult ? (
                <PlayingCard
                  card={roundResult.dragon}
                  size="large"
                  highlight={status === 'result' ? getDragonHighlight() : ''}
                  flipping="in"
                />
              ) : (
                <CardBack size="large" />
              )}
            </div>
            {showDragonCard && roundResult?.dragon && (
              <div className="dt-card-rank-label">
                {roundResult.dragon.display} ({roundResult.dragon.numericValue})
              </div>
            )}
          </div>

          {/* VS divider */}
          <div className="dt-vs-divider">
            <div className={`dt-vs-text ${status === 'result' && roundResult?.result === 'tie' ? 'dt-vs-tie' : ''}`}>VS</div>
          </div>

          {/* Tiger side */}
          <div className="dt-side">
            <div className={`dt-side-label ${
              (status === 'result' || (status === 'revealing' && showTigerCard))
                ? (getTigerHighlight() === 'win' ? 'dt-side-label-win' : getTigerHighlight() === 'tie' ? 'dt-side-label-tie' : 'dt-side-label-tiger')
                : 'dt-side-label-tiger'
            }`}>
              {'\uD83D\uDC2F'} TIGER
            </div>
            <div className="dt-card-wrapper">
              {(status === 'revealing' || status === 'result') && showTigerCard && roundResult ? (
                <PlayingCard
                  card={roundResult.tiger}
                  size="large"
                  highlight={status === 'result' ? getTigerHighlight() : ''}
                  flipping="in"
                />
              ) : (
                <CardBack size="large" />
              )}
            </div>
            {showTigerCard && roundResult?.tiger && (
              <div className="dt-card-rank-label">
                {roundResult.tiger.display} ({roundResult.tiger.numericValue})
              </div>
            )}
          </div>
        </div>

        {/* Locked overlay message */}
        {status === 'locked' && (
          <div className="dt-locked-banner">
            {'\uD83D\uDD12'} Bets Locked &mdash; Waiting for cards...
          </div>
        )}
      </div>

      {/* ====== BET CONTROLS ====== */}
      <div className="dt-setup">
        <div className="dt-setup-controls">
          {/* My bet indicator */}
          {hasBet && (
            <div className="dt-my-bet-indicator">
              You bet <strong>{formatCurrency(stake)}</strong> on <strong style={{ textTransform: 'capitalize' }}>{myBetChoice}</strong>
            </div>
          )}

          {/* Stake selector */}
          <div className="stake-selector">
            <label>Bet Amount</label>
            <div className="stake-buttons">
              {BET_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  className={`btn btn-sm ${stake === amt ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setStake(amt)}
                  disabled={hasBet}
                >
                  {formatCurrency(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* 3 bet buttons */}
          <div className="dt-bet-buttons">
            {/* DRAGON */}
            <button
              className={`dt-bet-btn dt-bet-dragon ${selectedBet === 'dragon' ? 'dt-bet-btn-selected' : ''}`}
              onClick={() => { setSelectedBet('dragon'); placeBet('dragon'); }}
              disabled={bettingDisabled}
            >
              <span className="dt-btn-emoji">{'\uD83D\uDC09'}</span>
              <span className="dt-btn-label">DRAGON</span>
              <span className="dt-btn-mult">1.94x</span>
              <span className="dt-btn-count">{betCounts?.dragon || 0} bets</span>
            </button>

            {/* TIE */}
            <button
              className={`dt-bet-btn dt-bet-tie ${selectedBet === 'tie' ? 'dt-bet-btn-selected' : ''}`}
              onClick={() => { setSelectedBet('tie'); placeBet('tie'); }}
              disabled={bettingDisabled}
            >
              <span className="dt-btn-tie-eq">=</span>
              <span className="dt-btn-label">TIE</span>
              <span className="dt-btn-mult">8x</span>
              <span className="dt-btn-count">{betCounts?.tie || 0} bets</span>
            </button>

            {/* TIGER */}
            <button
              className={`dt-bet-btn dt-bet-tiger ${selectedBet === 'tiger' ? 'dt-bet-btn-selected' : ''}`}
              onClick={() => { setSelectedBet('tiger'); placeBet('tiger'); }}
              disabled={bettingDisabled}
            >
              <span className="dt-btn-emoji">{'\uD83D\uDC2F'}</span>
              <span className="dt-btn-label">TIGER</span>
              <span className="dt-btn-mult">1.94x</span>
              <span className="dt-btn-count">{betCounts?.tiger || 0} bets</span>
            </button>
          </div>

          {/* Bet amount display */}
          {!hasBet && status === 'betting' && (
            <div className="dt-stake-display">
              Placing <strong>{formatCurrency(stake)}</strong> on your chosen side
            </div>
          )}

          {status !== 'betting' && !hasBet && (
            <div className="dt-stake-display">
              {status === 'locked' ? 'Betting closed for this round' : 'Wait for next round to place a bet'}
            </div>
          )}
        </div>
      </div>

      {/* ====== GAME HISTORY ====== */}
      {history && history.length > 0 && (
        <div className="dt-history-section">
          <div className="dt-history-label">Recent Results</div>
          <div className="dt-history-row">
            {history.map((r, i) => (
              <HistoryBadge key={i} result={r.result || r} />
            ))}
          </div>
        </div>
      )}

      {/* ====== INLINE STYLES ====== */}
      <style>{`
        /* ===== LIVE HEADER ===== */
        .dt-live-header {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 0.75rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0;
        }

        .dt-live-header-info {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .dt-round-number {
          font-size: 1.25rem;
          font-weight: 900;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        .dt-total-bets {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        /* ===== CIRCULAR TIMER (small, top-right overlay) ===== */
        .dt-circular-timer {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          background: rgba(14, 27, 42, 0.85);
          border-radius: 50%;
        }

        .dt-timer-center {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        }

        .dt-timer-number {
          font-size: 1.1rem;
          font-weight: 900;
          font-family: var(--font-mono);
          line-height: 1;
        }

        @keyframes dtTimerPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.1); }
        }

        @keyframes dtStatusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.8); }
        }

        /* ===== SETUP / CONTROLS ===== */
        .dt-setup {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .dt-setup-controls {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        .dt-my-bet-indicator {
          text-align: center;
          font-size: 0.85rem;
          color: #ffd700;
          font-weight: 700;
          padding: 0.5rem 0.75rem;
          background: rgba(255,215,0,0.08);
          border: 1px solid rgba(255,215,0,0.2);
          border-radius: var(--radius);
        }

        /* ===== 3 BET BUTTONS ===== */
        .dt-bet-buttons {
          display: grid;
          grid-template-columns: 1fr 0.7fr 1fr;
          gap: 0.6rem;
          align-items: center;
        }

        .dt-bet-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          padding: 0.85rem 0.5rem;
          border-radius: var(--radius);
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          position: relative;
          overflow: hidden;
        }

        .dt-bet-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0);
          transition: background 0.2s;
        }

        .dt-bet-btn:hover:not(:disabled)::before {
          background: rgba(255,255,255,0.06);
        }

        .dt-bet-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .dt-bet-btn:active:not(:disabled) {
          transform: scale(0.97);
        }

        .dt-bet-btn-selected {
          border-color: #ffd700 !important;
          box-shadow: 0 0 0 3px rgba(255,215,0,0.3), 0 4px 20px rgba(255,215,0,0.25) !important;
          transform: scale(1.04);
        }

        /* Dragon button */
        .dt-bet-dragon {
          background: linear-gradient(145deg, #c0392b, #e74c3c);
          border-color: rgba(255,100,80,0.35);
          box-shadow: 0 4px 16px rgba(192,57,43,0.35);
          color: #fff;
        }
        .dt-bet-dragon:hover:not(:disabled) {
          border-color: rgba(255,120,100,0.6);
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(192,57,43,0.5);
        }

        /* Tie button */
        .dt-bet-tie {
          background: linear-gradient(145deg, #b8860b, #d4a017);
          border-color: rgba(255,215,0,0.35);
          box-shadow: 0 4px 12px rgba(212,160,23,0.3);
          color: #fff;
          padding: 0.7rem 0.4rem;
        }
        .dt-bet-tie:hover:not(:disabled) {
          border-color: rgba(255,215,0,0.6);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(212,160,23,0.45);
        }

        /* Tiger button */
        .dt-bet-tiger {
          background: linear-gradient(145deg, #d35400, #e67e22);
          border-color: rgba(255,140,50,0.35);
          box-shadow: 0 4px 16px rgba(211,84,0,0.35);
          color: #fff;
        }
        .dt-bet-tiger:hover:not(:disabled) {
          border-color: rgba(255,155,70,0.6);
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(211,84,0,0.5);
        }

        .dt-btn-emoji {
          font-size: 1.8rem;
          line-height: 1;
        }
        .dt-btn-tie-eq {
          font-size: 1.6rem;
          font-weight: 900;
          line-height: 1;
        }
        .dt-btn-label {
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }
        .dt-btn-mult {
          font-size: 0.75rem;
          font-weight: 700;
          opacity: 0.85;
          font-family: var(--font-mono);
          background: rgba(0,0,0,0.2);
          padding: 1px 6px;
          border-radius: 4px;
        }
        .dt-btn-count {
          font-size: 0.65rem;
          font-weight: 600;
          opacity: 0.7;
          font-family: var(--font-mono);
          margin-top: 2px;
        }

        .dt-stake-display {
          text-align: center;
          font-size: 0.82rem;
          color: var(--text-muted);
        }
        .dt-stake-display strong {
          color: var(--accent-gold);
        }

        /* ===== GAME AREA ===== */
        .dt-game-area {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        /* ===== LOCKED BANNER ===== */
        .dt-locked-banner {
          text-align: center;
          font-size: 0.85rem;
          font-weight: 700;
          color: #ff8c00;
          padding: 0.6rem;
          background: rgba(255,140,0,0.08);
          border: 1px solid rgba(255,140,0,0.2);
          border-radius: var(--radius);
          letter-spacing: 0.5px;
        }

        /* ===== CARD TABLE ===== */
        .dt-table {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
        }

        .dt-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          flex: 1;
        }

        .dt-side-label {
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          padding: 3px 12px;
          border-radius: 20px;
        }
        .dt-side-label-dragon {
          color: #e74c3c;
          background: rgba(192,57,43,0.12);
          border: 1px solid rgba(192,57,43,0.25);
        }
        .dt-side-label-tiger {
          color: #e67e22;
          background: rgba(211,84,0,0.12);
          border: 1px solid rgba(211,84,0,0.25);
        }
        .dt-side-label-win {
          color: #00e701;
          background: rgba(0,231,1,0.12);
          border: 1px solid rgba(0,231,1,0.3);
        }
        .dt-side-label-tie {
          color: #ffd700;
          background: rgba(255,215,0,0.12);
          border: 1px solid rgba(255,215,0,0.3);
        }

        .dt-card-wrapper {
          display: flex;
          justify-content: center;
          perspective: 900px;
        }

        /* Card flip-in when revealing */
        .dt-card {
          transform-style: preserve-3d;
        }
        .dt-card-flip-in {
          animation: dt-flip-in 0.45s ease-out both;
        }
        @keyframes dt-flip-in {
          0%   { transform: rotateY(90deg) scale(0.92); opacity: 0.4; }
          100% { transform: rotateY(0deg) scale(1);    opacity: 1; }
        }

        .dt-card-rank-label {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-weight: 600;
          text-align: center;
        }

        /* ===== VS DIVIDER ===== */
        .dt-vs-divider {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
        }

        .dt-vs-text {
          font-size: 1.1rem;
          font-weight: 900;
          color: var(--text-muted);
          letter-spacing: 2px;
          padding: 8px 10px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--bg-tertiary);
          transition: color 0.4s, border-color 0.4s, box-shadow 0.4s;
        }
        .dt-vs-tie {
          color: #ffd700;
          border-color: rgba(255,215,0,0.4);
          box-shadow: 0 0 12px rgba(255,215,0,0.2);
        }

        /* ===== RESULT BANNER ===== */
        .dt-result-banner {
          text-align: center;
          padding: 1.25rem 1rem;
          border-radius: var(--radius);
        }

        .dt-result-win {
          background: rgba(0,231,1,0.08);
          border: 1px solid rgba(0,231,1,0.25);
          animation: dt-win-pulse 1s ease-in-out 3;
        }
        .dt-result-lose {
          background: rgba(220,38,38,0.08);
          border: 1px solid rgba(220,38,38,0.25);
          animation: dt-lose-shake 0.5s ease-in-out;
        }
        .dt-result-neutral {
          background: rgba(255,215,0,0.06);
          border: 1px solid rgba(255,215,0,0.2);
        }

        @keyframes dt-win-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,231,1,0); }
          50%       { box-shadow: 0 0 28px 4px rgba(0,231,1,0.18); }
        }
        @keyframes dt-lose-shake {
          0%, 100% { transform: translateX(0); }
          15%      { transform: translateX(-7px); }
          35%      { transform: translateX(7px); }
          55%      { transform: translateX(-4px); }
          75%      { transform: translateX(4px); }
        }

        .dt-result-icon {
          font-size: 2.2rem;
          margin-bottom: 0.35rem;
          line-height: 1;
        }
        .dt-result-win .dt-result-icon  { color: #00e701; }
        .dt-result-lose .dt-result-icon { color: #dc2626; }

        .dt-result-title {
          font-size: 1.5rem;
          font-weight: 900;
          margin-bottom: 0.2rem;
        }
        .dt-result-win .dt-result-title  { color: #00e701; }
        .dt-result-lose .dt-result-title { color: #dc2626; }

        .dt-result-payout {
          font-size: 1.9rem;
          font-weight: 900;
          color: #00e701;
          font-family: var(--font-mono);
          margin-bottom: 0.2rem;
        }
        .dt-result-sub {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        /* ===== HISTORY ===== */
        .dt-history-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 0.9rem 1.1rem;
          margin-top: 0.25rem;
        }

        .dt-history-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
          margin-bottom: 0.6rem;
        }

        .dt-history-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 480px) {
          .dt-live-header {
            padding: 0.6rem 0.85rem;
          }
          .dt-bet-buttons {
            grid-template-columns: 1fr 0.65fr 1fr;
            gap: 0.45rem;
          }
          .dt-btn-emoji { font-size: 1.5rem; }
          .dt-btn-label { font-size: 0.7rem; letter-spacing: 1px; }
          .dt-btn-mult  { font-size: 0.68rem; }
          .dt-vs-text   { font-size: 0.9rem; padding: 6px 8px; }
        }
      `}</style>
    </div>
  );
}
