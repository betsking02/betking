import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function LoginPage() {
  const { loginUser, registerUser, demoLogin } = useContext(AuthContext);
  const [view, setView] = useState('login'); // 'login' | 'register'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register form
  const [regForm, setRegForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginUser(username, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (regForm.password !== regForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await registerUser({ username: regForm.username, email: regForm.email, password: regForm.password });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError('');
    setLoading(true);
    try {
      await demoLogin();
    } catch (err) {
      setError(err.response?.data?.error || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const updateReg = (field) => (e) => setRegForm({ ...regForm, [field]: e.target.value });

  const switchView = (v) => {
    setView(v);
    setError('');
  };

  return (
    <div style={styles.page}>
      {/* Animated background */}
      <div style={styles.bgOverlay} />

      <div style={styles.container}>
        {/* Logo & Branding */}
        <div style={styles.branding}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>&#9813;</span>
            <span style={styles.logoText}>BetKing</span>
          </div>
          <p style={styles.tagline}>Demo Betting & Casino Platform</p>
          <p style={styles.subtitle}>Play with virtual currency - No real money involved</p>
        </div>

        {/* Auth Card */}
        <div style={styles.card}>
          {/* Tab Buttons */}
          <div style={styles.tabs}>
            <button
              style={{ ...styles.tab, ...(view === 'login' ? styles.tabActive : {}) }}
              onClick={() => switchView('login')}
            >
              Login
            </button>
            <button
              style={{ ...styles.tab, ...(view === 'register' ? styles.tabActive : {}) }}
              onClick={() => switchView('register')}
            >
              Register
            </button>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          {/* Login Form */}
          {view === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={styles.field}>
                <label style={styles.label}>Username</label>
                <input
                  style={styles.input}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <input
                  style={styles.input}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <button style={styles.btnPrimary} type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          )}

          {/* Register Form */}
          {view === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={styles.field}>
                <label style={styles.label}>Username</label>
                <input
                  style={styles.input}
                  value={regForm.username}
                  onChange={updateReg('username')}
                  placeholder="Choose a username"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input
                  style={styles.input}
                  type="email"
                  value={regForm.email}
                  onChange={updateReg('email')}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <input
                  style={styles.input}
                  type="password"
                  value={regForm.password}
                  onChange={updateReg('password')}
                  placeholder="Min 6 characters"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Confirm Password</label>
                <input
                  style={styles.input}
                  type="password"
                  value={regForm.confirmPassword}
                  onChange={updateReg('confirmPassword')}
                  placeholder="Repeat password"
                  required
                />
              </div>
              <button style={styles.btnPrimary} type="submit" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Divider */}
          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>OR</span>
            <span style={styles.dividerLine} />
          </div>

          {/* Demo Login */}
          <button style={styles.btnDemo} onClick={handleDemo} disabled={loading}>
            {loading ? 'Loading...' : 'Try Demo (No Sign Up)'}
          </button>
          <p style={styles.demoHint}>Get 10,000 virtual coins instantly</p>

          {/* Features */}
          <div style={styles.features}>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>&#9917;</span>
              <span>Sports Betting</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>&#127920;</span>
              <span>Casino Games</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>&#128640;</span>
              <span>Crash Game</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>&#127183;</span>
              <span>Blackjack</span>
            </div>
          </div>
        </div>

        <p style={styles.disclaimer}>
          This is a demo platform for educational purposes only. No real money is used.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a1118 0%, #0f1923 30%, #132a3a 60%, #0f1923 100%)',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
  },
  bgOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'radial-gradient(circle at 20% 50%, rgba(0,231,1,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(29,161,242,0.05) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(255,215,0,0.03) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  container: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  branding: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  logoIcon: {
    fontSize: '42px',
    color: '#ffd700',
    textShadow: '0 0 20px rgba(255,215,0,0.4)',
  },
  logoText: {
    fontSize: '36px',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-1px',
  },
  tagline: {
    color: '#b1bad3',
    fontSize: '14px',
    marginBottom: '4px',
  },
  subtitle: {
    color: '#7a8a9e',
    fontSize: '12px',
  },
  card: {
    width: '100%',
    background: '#1a2c38',
    borderRadius: '16px',
    padding: '28px',
    border: '1px solid #2a3a4a',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '20px',
    background: '#0f212e',
    borderRadius: '10px',
    padding: '4px',
  },
  tab: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: '#7a8a9e',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: '#213743',
    color: '#ffffff',
  },
  error: {
    background: 'rgba(255,68,68,0.1)',
    border: '1px solid rgba(255,68,68,0.3)',
    color: '#ff6b6b',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  field: {
    marginBottom: '14px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#b1bad3',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '2px solid #2a3a4a',
    background: '#0f212e',
    color: '#ffffff',
    fontSize: '14px',
    transition: 'border-color 0.2s',
    outline: 'none',
    boxSizing: 'border-box',
  },
  btnPrimary: {
    width: '100%',
    padding: '13px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #00e701, #00b801)',
    color: '#000',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '6px',
    transition: 'transform 0.1s, box-shadow 0.2s',
    boxShadow: '0 4px 15px rgba(0,231,1,0.3)',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '20px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: '#2a3a4a',
  },
  dividerText: {
    color: '#7a8a9e',
    fontSize: '12px',
    fontWeight: '600',
  },
  btnDemo: {
    width: '100%',
    padding: '13px',
    borderRadius: '10px',
    border: '2px solid #ffd700',
    background: 'rgba(255,215,0,0.1)',
    color: '#ffd700',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  demoHint: {
    textAlign: 'center',
    color: '#7a8a9e',
    fontSize: '12px',
    marginTop: '8px',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #2a3a4a',
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#b1bad3',
    fontSize: '13px',
  },
  featureIcon: {
    fontSize: '18px',
  },
  disclaimer: {
    textAlign: 'center',
    color: '#5a6a7e',
    fontSize: '11px',
    marginTop: '20px',
    maxWidth: '360px',
  },
};
