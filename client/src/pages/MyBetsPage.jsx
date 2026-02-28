import { useState, useEffect } from 'react';
import { getBetHistory } from '../api/bets';
import { formatCurrency, formatDate } from '../utils/constants';

export default function MyBetsPage() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    getBetHistory({ limit: 50 })
      .then(res => setBets(res.data.bets))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? bets : bets.filter(b => b.status === filter);

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>📋 My Bets</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['all', 'pending', 'won', 'lost'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-muted" style={{ padding: '3rem' }}>No bets found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(bet => (
            <div key={bet.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{bet.selection}</div>
                <div className="text-xs text-muted">{bet.game_type} &bull; {formatDate(bet.placed_at)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Stake: ₹{formatCurrency(bet.stake)}</div>
                {bet.actual_payout > 0 && <div className="text-green">Won: ₹{formatCurrency(bet.actual_payout)}</div>}
                <span className={`badge badge-${bet.status}`}>{bet.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
