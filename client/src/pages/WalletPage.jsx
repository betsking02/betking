import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getTransactions } from '../api/wallet';
import { formatCurrency, formatDate } from '../utils/constants';
import './Dashboard.css';

export default function WalletPage() {
  const { user } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showContactModal, setShowContactModal] = useState(null); // 'deposit' | 'withdraw' | null

  useEffect(() => {
    if (!user) return;
    getTransactions({ limit: 50 })
      .then(res => setTransactions(res.data.transactions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const typeColors = {
    deposit: 'var(--accent-green)',
    withdraw: 'var(--accent-red)',
    bet_placed: 'var(--accent-orange)',
    bet_won: 'var(--accent-green)',
    bet_lost: 'var(--accent-red)',
    bonus: 'var(--accent-gold)',
    refund: 'var(--accent-blue)'
  };

  const typeIcons = {
    deposit: '💰',
    withdraw: '💸',
    bet_placed: '🎯',
    bet_won: '🏆',
    bet_lost: '❌',
    bonus: '🎁',
    refund: '↩️'
  };

  if (!user) {
    return (
      <div className="dashboard-login-prompt">
        <div className="prompt-icon">💰</div>
        <h2>Login Required</h2>
        <p>Please login to view your wallet</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>💰 Wallet</h1>

      {/* Balance Card */}
      <div style={{
        background: 'linear-gradient(135deg, #1a2c38, #0f1923)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        textAlign: 'center',
        marginBottom: '1.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(circle at 30% 50%, rgba(0, 231, 1, 0.05), transparent 60%)',
          pointerEvents: 'none'
        }} />
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Available Balance
        </div>
        <div style={{
          fontSize: '3rem', fontWeight: 900, color: 'var(--accent-green)',
          fontFamily: 'var(--font-mono)', marginBottom: '0.5rem'
        }}>
          ₹{formatCurrency(user.balance)}
        </div>
        {user.role === 'demo' && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-orange)', marginTop: '0.25rem' }}>
            Demo account - Virtual currency only
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button
            className="btn btn-primary"
            style={{ minWidth: '140px', padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: 700 }}
            onClick={() => setShowContactModal('deposit')}
          >
            Deposit
          </button>
          <button
            className="btn"
            style={{
              minWidth: '140px', padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: 700,
              background: 'rgba(255, 68, 68, 0.15)', color: 'var(--accent-red)',
              border: '1px solid rgba(255, 68, 68, 0.3)'
            }}
            onClick={() => setShowContactModal('withdraw')}
          >
            Withdraw
          </button>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Deposits</div>
          <div style={{ fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
            ₹{formatCurrency(transactions.filter(t => t.type === 'deposit' || t.type === 'bonus').reduce((s, t) => s + Math.abs(t.amount), 0))}
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Withdrawn</div>
          <div style={{ fontWeight: 700, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
            ₹{formatCurrency(transactions.filter(t => t.type === 'withdraw').reduce((s, t) => s + Math.abs(t.amount), 0))}
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Transactions</div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {transactions.length}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Transaction History</h3>
      {loading ? (
        <div className="spinner" style={{ margin: '2rem auto' }} />
      ) : transactions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
          No transactions yet. Start playing to see your history!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {transactions.map(tx => (
            <div key={tx.id} className="card" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.75rem 1rem', transition: 'border-color 0.2s'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', flexShrink: 0
                }}>
                  {typeIcons[tx.type] || '💳'}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{tx.description || tx.type}</div>
                  <div className="text-xs text-muted">{formatDate(tx.created_at)}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: typeColors[tx.type] || 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}>
                  {tx.amount > 0 ? '+' : ''}₹{formatCurrency(Math.abs(tx.amount))}
                </div>
                <div className="text-xs text-muted">Bal: ₹{formatCurrency(tx.balance_after)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contact Admin Modal */}
      {showContactModal && (
        <div className="balance-modal-overlay" onClick={() => setShowContactModal(null)}>
          <div className="balance-modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
              {showContactModal === 'deposit' ? '💰' : '💸'}
            </div>
            <h3 style={{ marginBottom: '0.5rem', justifyContent: 'center' }}>
              {showContactModal === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              To {showContactModal === 'deposit' ? 'add funds to' : 'withdraw funds from'} your account,
              please contact the admin. They will process your request.
            </p>

            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                Contact Admin Via
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <a href="https://wa.me/919999999999" target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.75rem', borderRadius: 'var(--radius-md)',
                    background: '#25D366', color: '#fff', fontWeight: 700,
                    textDecoration: 'none', fontSize: '0.9rem'
                  }}>
                  WhatsApp
                </a>
                <a href="https://t.me/betking_admin" target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.75rem', borderRadius: 'var(--radius-md)',
                    background: '#0088cc', color: '#fff', fontWeight: 700,
                    textDecoration: 'none', fontSize: '0.9rem'
                  }}>
                  Telegram
                </a>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              marginBottom: '1.5rem',
              fontSize: '0.8rem',
              color: 'var(--accent-gold)'
            }}>
              Minimum {showContactModal === 'deposit' ? 'deposit' : 'withdrawal'}: ₹500 | Processing time: 5-30 minutes
            </div>

            <button className="btn btn-secondary w-full" onClick={() => setShowContactModal(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
