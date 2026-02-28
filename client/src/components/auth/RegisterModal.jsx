import { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

export default function RegisterModal({ onClose, onSwitchToLogin }) {
  const { registerUser } = useContext(AuthContext);
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await registerUser({ username: form.username, email: form.email, password: form.password });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Create Account</h2>
        <form onSubmit={handleSubmit}>
          {error && <div style={{ color: 'var(--accent-red)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Username</label>
            <input className="input" value={form.username} onChange={update('username')} placeholder="Choose username" required />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Email</label>
            <input className="input" type="email" value={form.email} onChange={update('email')} placeholder="Enter email" required />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Password</label>
            <input className="input" type="password" value={form.password} onChange={update('password')} placeholder="Min 6 characters" required />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Confirm Password</label>
            <input className="input" type="password" value={form.confirmPassword} onChange={update('confirmPassword')} placeholder="Repeat password" required />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <button type="button" onClick={onSwitchToLogin} style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Login
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
