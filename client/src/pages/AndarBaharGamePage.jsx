import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveGame } from '../hooks/useLiveGame';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

const AB_RULES = [
  'Place your bet on Andar or Bahar during the betting phase.',
  'A Joker card is revealed at the start of each round.',
  'Cards are dealt alternately to Andar and Bahar sides.',
  'The first card matching the Joker\'s value wins!',
  'Both Andar and Bahar pay 1.9x your stake.',
  'Andar is dealt first in each round.',
  'Rounds run every 30 seconds automatically.',
];

const AB_PAYOUTS = [
  { label: 'Andar wins', value: '1.9x' },
  { label: 'Bahar wins', value: '1.9x' },
  { label: 'Average cards dealt', value: '~6-8 cards' },
];

const SUIT_SYMBOLS = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const isRedSuit = (suit) => suit === 'hearts' || suit === 'diamonds';

// Status display config
const STATUS_CONFIG = {
  betting: { label: 'PLACE BETS', color: '#00c853', pulse: true },
  locked: { label: 'BETS LOCKED', color: '#ffd700', pulse: false },
  revealing: { label: 'DEALING', color: '#ff8c42', pulse: true },
  result: { label: 'RESULT', color: '#7c4dff', pulse: false },
};

// ──────────────────────────────────────────
// PlayingCard component
// ──────────────────────────────────────────
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

// ──────────────────────────────────────────
// CircularTimer component
// ──────────────────────────────────────────
function CircularTimer({ secondsLeft, totalSeconds = 30, size = 64 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const offset = circumference * (1 - progress);
  const isUrgent = secondsLeft <= 5;

  return (
    <div className="ab-circular-timer" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isUrgent ? '#ff4444' : '#00c853'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div className={`ab-timer-text ${isUrgent ? 'ab-timer-text--urgent' : ''}`}>
        {secondsLeft}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// StatusBadge component
// ──────────────────────────────────────────
function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.betting;
  return (
    <div
      className={`ab-status-badge ${config.pulse ? 'ab-status-badge--pulse' : ''}`}
      style={{
        borderColor: config.color,
        color: config.color,
        boxShadow: `0 0 12px ${config.color}33`,
      }}
    >
      <span className="ab-status-dot" style={{ background: config.color }} />
      {config.label}
    </div>
  );
}

// ──────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────
export default function AndarBaharGamePage() {
  const {
    gameState,
    roundResult,
    selectedBet, setSelectedBet,
    stake, setStake,
    hasBet,
    myBetChoice,
    placeBet,
    isMyWin, myPayout,
  } = useLiveGame('andarbahar');

  const [revealedCount, setRevealedCount] = useState(0);

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

  const dealSequence = useMemo(() => roundResult ? buildDealSequence(roundResult) : [], [roundResult, buildDealSequence]);
  const totalCards = dealSequence.length;

  // Animate card dealing during revealing/result phase
  useEffect(() => {
    if (gameState.status !== 'revealing' && gameState.status !== 'result') return;
    if (!roundResult) return;
    const dealSeq = buildDealSequence(roundResult);
    setRevealedCount(0);
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setRevealedCount(count);
      if (count >= dealSeq.length) clearInterval(interval);
    }, 220);
    return () => clearInterval(interval);
  }, [roundResult, buildDealSequence, gameState.status]);

  // Reset revealed count when a new betting round starts
  useEffect(() => {
    if (gameState.status === 'betting') {
      setRevealedCount(0);
    }
  }, [gameState.status]);

  const handleBet = useCallback((side) => {
    setSelectedBet(side);
    placeBet(side);
  }, [setSelectedBet, placeBet]);

  const allRevealed = revealedCount >= totalCards && totalCards > 0;
  const isAnimating = !allRevealed && totalCards > 0 && (gameState.status === 'revealing' || gameState.status === 'result');

  // Compute revealed cards per side
  const revealedAndar = useMemo(
    () => dealSequence.slice(0, revealedCount).filter(s => s.side === 'andar').map(s => s.card),
    [dealSequence, revealedCount]
  );
  const revealedBahar = useMemo(
    () => dealSequence.slice(0, revealedCount).filter(s => s.side === 'bahar').map(s => s.card),
    [dealSequence, revealedCount]
  );

  const winSide = roundResult?.result; // 'andar' | 'bahar'
  const totalDealt = (roundResult?.andarCards?.length || 0) + (roundResult?.baharCards?.length || 0);

  const isBettingOpen = gameState.status === 'betting';
  const showCards = gameState.status === 'revealing' || gameState.status === 'result';

  return (
    <div className="casino-game-page" style={{ maxWidth: 720 }}>
      <h1>Andar Bahar <span style={{ fontSize: '0.5em', color: 'var(--text-muted)', fontWeight: 600 }}>LIVE</span></h1>

      <GameRulesModal
        gameKey="andarbahar"
        title="How to Play Andar Bahar"
        rules={AB_RULES}
        payouts={AB_PAYOUTS}
      />

      {/* ── TIMER + STATUS HEADER ── */}
      <div className="ab-live-header">
        <div className="ab-live-header-left">
          <CircularTimer secondsLeft={gameState.secondsLeft || 0} totalSeconds={30} />
          <div className="ab-live-header-info">
            <StatusBadge status={gameState.status} />
            <div className="ab-round-number">
              Round <span style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>#{gameState.roundId || '--'}</span>
            </div>
          </div>
        </div>
        {gameState.totalBets > 0 && (
          <div className="ab-total-bets">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>Total Bets</span>
            <span style={{ fontWeight: 900, fontFamily: 'var(--font-mono)', fontSize: '1.1rem' }}>{gameState.totalBets}</span>
          </div>
        )}
      </div>

      {/* ── JOKER CARD AREA ── */}
      <div className="ab-joker-area">
        <div className="ab-joker-label">JOKER CARD</div>
        <div className="ab-joker-wrapper">
          {showCards && roundResult?.joker ? (
            <PlayingCard card={roundResult.joker} size="large" style={{
              border: '2px solid #ffd700',
              boxShadow: '0 0 24px rgba(255,215,0,0.6), 0 0 48px rgba(255,215,0,0.25)',
            }} />
          ) : (
            <div className="ab-banner-joker-card">
              <div style={{ fontSize: '2rem', lineHeight: 1 }}>&#9733;</div>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, marginTop: 4, letterSpacing: 2, color: '#ffd700' }}>JOKER</div>
            </div>
          )}
        </div>
        {showCards && roundResult?.joker && (
          <div className="ab-joker-value">
            Value: <strong style={{ color: 'var(--accent-gold)' }}>{roundResult.joker?.display || roundResult.joker?.value}</strong>
            &nbsp;{SUIT_SYMBOLS[roundResult.joker?.suit]}
          </div>
        )}
      </div>

      {/* ── MAIN GAME CARD ── */}
      <div className="ab-main-card">

        {/* ---- BET BUTTONS (always visible, disabled when not betting or already bet) ---- */}
        <div className="ab-bet-buttons">
          {/* ANDAR */}
          <button
            className={`ab-bet-btn ab-bet-btn--andar ${hasBet && myBetChoice === 'andar' ? 'ab-bet-btn--selected' : ''}`}
            onClick={() => handleBet('andar')}
            disabled={!isBettingOpen || hasBet}
          >
            <div className="ab-bet-btn-top">
              <span className="ab-bet-hindi">{'\u0905\u0902\u0926\u0930'}</span>
              <div className="ab-bet-stack ab-bet-stack--left">
                {[2, 1, 0].map(i => (
                  <div key={i} className="ab-bet-stack-card" style={{ right: i * 6 }} />
                ))}
                <span className="ab-bet-arrow">&#8592;</span>
              </div>
            </div>
            <div className="ab-bet-btn-name">ANDAR</div>
            <div className="ab-bet-payout">1.9x payout</div>
            {gameState.betCounts?.andar > 0 && (
              <div className="ab-bet-count">{gameState.betCounts.andar} bet{gameState.betCounts.andar !== 1 ? 's' : ''}</div>
            )}
          </button>

          {/* BAHAR */}
          <button
            className={`ab-bet-btn ab-bet-btn--bahar ${hasBet && myBetChoice === 'bahar' ? 'ab-bet-btn--selected' : ''}`}
            onClick={() => handleBet('bahar')}
            disabled={!isBettingOpen || hasBet}
          >
            <div className="ab-bet-btn-top">
              <div className="ab-bet-stack ab-bet-stack--right">
                <span className="ab-bet-arrow">&#8594;</span>
                {[0, 1, 2].map(i => (
                  <div key={i} className="ab-bet-stack-card ab-bet-stack-card--bahar" style={{ left: i * 6 }} />
                ))}
              </div>
              <span className="ab-bet-hindi" style={{ color: '#ff8c42' }}>{'\u092C\u093E\u0939\u0930'}</span>
            </div>
            <div className="ab-bet-btn-name" style={{ color: '#ff8c42' }}>BAHAR</div>
            <div className="ab-bet-payout">1.9x payout</div>
            {gameState.betCounts?.bahar > 0 && (
              <div className="ab-bet-count">{gameState.betCounts.bahar} bet{gameState.betCounts.bahar !== 1 ? 's' : ''}</div>
            )}
          </button>
        </div>

        {/* Bet placed confirmation */}
        {hasBet && isBettingOpen && (
          <div className="ab-bet-placed-msg">
            Bet placed on <strong style={{ color: myBetChoice === 'andar' ? 'var(--accent-green)' : '#ff8c42' }}>
              {myBetChoice === 'andar' ? 'ANDAR' : 'BAHAR'}
            </strong> &mdash; waiting for round to start...
          </div>
        )}

        {/* ---- STAKE SELECTOR (only during betting, before bet placed) ---- */}
        {isBettingOpen && !hasBet && (
          <div className="stake-selector" style={{ marginTop: '1.25rem' }}>
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
        )}

        {/* ---- DEALING AREA (during revealing/result) ---- */}
        {showCards && roundResult && (
          <>
            <div className="ab-dealing-area">
              {/* ANDAR side */}
              <div className="ab-side ab-side--andar">
                <div className="ab-side-label ab-side-label--andar">
                  ANDAR <span style={{ fontSize: '0.75em', opacity: 0.8 }}>{'\u0905\u0902\u0926\u0930'}</span>
                  {winSide === 'andar' && allRevealed && (
                    <span className="ab-winner-badge ab-winner-badge--andar">WIN</span>
                  )}
                </div>
                <div className="ab-cards-row ab-cards-row--andar">
                  {revealedAndar.map((card, idx) => {
                    const isLast = idx === revealedAndar.length - 1 && winSide === 'andar' && allRevealed;
                    return (
                      <div key={idx} className="ab-card-slide-in">
                        <PlayingCard card={card} size="small" highlight={isLast} />
                      </div>
                    );
                  })}
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
                  BAHAR <span style={{ fontSize: '0.75em', opacity: 0.8 }}>{'\u092C\u093E\u0939\u0930'}</span>
                  {winSide === 'bahar' && allRevealed && (
                    <span className="ab-winner-badge ab-winner-badge--bahar">WIN</span>
                  )}
                </div>
                <div className="ab-cards-row ab-cards-row--bahar">
                  {revealedBahar.map((card, idx) => {
                    const isLast = idx === revealedBahar.length - 1 && winSide === 'bahar' && allRevealed;
                    return (
                      <div key={idx} className="ab-card-slide-in">
                        <PlayingCard card={card} size="small" highlight={isLast} />
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
            {isAnimating && (
              <div className="ab-dealing-indicator">
                <div className="ab-dealing-dots">
                  <span /><span /><span />
                </div>
                <span>Dealing card {revealedCount} of {totalCards}...</span>
              </div>
            )}

            {/* ---- RESULT BANNER (shown after all cards dealt) ---- */}
            {allRevealed && gameState.status === 'result' && (
              <div className={`ab-result-banner ${hasBet ? (isMyWin ? 'ab-result-banner--won' : 'ab-result-banner--lost') : 'ab-result-banner--neutral'}`}>
                <div className="ab-result-main">
                  {hasBet ? (
                    isMyWin ? (
                      <>
                        <span className="ab-result-emoji">&#127881;</span>
                        <span className="ab-result-text ab-result-text--won">You Win!</span>
                        <span className="ab-result-amount">+{formatCurrency(myPayout)}</span>
                      </>
                    ) : (
                      <>
                        <span className="ab-result-emoji">&#128577;</span>
                        <span className="ab-result-text ab-result-text--lost">You Lose!</span>
                      </>
                    )
                  ) : (
                    <>
                      <span className="ab-result-text ab-result-text--neutral">
                        {winSide === 'andar' ? 'ANDAR' : 'BAHAR'} Wins!
                      </span>
                    </>
                  )}
                </div>
                <div className="ab-result-details">
                  {hasBet && (
                    <>
                      <span className="ab-result-detail-item">
                        <span style={{ color: 'var(--text-muted)' }}>You bet:</span>
                        &nbsp;<strong style={{ color: myBetChoice === 'andar' ? 'var(--accent-green)' : '#ff8c42' }}>
                          {myBetChoice === 'andar' ? 'ANDAR' : 'BAHAR'}
                        </strong>
                      </span>
                      <span className="ab-result-divider">|</span>
                    </>
                  )}
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
                <div className="ab-result-next">Next round starting soon...</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── HISTORY ── */}
      {gameState.history && gameState.history.length > 0 && (
        <div className="ab-history-section">
          <div className="ab-history-title">Recent Results</div>
          <div className="ab-history-row">
            {gameState.history.map((h, i) => (
              <div
                key={i}
                className={`ab-history-badge ${h.result === 'andar' ? 'ab-history-badge--andar' : 'ab-history-badge--bahar'}`}
                title={`Round ${h.roundId || ''} - ${h.result === 'andar' ? 'Andar' : 'Bahar'} won`}
              >
                {h.result === 'andar' ? 'A' : 'B'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── INLINE STYLES ── */}
      <style>{`
        /* -------- Live Header -------- */
        .ab-live-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1rem 1.25rem;
          margin-bottom: 1.25rem;
        }

        .ab-live-header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .ab-live-header-info {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .ab-round-number {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .ab-total-bets {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        /* -------- Circular Timer -------- */
        .ab-circular-timer {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ab-timer-text {
          position: absolute;
          font-size: 1.3rem;
          font-weight: 900;
          font-family: var(--font-mono);
          color: #00c853;
          transition: color 0.3s ease;
        }

        .ab-timer-text--urgent {
          color: #ff4444;
          animation: abTimerPulse 0.6s ease-in-out infinite;
        }

        @keyframes abTimerPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.08); }
        }

        /* -------- Status Badge -------- */
        .ab-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 3px 12px;
          border-radius: 20px;
          border: 1.5px solid;
          background: rgba(0,0,0,0.3);
        }

        .ab-status-badge--pulse {
          animation: abStatusPulse 1.5s ease-in-out infinite;
        }

        @keyframes abStatusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .ab-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* -------- Joker Area -------- */
        .ab-joker-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 1.25rem;
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

        .ab-banner-joker-card {
          width: 80px;
          height: 112px;
          background: linear-gradient(145deg, #2a2a1a, #1a1a0a);
          border: 2px solid #ffd700;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(255,215,0,0.3), 0 4px 12px rgba(0,0,0,0.5);
          color: #ffd700;
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

        .ab-bet-btn--selected {
          opacity: 1 !important;
          box-shadow: 0 0 20px rgba(255,215,0,0.3);
        }

        .ab-bet-btn--selected.ab-bet-btn--andar {
          border-color: #00c853;
          box-shadow: 0 0 20px rgba(0,200,80,0.4);
        }

        .ab-bet-btn--selected.ab-bet-btn--bahar {
          border-color: #ff8c42;
          box-shadow: 0 0 20px rgba(255,140,66,0.4);
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

        .ab-bet-count {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--text-muted);
          font-family: var(--font-mono);
          margin-top: 2px;
          opacity: 0.8;
        }

        .ab-bet-placed-msg {
          text-align: center;
          color: var(--text-muted);
          font-size: 0.88rem;
          margin-top: 1rem;
          font-weight: 600;
          padding: 0.6rem;
          background: rgba(255,215,0,0.06);
          border: 1px solid rgba(255,215,0,0.15);
          border-radius: var(--radius);
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
          margin-top: 1.25rem;
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

        .ab-result-banner--neutral {
          background: linear-gradient(135deg, rgba(124,77,255,0.12), rgba(100,60,200,0.06));
          border: 1px solid rgba(124,77,255,0.3);
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

        .ab-result-text--won {
          color: var(--accent-green);
        }

        .ab-result-text--lost {
          color: var(--accent-red);
        }

        .ab-result-text--neutral {
          color: var(--accent-gold);
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
          margin-bottom: 0.75rem;
        }

        .ab-result-detail-item {
          font-weight: 600;
        }

        .ab-result-divider {
          color: var(--border-color);
          font-weight: 300;
        }

        .ab-result-next {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 600;
          font-style: italic;
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
          .ab-live-header { padding: 0.75rem; gap: 0.5rem; }
          .ab-live-header-left { gap: 0.6rem; }
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
          .ab-banner-joker-card { width: 64px; height: 90px; }
        }

        @media (max-width: 380px) {
          .ab-bet-btn-name { letter-spacing: 1.5px; }
          .ab-status-badge { font-size: 0.62rem; padding: 2px 8px; letter-spacing: 1.5px; }
        }
      `}</style>
    </div>
  );
}
