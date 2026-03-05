import { useMemo } from 'react';
import { useLiveGame } from '../hooks/useLiveGame';
import { formatCurrency, BET_AMOUNTS } from '../utils/constants';
import GameRulesModal from '../components/common/GameRulesModal';
import './CasinoGame.css';

const L7_RULES = [
  'Each round lasts 30 seconds with a countdown timer.',
  'Place your bet on Under 7, Lucky 7, or Over 7 during the betting phase.',
  'Bets are locked when the timer reaches 0.',
  'One card is drawn from the deck after betting closes.',
  'Ace counts as 1. Jack=11, Queen=12, King=13.',
  'Under 7: card value is 1-6 (A to 6). Pays 1.94x.',
  'Lucky 7: card value is exactly 7. Pays 11x!',
  'Over 7: card value is 8-13 (8 to K). Pays 1.94x.',
];

const L7_PAYOUTS = [
  { label: 'Under 7 (A-6)', value: '1.94x' },
  { label: 'Lucky 7', value: '11x' },
  { label: 'Over 7 (8-K)', value: '1.94x' },
  { label: 'Chance of Lucky 7', value: '1 in 13' },
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

const MAX_SECONDS = 30;

/* ── Playing Card Component ─────────────────────────────────── */
function PlayingCard({ card, faceDown = false, flipping = false }) {
  const cardWidth = 140;
  const cardHeight = 196;

  if (faceDown) {
    return (
      <div
        className={`l7-card${flipping ? ' l7-card-flipping' : ''}`}
        style={{
          width: cardWidth,
          height: cardHeight,
          borderRadius: 14,
          border: '2px solid rgba(255,215,0,0.25)',
          background: 'linear-gradient(145deg, #0d1b4a, #1a2c6e)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Pattern grid */}
        <div style={{
          position: 'absolute',
          inset: 8,
          backgroundImage: `repeating-linear-gradient(
            45deg,
            rgba(255,215,0,0.06) 0px,
            rgba(255,215,0,0.06) 2px,
            transparent 2px,
            transparent 12px
          ), repeating-linear-gradient(
            -45deg,
            rgba(255,215,0,0.06) 0px,
            rgba(255,215,0,0.06) 2px,
            transparent 2px,
            transparent 12px
          )`,
          borderRadius: 8,
          border: '1px solid rgba(255,215,0,0.12)',
        }} />
        <span style={{
          fontSize: '2.8rem',
          color: 'rgba(255,215,0,0.35)',
          position: 'relative',
          zIndex: 1,
          filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.2))',
        }}>7</span>
      </div>
    );
  }

  if (!card) return null;

  const suitSymbol = SUIT_SYMBOLS[card.suit] || '';
  const suitColor = SUIT_COLORS[card.suit] || '#1a1a2e';

  return (
    <div
      className={`l7-card l7-card-revealed${flipping ? ' l7-card-flip-in' : ''}`}
      style={{
        width: cardWidth,
        height: cardHeight,
        background: 'linear-gradient(145deg, #ffffff, #f0f0f0)',
        borderRadius: 14,
        border: '2px solid rgba(255,255,255,0.15)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        flexShrink: 0,
      }}
    >
      {/* Top-left */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
      }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: suitColor, fontFamily: 'Georgia, serif' }}>
          {card.value}
        </span>
        <span style={{ fontSize: '1rem', color: suitColor, marginTop: -2 }}>{suitSymbol}</span>
      </div>

      {/* Center suit */}
      <span style={{ fontSize: '3.5rem', color: suitColor, lineHeight: 1 }}>{suitSymbol}</span>

      {/* Bottom-right (inverted) */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        right: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
        transform: 'rotate(180deg)',
      }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: suitColor, fontFamily: 'Georgia, serif' }}>
          {card.value}
        </span>
        <span style={{ fontSize: '1rem', color: suitColor, marginTop: -2 }}>{suitSymbol}</span>
      </div>
    </div>
  );
}

/* ── History Badge Component ────────────────────────────────── */
function HistoryBadge({ result }) {
  if (result === 'lucky7') {
    return (
      <div className="l7-history-badge l7-badge-lucky">
        <span>7</span>
      </div>
    );
  }
  if (result === 'under') {
    return (
      <div className="l7-history-badge l7-badge-under">
        <span>U</span>
      </div>
    );
  }
  return (
    <div className="l7-history-badge l7-badge-over">
      <span>O</span>
    </div>
  );
}

/* ── Circular Timer (SVG) ───────────────────────────────────── */
function CircularTimer({ secondsLeft, maxSeconds, status }) {
  const radius = 70;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;

  const fraction = maxSeconds > 0 ? secondsLeft / maxSeconds : 0;
  const strokeDashoffset = circumference * (1 - fraction);

  const isRevealing = status === 'revealing';
  const timerColor = useMemo(() => {
    if (status === 'result') return '#ffd700';
    if (isRevealing) return '#a855f7';
    if (secondsLeft > 15) return '#00e701';
    if (secondsLeft > 7) return '#ffb800';
    return '#ff4444';
  }, [secondsLeft, status, isRevealing]);

  const isPulsing = secondsLeft <= 5 && status === 'betting';

  return (
    <div
      className="l7-circular-timer"
      style={{
        animation: isRevealing
          ? 'l7RevealSpin 0.6s linear infinite'
          : isPulsing ? 'l7TimerPulse 1s ease-in-out infinite' : 'none'
      }}
    >
      <svg width={radius * 2} height={radius * 2} viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke={timerColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${radius} ${radius})`}
          style={{
            transition: 'stroke-dashoffset 0.95s linear, stroke 0.5s ease',
            filter: `drop-shadow(0 0 6px ${timerColor}80)`,
          }}
        />
      </svg>
      <div className="l7-timer-center" style={{ color: timerColor }}>
        {status === 'result' ? (
          <span className="l7-timer-emoji">&#127183;</span>
        ) : isRevealing ? (
          <span className="l7-timer-emoji" style={{ fontSize: '2rem' }}>&#127183;</span>
        ) : (
          <span className="l7-timer-number">{secondsLeft}</span>
        )}
      </div>
    </div>
  );
}

/* ── Status Badge ───────────────────────────────────────────── */
function StatusBadge({ status }) {
  const config = {
    betting:   { text: 'BETTING OPEN',  bg: 'rgba(0,231,1,0.15)',    color: '#00e701', border: '#00e701' },
    locked:    { text: 'BETS LOCKED',   bg: 'rgba(255,68,68,0.15)',  color: '#ff4444', border: '#ff4444' },
    revealing: { text: 'REVEALING...',  bg: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '#a855f7' },
    result:    { text: 'RESULT',        bg: 'rgba(255,215,0,0.15)',  color: '#ffd700', border: '#ffd700' },
  };
  const c = config[status] || config.betting;

  return (
    <div
      className="l7-status-badge"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      <span className="l7-status-dot" style={{ background: c.color }} />
      {c.text}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function Lucky7GamePage() {
  const {
    gameState,
    roundResult,
    selectedBet, setSelectedBet,
    stake, setStake,
    hasBet,
    myBetChoice,
    placeBet,
    isMyWin, myPayout,
  } = useLiveGame('lucky7');

  const status = gameState.status;
  const isBettingOpen = status === 'betting';
  const isResult = status === 'result';
  const isRevealing = status === 'revealing';
  const buttonsDisabled = hasBet || !isBettingOpen;

  const isLucky7Win = isResult && isMyWin && roundResult?.result === 'lucky7';
  const isRegularWin = isResult && isMyWin && roundResult?.result !== 'lucky7';
  const isLoss = isResult && hasBet && !isMyWin;

  const showRevealedCard = (status === 'revealing' || isResult) && roundResult?.card;

  return (
    <div className="casino-game-page" style={{ maxWidth: 600 }}>
      <h1>&#127183; Lucky 7</h1>

      <GameRulesModal
        gameKey="lucky7"
        title="How to Play Lucky 7"
        rules={L7_RULES}
        payouts={L7_PAYOUTS}
      />

      {/* Round info + status */}
      <div className="l7-round-row">
        <span className="l7-round-number">
          Round #{gameState.roundId || '--'}
        </span>
        <StatusBadge status={status} />
      </div>

      {/* Main game card */}
      <div className={`l7-game-area${isLucky7Win ? ' l7-lucky-win-bg' : ''}`}>

        {/* Circular Timer at top center */}
        <CircularTimer
          secondsLeft={gameState.secondsLeft}
          maxSeconds={MAX_SECONDS}
          status={status}
        />

        {/* Card Area */}
        <div className="l7-card-stage">
          {/* Face-down during betting/locked */}
          {(isBettingOpen || status === 'locked') && !roundResult && (
            <PlayingCard faceDown={true} />
          )}

          {/* Flipping animation during revealing */}
          {isRevealing && roundResult?.card && (
            <div className="l7-card-reveal-wrap">
              <PlayingCard card={roundResult.card} flipping={true} />
              <div className="l7-card-label-below">
                {roundResult.card.display}
                {' '}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8em' }}>
                  (value: {roundResult.card.numericValue})
                </span>
              </div>
            </div>
          )}

          {/* Revealed card during result */}
          {isResult && roundResult?.card && (
            <div className="l7-card-reveal-wrap">
              <PlayingCard card={roundResult.card} />
              <div className="l7-card-label-below">
                {roundResult.card.display}
                {' '}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8em' }}>
                  (value: {roundResult.card.numericValue})
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Result Banner */}
        {isResult && hasBet && (
          <div className={`l7-result-banner${isLucky7Win ? ' l7-banner-lucky' : isRegularWin ? ' l7-banner-win' : ' l7-banner-loss'}`}>
            {isLucky7Win && (
              <>
                <div className="l7-sparkles-row">
                  <span>&#10024;</span><span>&#10024;</span><span>&#10024;</span>
                  <span>&#10024;</span><span>&#10024;</span>
                </div>
                <div className="l7-result-icon">&#127881;</div>
                <div className="l7-result-title">LUCKY 7!</div>
                <div className="l7-result-payout">+{formatCurrency(myPayout)}</div>
                <div className="l7-result-sub">11x multiplier</div>
                <div className="l7-sparkles-row">
                  <span>&#10024;</span><span>&#10024;</span><span>&#10024;</span>
                  <span>&#10024;</span><span>&#10024;</span>
                </div>
              </>
            )}
            {isRegularWin && (
              <>
                <div className="l7-result-icon">&#9989;</div>
                <div className="l7-result-title">You Won!</div>
                <div className="l7-result-payout">+{formatCurrency(myPayout)}</div>
                <div className="l7-result-sub">1.94x &mdash; {roundResult.result === 'under' ? 'Under 7' : 'Over 7'}</div>
              </>
            )}
            {isLoss && (
              <>
                <div className="l7-result-icon">&#10060;</div>
                <div className="l7-result-title">No Luck</div>
                <div className="l7-result-sub">
                  Card was {roundResult.card?.display} &mdash; That&apos;s {roundResult.result === 'under' ? 'Under' : roundResult.result === 'lucky7' ? 'Lucky 7' : 'Over'} 7.
                  You bet on {myBetChoice === 'under' ? 'Under 7' : myBetChoice === 'lucky7' ? 'Lucky 7' : 'Over 7'}.
                </div>
              </>
            )}
          </div>
        )}

        {/* Result info for non-bettors */}
        {isResult && !hasBet && roundResult && (
          <div className="l7-result-banner l7-banner-neutral">
            <div className="l7-result-sub">
              Result: {roundResult.card?.display} &mdash; {roundResult.result === 'under' ? 'Under 7' : roundResult.result === 'lucky7' ? 'Lucky 7' : 'Over 7'}
            </div>
          </div>
        )}

        {/* Bet Buttons */}
        <div className="l7-bet-grid">
          {/* UNDER 7 */}
          <button
            className={`l7-bet-btn l7-bet-under${selectedBet === 'under' ? ' l7-bet-selected' : ''}`}
            onClick={() => setSelectedBet(selectedBet === 'under' ? null : 'under')}
            disabled={buttonsDisabled}
          >
            <div className="l7-bet-symbol">&lt; 7</div>
            <div className="l7-bet-label">UNDER 7</div>
            <div className="l7-bet-pays">1.94x</div>
            <div className="l7-bet-count">{gameState.betCounts?.under ?? 0} bet{(gameState.betCounts?.under ?? 0) !== 1 ? 's' : ''}</div>
          </button>

          {/* LUCKY 7 */}
          <button
            className={`l7-bet-btn l7-bet-lucky${selectedBet === 'lucky7' ? ' l7-bet-selected' : ''}`}
            onClick={() => setSelectedBet(selectedBet === 'lucky7' ? null : 'lucky7')}
            disabled={buttonsDisabled}
          >
            <div className="l7-lucky-sparkle-row">
              <span className="l7-sparkle">&#10024;</span>
              <div className="l7-lucky-num">7</div>
              <span className="l7-sparkle">&#10024;</span>
            </div>
            <div className="l7-bet-label">LUCKY 7</div>
            <div className="l7-bet-pays l7-pays-big">11x</div>
            <div className="l7-bet-count">{gameState.betCounts?.lucky7 ?? 0} bet{(gameState.betCounts?.lucky7 ?? 0) !== 1 ? 's' : ''}</div>
          </button>

          {/* OVER 7 */}
          <button
            className={`l7-bet-btn l7-bet-over${selectedBet === 'over' ? ' l7-bet-selected' : ''}`}
            onClick={() => setSelectedBet(selectedBet === 'over' ? null : 'over')}
            disabled={buttonsDisabled}
          >
            <div className="l7-bet-symbol">&gt; 7</div>
            <div className="l7-bet-label">OVER 7</div>
            <div className="l7-bet-pays">1.94x</div>
            <div className="l7-bet-count">{gameState.betCounts?.over ?? 0} bet{(gameState.betCounts?.over ?? 0) !== 1 ? 's' : ''}</div>
          </button>
        </div>

        {/* Stake Selector + Place Bet */}
        {isBettingOpen && !hasBet && (
          <div className="l7-bet-controls">
            <div className="l7-stake-row">
              {BET_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  className={`l7-stake-btn${stake === amt ? ' l7-stake-btn--active' : ''}`}
                  onClick={() => setStake(amt)}
                >
                  {formatCurrency(amt)}
                </button>
              ))}
            </div>
            <button
              className={`l7-place-btn${selectedBet ? ' l7-place-ready' : ''}`}
              onClick={placeBet}
              disabled={!selectedBet}
            >
              {selectedBet
                ? `PLACE BET - ${formatCurrency(stake)}`
                : 'SELECT A BET'}
            </button>
          </div>
        )}

        {/* Post-bet message */}
        {hasBet && !isResult && (
          <div className="l7-message l7-message--bet">
            Bet placed on {myBetChoice === 'under' ? 'Under 7' : myBetChoice === 'lucky7' ? 'Lucky 7' : 'Over 7'}! Waiting for result...
          </div>
        )}

        {/* Locked message for non-bettors */}
        {status === 'locked' && !hasBet && (
          <div className="l7-message l7-message--locked">
            Betting closed for this round
          </div>
        )}

        {/* Total bets */}
        {(gameState.totalBets > 0) && (
          <div className="l7-total-bets">
            Total bets this round: {gameState.totalBets}
          </div>
        )}
      </div>

      {/* History Strip */}
      <div className="l7-history-strip">
        <div className="l7-history-label">Recent Results</div>
        <div className="l7-history-badges">
          {(gameState.history || []).length > 0
            ? (gameState.history || []).map((h, i) => (
                <HistoryBadge key={i} result={typeof h === 'string' ? h : h.result} />
              ))
            : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No rounds yet</span>
          }
        </div>
      </div>

      {/* ────────────────────── CSS ────────────────────── */}
      <style>{`
        /* ── Round Row ── */
        .l7-round-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .l7-round-number {
          font-size: 0.85rem;
          color: var(--text-muted, rgba(255,255,255,0.4));
          font-family: var(--font-mono, monospace);
          letter-spacing: 0.5px;
        }

        /* ── Status Badge ── */
        .l7-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 14px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }
        .l7-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          animation: l7DotBlink 1.2s ease-in-out infinite;
        }
        @keyframes l7DotBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* ── Circular Timer ── */
        .l7-circular-timer {
          position: relative;
          width: 140px;
          height: 140px;
          margin: 0 auto 1.25rem;
        }
        .l7-timer-center {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .l7-timer-number {
          font-size: 2.75rem;
          font-weight: 900;
          font-family: var(--font-mono, monospace);
          line-height: 1;
        }
        .l7-timer-emoji {
          font-size: 2.5rem;
          line-height: 1;
        }
        @keyframes l7TimerPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes l7RevealSpin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.08); }
          100% { transform: rotate(360deg) scale(1); }
        }

        /* ══ GAME AREA ═════════════════════════════════════ */
        .l7-game-area {
          background: var(--bg-card, #0e1b2a);
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          border-radius: var(--radius-lg, 16px);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          align-items: center;
        }
        .l7-lucky-win-bg {
          background: linear-gradient(145deg, #1a1200, #0e1b2a) !important;
          border-color: rgba(255,215,0,0.2) !important;
          box-shadow: 0 0 60px rgba(255,215,0,0.08);
        }

        /* ── Card Stage ── */
        .l7-card-stage {
          display: flex;
          justify-content: center;
          perspective: 900px;
          min-height: 196px;
        }
        .l7-card {
          display: block;
          transition: box-shadow 0.3s;
        }
        .l7-card-flipping {
          /* face-down card during deal */
        }
        .l7-card-flip-in {
          animation: l7-flip-reveal 0.55s cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
        @keyframes l7-flip-reveal {
          0%   { transform: rotateY(90deg) scale(0.9); opacity: 0.3; }
          60%  { transform: rotateY(-8deg) scale(1.04); opacity: 1; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        .l7-card-revealed {
          /* revealed card */
        }
        .l7-card-label-below {
          margin-top: 0.6rem;
          text-align: center;
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-primary, #fff);
          font-family: var(--font-mono, monospace);
        }
        .l7-card-reveal-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* ── Result Banners ── */
        .l7-result-banner {
          width: 100%;
          padding: 1.25rem 1rem;
          border-radius: 14px;
          text-align: center;
        }
        .l7-banner-lucky {
          background: linear-gradient(145deg, rgba(255,215,0,0.12), rgba(230,126,34,0.08));
          border: 2px solid rgba(255,215,0,0.4);
          animation: l7-lucky-banner-in 0.5s ease-out, l7-lucky-banner-glow 2s ease-in-out infinite 0.5s;
        }
        @keyframes l7-lucky-banner-in {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes l7-lucky-banner-glow {
          0%, 100% { box-shadow: 0 0 12px rgba(255,215,0,0.2); }
          50%       { box-shadow: 0 0 32px rgba(255,215,0,0.45); }
        }
        .l7-banner-win {
          background: rgba(0,231,1,0.08);
          border: 1px solid rgba(0,231,1,0.25);
          animation: l7-banner-in 0.4s ease-out;
        }
        .l7-banner-loss {
          background: rgba(220,38,38,0.08);
          border: 1px solid rgba(220,38,38,0.25);
          animation: l7-banner-in 0.4s ease-out;
        }
        .l7-banner-neutral {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          animation: l7-banner-in 0.4s ease-out;
        }
        @keyframes l7-banner-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .l7-sparkles-row {
          font-size: 1.1rem;
          letter-spacing: 6px;
          animation: l7-sparkles-dance 1s ease-in-out infinite alternate;
          margin: 0.25rem 0;
        }
        @keyframes l7-sparkles-dance {
          from { letter-spacing: 4px; }
          to   { letter-spacing: 10px; }
        }

        .l7-result-icon {
          font-size: 2.2rem;
          line-height: 1;
          margin: 0.25rem 0;
        }
        .l7-banner-lucky .l7-result-icon {
          font-size: 2.8rem;
          animation: l7-icon-bounce 0.6s ease-out 0.3s both;
        }
        @keyframes l7-icon-bounce {
          0%   { transform: scale(0) rotate(-15deg); }
          60%  { transform: scale(1.2) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .l7-result-title {
          font-size: 1.5rem;
          font-weight: 900;
          margin-bottom: 0.2rem;
        }
        .l7-banner-lucky .l7-result-title {
          font-size: 2rem;
          background: linear-gradient(135deg, #fff7a0, #ffd700, #e67e22);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 2px;
        }
        .l7-banner-win .l7-result-title  { color: #00e701; }
        .l7-banner-loss .l7-result-title { color: #dc2626; }
        .l7-result-payout {
          font-size: 1.75rem;
          font-weight: 900;
          font-family: var(--font-mono, monospace);
          margin: 0.2rem 0;
        }
        .l7-banner-lucky .l7-result-payout { color: #ffd700; }
        .l7-banner-win .l7-result-payout   { color: #00e701; }
        .l7-result-sub {
          font-size: 0.82rem;
          color: rgba(255,255,255,0.55);
          font-weight: 600;
        }

        /* ── Bet Grid ── */
        .l7-bet-grid {
          display: grid;
          grid-template-columns: 1fr 1.15fr 1fr;
          gap: 0.6rem;
          width: 100%;
        }

        .l7-bet-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          padding: 0.9rem 0.5rem;
          border-radius: 14px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          position: relative;
          overflow: hidden;
          text-align: center;
        }
        .l7-bet-btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .l7-bet-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.2s;
          border-radius: 12px;
        }
        .l7-bet-btn:hover:not(:disabled)::before {
          opacity: 1;
        }

        /* UNDER */
        .l7-bet-under {
          background: linear-gradient(145deg, #0e2a4a, #091d35);
          border-color: rgba(29,161,242,0.2);
          color: #5bc8f5;
        }
        .l7-bet-under::before {
          background: linear-gradient(145deg, rgba(29,161,242,0.08), transparent);
        }
        .l7-bet-under:hover:not(:disabled) {
          border-color: rgba(29,161,242,0.5);
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(29,161,242,0.2);
        }
        .l7-bet-under.l7-bet-selected {
          border-color: #1da1f2 !important;
          background: linear-gradient(145deg, #0e2a4a, #0b2040) !important;
          box-shadow: 0 0 0 3px rgba(29,161,242,0.25), 0 6px 24px rgba(29,161,242,0.3) !important;
          transform: translateY(-3px);
        }

        /* LUCKY */
        .l7-bet-lucky {
          background: linear-gradient(145deg, #2a1e00, #1a1200);
          border-color: rgba(255,215,0,0.25);
          color: #ffd700;
        }
        .l7-bet-lucky::before {
          background: linear-gradient(145deg, rgba(255,215,0,0.1), transparent);
        }
        .l7-bet-lucky:hover:not(:disabled) {
          border-color: rgba(255,215,0,0.6);
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 6px 24px rgba(255,215,0,0.3);
        }
        .l7-bet-lucky.l7-bet-selected {
          border-color: #ffd700 !important;
          background: linear-gradient(145deg, #2e2000, #1e1600) !important;
          box-shadow: 0 0 0 3px rgba(255,215,0,0.3), 0 6px 28px rgba(255,215,0,0.4) !important;
          transform: translateY(-3px) scale(1.02);
          animation: l7-lucky-pulse 1.8s ease-in-out infinite;
        }
        @keyframes l7-lucky-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(255,215,0,0.3), 0 6px 28px rgba(255,215,0,0.4); }
          50%       { box-shadow: 0 0 0 5px rgba(255,215,0,0.15), 0 8px 36px rgba(255,215,0,0.55); }
        }

        /* OVER */
        .l7-bet-over {
          background: linear-gradient(145deg, #2a0e0e, #1a0707);
          border-color: rgba(220,38,38,0.2);
          color: #f87171;
        }
        .l7-bet-over::before {
          background: linear-gradient(145deg, rgba(220,38,38,0.08), transparent);
        }
        .l7-bet-over:hover:not(:disabled) {
          border-color: rgba(220,38,38,0.5);
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(220,38,38,0.2);
        }
        .l7-bet-over.l7-bet-selected {
          border-color: #dc2626 !important;
          background: linear-gradient(145deg, #2e1010, #200808) !important;
          box-shadow: 0 0 0 3px rgba(220,38,38,0.25), 0 6px 24px rgba(220,38,38,0.3) !important;
          transform: translateY(-3px);
        }

        /* Bet button internals */
        .l7-bet-symbol {
          font-size: 1.5rem;
          font-weight: 900;
          line-height: 1;
          font-family: 'Georgia', serif;
        }
        .l7-bet-label {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          opacity: 0.9;
        }
        .l7-bet-pays {
          font-size: 0.72rem;
          font-weight: 800;
          opacity: 0.85;
          font-family: var(--font-mono, monospace);
        }
        .l7-pays-big {
          font-size: 0.8rem;
          color: #ffd700;
          opacity: 1;
        }
        .l7-bet-count {
          font-size: 0.6rem;
          opacity: 0.55;
          font-weight: 600;
          margin-top: 2px;
        }

        /* Lucky 7 number in bet button */
        .l7-lucky-sparkle-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .l7-lucky-num {
          font-size: 2rem;
          font-weight: 900;
          font-family: 'Georgia', serif;
          background: linear-gradient(135deg, #fff7a0, #ffd700, #e67e22);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
          filter: drop-shadow(0 0 6px rgba(255,215,0,0.4));
        }
        .l7-sparkle {
          font-size: 0.85rem;
          line-height: 1;
          animation: l7-sparkle-spin 2s linear infinite;
        }
        .l7-sparkle:last-child {
          animation-direction: reverse;
          animation-duration: 1.5s;
        }
        @keyframes l7-sparkle-spin {
          0%   { transform: rotate(0deg) scale(1); opacity: 0.8; }
          50%  { transform: rotate(180deg) scale(1.2); opacity: 1; }
          100% { transform: rotate(360deg) scale(1); opacity: 0.8; }
        }

        /* ── Bet Controls ── */
        .l7-bet-controls {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }
        .l7-stake-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          justify-content: center;
        }
        .l7-stake-btn {
          padding: 6px 14px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.82rem;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all 0.2s;
          background: var(--bg-tertiary, #1a2535);
          color: var(--text-secondary, rgba(255,255,255,0.7));
          font-family: inherit;
        }
        .l7-stake-btn--active {
          background: var(--accent-blue, #1da1f2);
          color: #fff;
          border-color: var(--accent-blue, #1da1f2);
        }

        .l7-place-btn {
          width: 100%;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: 1px;
          cursor: pointer;
          border: none;
          font-family: inherit;
          transition: all 0.2s;
          background: var(--bg-tertiary, #1a2535);
          color: var(--text-muted, rgba(255,255,255,0.4));
          border: 2px solid var(--border-color, rgba(255,255,255,0.08));
        }
        .l7-place-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .l7-place-ready {
          background: linear-gradient(135deg, #1a6b3a, #0d4824) !important;
          border-color: rgba(0,231,1,0.35) !important;
          color: #00e701 !important;
          animation: l7-play-pulse 1.8s ease-in-out infinite;
        }
        .l7-place-ready:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0,231,1,0.25);
        }
        .l7-place-ready:active:not(:disabled) {
          transform: translateY(0);
        }
        @keyframes l7-play-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,231,1,0.2); }
          50%       { box-shadow: 0 0 20px 4px rgba(0,231,1,0.15); }
        }

        /* ── Messages ── */
        .l7-message {
          text-align: center;
          padding: 0.75rem;
          font-weight: 700;
          font-size: 0.9rem;
          border-radius: 10px;
          width: 100%;
        }
        .l7-message--bet {
          color: var(--accent-green, #00e701);
          background: rgba(0,231,1,0.08);
        }
        .l7-message--locked {
          color: var(--text-muted, rgba(255,255,255,0.4));
          background: rgba(255,255,255,0.03);
        }

        /* ── Total bets ── */
        .l7-total-bets {
          font-size: 0.72rem;
          color: var(--text-muted, rgba(255,255,255,0.4));
          font-weight: 600;
          text-align: center;
        }

        /* ══ HISTORY ═══════════════════════════════════════ */
        .l7-history-strip {
          background: var(--bg-card, #0e1b2a);
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          border-radius: var(--radius-lg, 16px);
          padding: 0.85rem 1.25rem;
          margin-top: 0.75rem;
        }
        .l7-history-label {
          font-size: 0.65rem;
          color: var(--text-muted, rgba(255,255,255,0.4));
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .l7-history-badges {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .l7-history-badge {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 900;
          flex-shrink: 0;
        }
        .l7-badge-under {
          background: rgba(29,161,242,0.18);
          border: 1px solid rgba(29,161,242,0.35);
          color: #5bc8f5;
        }
        .l7-badge-lucky {
          background: rgba(255,215,0,0.15);
          border: 1px solid rgba(255,215,0,0.4);
          color: #ffd700;
          box-shadow: 0 0 6px rgba(255,215,0,0.15);
        }
        .l7-badge-over {
          background: rgba(220,38,38,0.15);
          border: 1px solid rgba(220,38,38,0.3);
          color: #f87171;
        }

        /* ══ RESPONSIVE ════════════════════════════════════ */
        @media (max-width: 480px) {
          .l7-circular-timer { width: 110px; height: 110px; }
          .l7-circular-timer svg { width: 110px; height: 110px; }
          .l7-timer-number { font-size: 2rem; }
          .l7-bet-grid {
            grid-template-columns: 1fr 1.1fr 1fr;
            gap: 0.45rem;
          }
          .l7-bet-btn {
            padding: 0.75rem 0.3rem;
          }
          .l7-bet-symbol {
            font-size: 1.25rem;
          }
          .l7-lucky-num {
            font-size: 1.6rem;
          }
          .l7-bet-label {
            font-size: 0.6rem;
            letter-spacing: 0.5px;
          }
          .l7-banner-lucky .l7-result-title {
            font-size: 1.6rem;
          }
          .l7-result-payout {
            font-size: 1.4rem;
          }
        }
      `}</style>
    </div>
  );
}
