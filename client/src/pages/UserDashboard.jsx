import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import { formatCurrency, formatDate, CASINO_GAMES } from '../utils/constants';
import './Dashboard.css';

export default function UserDashboard() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/dashboard')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (!user) {
    return (
      <div className="dashboard-login-prompt">
        <div className="prompt-icon">👤</div>
        <h2>Login Required</h2>
        <p>Please login or create an account to view your dashboard</p>
      </div>
    );
  }

  if (loading) return <div className="spinner" style={{ margin: '3rem auto' }} />;

  return (
    <div className="dashboard">
      {/* User Profile Card */}
      <div className="dashboard-profile-card">
        <div className="profile-avatar">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div className="profile-info">
          <h2>{user.display_name || user.username}</h2>
          <div className="profile-meta">
            <span className="profile-username">@{user.username}</span>
            {user.role === 'demo' && <span className="badge badge-pending">DEMO</span>}
            {user.role === 'admin' && <span className="badge" style={{ background: 'rgba(155,89,182,0.2)', color: '#9b59b6' }}>ADMIN</span>}
          </div>
        </div>
        <div className="profile-balance">
          <div className="profile-balance-label">Balance</div>
          <div className="profile-balance-amount">₹{formatCurrency(user.balance)}</div>
          <Link to="/wallet" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>Deposit</Link>
        </div>
      </div>

      {/* Stats Grid */}
      {data && (
        <>
          <div className="dashboard-stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-value">{data.stats.totalBets}</div>
              <div className="stat-label">Total Bets</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-value">₹{formatCurrency(data.stats.totalWagered)}</div>
              <div className="stat-label">Total Wagered</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🏆</div>
              <div className="stat-value" style={{ color: 'var(--accent-green)' }}>₹{formatCurrency(data.stats.totalWon)}</div>
              <div className="stat-label">Total Won</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-value" style={{ color: data.stats.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {data.stats.netProfit >= 0 ? '+' : ''}₹{formatCurrency(data.stats.netProfit)}
              </div>
              <div className="stat-label">Net Profit/Loss</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-value">{data.stats.winRate}%</div>
              <div className="stat-label">Win Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏳</div>
              <div className="stat-value">{data.stats.pendingBets}</div>
              <div className="stat-label">Active Bets</div>
            </div>
          </div>

          {/* Win/Loss Summary */}
          <div className="dashboard-row">
            <div className="dashboard-section">
              <h3>Win / Loss</h3>
              <div className="win-loss-bar">
                <div className="win-bar" style={{ width: `${data.stats.totalBets > 0 ? (data.stats.wonBets / data.stats.totalBets) * 100 : 0}%` }}>
                  {data.stats.wonBets} Won
                </div>
                <div className="loss-bar" style={{ width: `${data.stats.totalBets > 0 ? (data.stats.lostBets / data.stats.totalBets) * 100 : 0}%` }}>
                  {data.stats.lostBets} Lost
                </div>
              </div>
            </div>

            {/* Game Breakdown */}
            <div className="dashboard-section">
              <h3>Games Played</h3>
              {data.gameBreakdown.length > 0 ? (
                <div className="game-breakdown">
                  {data.gameBreakdown.map(g => {
                    const game = CASINO_GAMES.find(c => c.id === g.game_type) || { icon: '🎮', name: g.game_type };
                    return (
                      <div key={g.game_type} className="game-breakdown-item">
                        <div className="game-breakdown-left">
                          <span>{game.icon || '🎮'}</span>
                          <span>{game.name || g.game_type}</span>
                        </div>
                        <div className="game-breakdown-right">
                          <span className="text-muted">{g.count} bets</span>
                          <span style={{ color: g.won - g.wagered >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {g.won - g.wagered >= 0 ? '+' : ''}₹{formatCurrency(g.won - g.wagered)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted text-sm">No games played yet</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="dashboard-row">
            <div className="dashboard-section">
              <div className="section-header-row">
                <h3>Recent Bets</h3>
                <Link to="/my-bets" className="text-sm" style={{ color: 'var(--accent-blue)' }}>View All</Link>
              </div>
              {data.recentBets.length > 0 ? (
                <div className="activity-list">
                  {data.recentBets.map(bet => (
                    <div key={bet.id} className="activity-item">
                      <div>
                        <div className="activity-title">{bet.selection}</div>
                        <div className="text-xs text-muted">{bet.game_type} &bull; {formatDate(bet.placed_at)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="text-sm">₹{formatCurrency(bet.stake)}</div>
                        <span className={`badge badge-${bet.status}`}>{bet.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">No bets yet. Start playing!</p>
              )}
            </div>

            <div className="dashboard-section">
              <div className="section-header-row">
                <h3>Recent Transactions</h3>
                <Link to="/wallet" className="text-sm" style={{ color: 'var(--accent-blue)' }}>View All</Link>
              </div>
              {data.recentTransactions.length > 0 ? (
                <div className="activity-list">
                  {data.recentTransactions.map(tx => (
                    <div key={tx.id} className="activity-item">
                      <div>
                        <div className="activity-title">{tx.description || tx.type}</div>
                        <div className="text-xs text-muted">{formatDate(tx.created_at)}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: tx.amount > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {tx.amount > 0 ? '+' : ''}₹{formatCurrency(Math.abs(tx.amount))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">No transactions yet</p>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="dashboard-section">
            <h3>Quick Play</h3>
            <div className="quick-links">
              {CASINO_GAMES.map(game => (
                <Link key={game.id} to={game.path} className="quick-link-card" style={{ borderColor: game.color }}>
                  <span style={{ fontSize: '1.5rem' }}>{game.icon}</span>
                  <span className="text-sm font-bold">{game.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
