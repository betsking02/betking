import { Link } from 'react-router-dom';
import { CASINO_GAMES } from '../utils/constants';

export default function CasinoPage() {
  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>🎰 Casino Games</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Play with virtual currency - all games are for demo purposes only!
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '1.5rem'
      }}>
        {CASINO_GAMES.map(game => (
          <Link key={game.id} to={game.path} style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            borderTop: `4px solid ${game.color}`,
            padding: '2rem 1.5rem',
            textAlign: 'center',
            textDecoration: 'none',
            color: 'var(--text-primary)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>{game.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{game.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{game.description}</div>
            <div style={{ marginTop: '1rem' }}>
              <span className="btn btn-primary btn-sm">Play Now</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
