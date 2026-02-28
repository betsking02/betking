import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import { formatCurrency, formatDate } from '../utils/constants';
import toast from 'react-hot-toast';
import './Dashboard.css';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [balanceModal, setBalanceModal] = useState(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New modals
  const [passwordModal, setPasswordModal] = useState(null); // { user }
  const [newPassword, setNewPassword] = useState('');
  const [deleteModal, setDeleteModal] = useState(null); // { user }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/users'),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users || usersRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query) => {
    try {
      const res = await api.get(`/admin/users?search=${encodeURIComponent(query)}`);
      setUsers(res.data.users || res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchUsers(search);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleBalanceSubmit = async () => {
    if (!balanceModal || !balanceAmount || Number(balanceAmount) <= 0) {
      return toast.error('Enter a valid amount');
    }
    setSubmitting(true);
    try {
      const endpoint = balanceModal.type === 'add'
        ? `/admin/users/${balanceModal.user.id}/add-balance`
        : `/admin/users/${balanceModal.user.id}/remove-balance`;

      const res = await api.post(endpoint, {
        amount: Number(balanceAmount),
        reason: balanceReason || (balanceModal.type === 'add' ? 'Admin bonus' : 'Admin deduction'),
      });

      const newBalance = res.data.user.balance;
      toast.success(`Balance ${balanceModal.type === 'add' ? 'added' : 'removed'}! New: ${formatCurrency(newBalance)}`);

      setUsers(prev => prev.map(u =>
        u.id === balanceModal.user.id ? { ...u, balance: newBalance } : u
      ));
      setBalanceModal(null);
      setBalanceAmount('');
      setBalanceReason('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update balance');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordModal || !newPassword || newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setSubmitting(true);
    try {
      const res = await api.put(`/admin/users/${passwordModal.user.id}/password`, { newPassword });
      toast.success(res.data.message);
      setPasswordModal(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModal) return;
    setSubmitting(true);
    try {
      const res = await api.delete(`/admin/users/${deleteModal.user.id}`);
      toast.success(res.data.message);
      setUsers(prev => prev.filter(u => u.id !== deleteModal.user.id));
      setDeleteModal(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVerify = async (u) => {
    try {
      const res = await api.put(`/admin/users/${u.id}/verify`, { is_verified: !u.is_verified });
      toast.success(res.data.message);
      setUsers(prev => prev.map(usr =>
        usr.id === u.id ? { ...usr, is_verified: res.data.is_verified } : usr
      ));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update verification');
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="dashboard-login-prompt">
        <div className="prompt-icon">🔒</div>
        <h2>Access Denied</h2>
        <p>You need admin privileges to access this page</p>
      </div>
    );
  }

  if (loading) return <div className="spinner" style={{ margin: '3rem auto' }} />;

  return (
    <div className="admin-dashboard">
      <h1>Admin Panel</h1>

      {/* Stats */}
      {stats && (
        <div className="admin-stats-grid">
          {[
            { label: 'Total Users', value: stats.stats.totalUsers, icon: '👥', color: 'var(--accent-blue)' },
            { label: 'Total Bets', value: stats.stats.totalBets, icon: '🎯', color: 'var(--accent-orange)' },
            { label: 'Total Wagered', value: `₹${formatCurrency(stats.stats.totalWagered)}`, icon: '💰', color: 'var(--accent-gold)' },
            { label: 'Total Paid Out', value: `₹${formatCurrency(stats.stats.totalPaidOut)}`, icon: '💸', color: 'var(--accent-green)' },
            { label: 'House P&L', value: `₹${formatCurrency(stats.stats.housePnL)}`, icon: '🏦', color: stats.stats.housePnL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
            { label: 'Active Bets', value: stats.stats.activeBets, icon: '⏳', color: 'var(--accent-purple)' },
            { label: 'Live Matches', value: stats.stats.liveMatches, icon: '🔴', color: 'var(--accent-red)' },
          ].map((stat, i) => (
            <div key={i} className="admin-stat-card">
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          Users ({users.length})
        </button>
        <button className={`admin-tab ${activeTab === 'bets' ? 'active' : ''}`} onClick={() => setActiveTab('bets')}>
          Recent Bets
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="dashboard-row">
          <div className="dashboard-section">
            <h3>Recent Bets</h3>
            {stats.recentBets.length > 0 ? (
              <div className="admin-bets-list">
                {stats.recentBets.map(bet => (
                  <div key={bet.id} className="admin-bet-item">
                    <div className="bet-info">
                      <div className="bet-user">{bet.username}</div>
                      <div className="bet-detail">{bet.game_type}: {bet.selection}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="bet-amount">₹{formatCurrency(bet.stake)}</span>
                      <span className={`badge badge-${bet.status}`}>{bet.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>No bets yet</p>
              </div>
            )}
          </div>

          <div className="dashboard-section">
            <h3>Top Users</h3>
            {users.slice(0, 5).map(u => (
              <div key={u.id} className="activity-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8rem', fontWeight: 700, color: '#fff'
                  }}>
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold" style={{ fontSize: '0.9rem' }}>{u.username}</div>
                    <div className="text-xs text-muted">{u.role}</div>
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-green)' }}>
                  ₹{formatCurrency(u.balance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <>
          <div className="admin-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by username or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="table-container">
            <table className="admin-user-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className="avatar-sm">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{u.username}</div>
                          <div className="user-email">{u.email || 'No email'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? '' : u.role === 'demo' ? 'badge-pending' : 'badge-won'}`}
                        style={u.role === 'admin' ? { background: 'rgba(155,89,182,0.2)', color: '#9b59b6' } : {}}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleVerify(u)}
                        style={{
                          background: u.is_verified ? 'rgba(0,231,1,0.12)' : 'rgba(255,68,68,0.12)',
                          color: u.is_verified ? '#00e701' : '#ff4444',
                          border: `1px solid ${u.is_verified ? 'rgba(0,231,1,0.3)' : 'rgba(255,68,68,0.3)'}`,
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {u.is_verified ? 'Verified' : 'Unverified'}
                      </button>
                    </td>
                    <td className="balance-cell">₹{formatCurrency(u.balance)}</td>
                    <td className="text-muted text-sm">{u.created_at ? formatDate(u.created_at) : 'N/A'}</td>
                    <td>
                      <div className="actions-cell" style={{ flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-sm"
                          style={{ background: 'rgba(0, 231, 1, 0.15)', color: 'var(--accent-green)', border: '1px solid rgba(0, 231, 1, 0.3)' }}
                          onClick={() => { setBalanceModal({ user: u, type: 'add' }); setBalanceAmount(''); setBalanceReason(''); }}
                        >
                          + Add
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background: 'rgba(255, 107, 0, 0.15)', color: 'var(--accent-orange)', border: '1px solid rgba(255, 107, 0, 0.3)' }}
                          onClick={() => { setBalanceModal({ user: u, type: 'remove' }); setBalanceAmount(''); setBalanceReason(''); }}
                        >
                          - Remove
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background: 'rgba(29, 161, 242, 0.15)', color: 'var(--accent-blue)', border: '1px solid rgba(29, 161, 242, 0.3)' }}
                          onClick={() => { setPasswordModal({ user: u }); setNewPassword(''); }}
                        >
                          🔑 Password
                        </button>
                        {u.role !== 'admin' && (
                          <button
                            className="btn btn-sm"
                            style={{ background: 'rgba(255, 68, 68, 0.15)', color: 'var(--accent-red)', border: '1px solid rgba(255, 68, 68, 0.3)' }}
                            onClick={() => setDeleteModal({ user: u })}
                          >
                            🗑 Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Recent Bets Tab */}
      {activeTab === 'bets' && stats && (
        <div className="dashboard-section">
          {stats.recentBets.length > 0 ? (
            <div className="admin-bets-list">
              {stats.recentBets.map(bet => (
                <div key={bet.id} className="admin-bet-item">
                  <div className="bet-info">
                    <div className="bet-user">{bet.username}</div>
                    <div className="bet-detail">{bet.game_type}: {bet.selection}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="bet-amount">₹{formatCurrency(bet.stake)}</span>
                    <span className={`badge badge-${bet.status}`}>{bet.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>No bets placed yet</p>
            </div>
          )}
        </div>
      )}

      {/* Balance Modal */}
      {balanceModal && (
        <div className="balance-modal-overlay" onClick={() => setBalanceModal(null)}>
          <div className="balance-modal" onClick={e => e.stopPropagation()}>
            <h3>
              {balanceModal.type === 'add' ? '💰 Add Balance' : '💸 Remove Balance'}
            </h3>

            <div className="modal-user-info">
              <div className="avatar-sm">
                {balanceModal.user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold">{balanceModal.user.username}</div>
                <div className="current-balance">
                  Current: <span>₹{formatCurrency(balanceModal.user.balance)}</span>
                </div>
              </div>
            </div>

            <label>Amount</label>
            <input
              type="number"
              placeholder="Enter amount"
              value={balanceAmount}
              onChange={e => setBalanceAmount(e.target.value)}
              min="1"
              autoFocus
            />

            <div className="quick-amounts">
              {[100, 500, 1000, 5000, 10000].map(amt => (
                <button key={amt} onClick={() => setBalanceAmount(String(amt))}>
                  ₹{formatCurrency(amt)}
                </button>
              ))}
            </div>

            <label>Reason (optional)</label>
            <textarea
              placeholder={balanceModal.type === 'add' ? 'e.g., Bonus, Refund, Promotion' : 'e.g., Fraud, Correction, Penalty'}
              value={balanceReason}
              onChange={e => setBalanceReason(e.target.value)}
              rows={2}
            />

            {balanceAmount && Number(balanceAmount) > 0 && (
              <div style={{
                padding: '0.75rem',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                fontSize: '0.85rem'
              }}>
                New balance will be:{' '}
                <strong style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                  ₹{formatCurrency(
                    balanceModal.type === 'add'
                      ? balanceModal.user.balance + Number(balanceAmount)
                      : Math.max(0, balanceModal.user.balance - Number(balanceAmount))
                  )}
                </strong>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setBalanceModal(null)}>Cancel</button>
              <button
                className={`btn ${balanceModal.type === 'add' ? 'btn-primary' : ''}`}
                style={balanceModal.type === 'remove' ? { background: 'var(--accent-red)', color: '#fff' } : {}}
                onClick={handleBalanceSubmit}
                disabled={submitting || !balanceAmount || Number(balanceAmount) <= 0}
              >
                {submitting ? 'Processing...' : balanceModal.type === 'add' ? 'Add Balance' : 'Remove Balance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordModal && (
        <div className="balance-modal-overlay" onClick={() => setPasswordModal(null)}>
          <div className="balance-modal" onClick={e => e.stopPropagation()}>
            <h3>🔑 Change Password</h3>

            <div className="modal-user-info">
              <div className="avatar-sm">
                {passwordModal.user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold">{passwordModal.user.username}</div>
                <div className="text-muted text-sm">{passwordModal.user.email || 'No email'}</div>
              </div>
            </div>

            <label>New Password</label>
            <input
              type="text"
              placeholder="Enter new password (min 6 characters)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoFocus
            />

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>
              The user will need to use this new password to login.
            </p>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setPasswordModal(null)}>Cancel</button>
              <button
                className="btn"
                style={{ background: 'var(--accent-blue)', color: '#fff' }}
                onClick={handlePasswordChange}
                disabled={submitting || newPassword.length < 6}
              >
                {submitting ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteModal && (
        <div className="balance-modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="balance-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--accent-red)' }}>🗑 Delete User</h3>

            <div className="modal-user-info">
              <div className="avatar-sm" style={{ background: 'linear-gradient(135deg, var(--accent-red), #cc0000)' }}>
                {deleteModal.user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold">{deleteModal.user.username}</div>
                <div className="text-muted text-sm">{deleteModal.user.email || 'No email'}</div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid rgba(255,68,68,0.3)',
              borderRadius: '8px',
              padding: '1rem',
              margin: '1rem 0',
              fontSize: '0.85rem',
              color: '#ff6b6b',
              lineHeight: '1.5',
            }}>
              <strong>Warning:</strong> This will permanently delete this user and all their data including:
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
                <li>User account</li>
                <li>All bet history</li>
                <li>All transaction history</li>
              </ul>
              This action cannot be undone.
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button
                className="btn"
                style={{ background: 'var(--accent-red)', color: '#fff' }}
                onClick={handleDeleteUser}
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
