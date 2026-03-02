import { Link } from 'react-router-dom';
import { CASINO_GAMES } from '../utils/constants';

const GAME_THUMBNAILS = {
  slots: ['🍒','🍋','⭐','🔔','💎'],
  roulette: ['0','32','15','19','4','21','2'],
  blackjack: ['🂡','🂫','🂢','🂮'],
  poker: ['♠','♥','♦','♣','♠'],
  crash: ['1.2x','2.5x','5.1x','10x'],
  color: ['🔴','🟢','🟣','🔴','🟢'],
  mines: ['💎','💎','💣','💎','💣','💎','💎','💣','💎'],
};

export default function CasinoPage() {
  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>🎰 Casino Games</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Play with virtual currency - all games are for demo purposes only!
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1rem'
      }}>
        {CASINO_GAMES.map(game => (
          <Link key={game.id} to={game.path} className="casino-game-card" style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            textDecoration: 'none',
            color: 'var(--text-primary)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            display: 'flex',
            flexDirection: 'column',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px ${game.color}33`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            {/* Visual Preview Area */}
            <div style={{
              background: `linear-gradient(135deg, ${game.color}18, ${game.color}08)`,
              borderBottom: `1px solid ${game.color}22`,
              padding: '1.25rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              minHeight: 70,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(circle at 30% 50%, ${game.color}12, transparent 70%)`,
              }} />
              {(GAME_THUMBNAILS[game.id] || [game.icon]).map((item, i) => (
                <span key={i} style={{
                  fontSize: game.id === 'crash' ? '0.85rem' : '1.5rem',
                  opacity: 0.85,
                  position: 'relative',
                  ...(game.id === 'crash' ? {
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    color: i === 3 ? '#00e701' : i >= 2 ? '#1da1f2' : 'var(--text-muted)',
                  } : {}),
                  ...(game.id === 'roulette' ? {
                    width: 26, height: 26,
                    borderRadius: '50%',
                    background: item === '0' ? '#27ae60' : parseInt(item) % 2 === 0 ? '#2c3e50' : '#c0392b',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  } : {}),
                  ...(game.id === 'mines' ? {
                    width: 28, height: 28,
                    borderRadius: 6,
                    background: item === '💣' ? 'rgba(231,76,60,0.15)' : 'rgba(0,231,1,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem',
                  } : {}),
                }}>{item}</span>
              ))}
            </div>

            {/* Info */}
            <div style={{ padding: '1rem 1rem 1.15rem', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>{game.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.15rem' }}>{game.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{game.description}</div>
              <div>
                <span className="btn btn-primary btn-sm" style={{ fontSize: '0.78rem', padding: '0.4rem 1.2rem' }}>Play Now</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
