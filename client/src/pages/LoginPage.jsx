import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import * as authApi from '../api/auth';

export default function LoginPage() {
  const { loginUser, demoLogin, saveAuth } = useContext(AuthContext);
  const [view, setView] = useState('login'); // 'login' | 'register' | 'verify'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Login form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register form
  const [regForm, setRegForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });

  // Verification
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginUser(username, password);
    } catch (err) {
      const data = err.response?.data;
      // If user needs verification, switch to verify view
      if (data?.requiresVerification) {
        setVerifyEmail(data.email);
        setView('verify');
        setError('');
        setSuccess('Please verify your email to continue.');
      } else {
        setError(data?.error || 'Login failed');
      }
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
      const res = await authApi.register({ username: regForm.username, email: regForm.email, password: regForm.password });
      const data = res.data;
      if (data.requiresVerification) {
        setVerifyEmail(data.email);
        setView('verify');
        setError('');
        setSuccess('Account created! Check your email for the verification code.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await authApi.verifyEmail({ email: verifyEmail, code: verifyCode });
      // Auto-login after verification
      saveAuth(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await authApi.resendCode({ email: verifyEmail });
      setSuccess(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code');
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
    setSuccess('');
  };

  return (
    <div style={styles.page}>
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

          {/* Verification View */}
          {view === 'verify' && (
            <>
              <div style={styles.verifyHeader}>
                <div style={styles.verifyIcon}>&#9993;</div>
                <h2 style={styles.verifyTitle}>Verify Your Email</h2>
                <p style={styles.verifySubtitle}>
                  We sent a 6-digit code to<br />
                  <strong style={{ color: '#fff' }}>{verifyEmail}</strong>
                </p>
              </div>

              {error && <div style={styles.error}>{error}</div>}
              {success && <div style={styles.success}>{success}</div>}

              <form onSubmit={handleVerify}>
                <div style={styles.field}>
                  <label style={styles.label}>Verification Code</label>
                  <input
                    style={{ ...styles.input, ...styles.codeInput }}
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    required
                  />
                </div>
                <button style={styles.btnPrimary} type="submit" disabled={loading || verifyCode.length !== 6}>
                  {loading ? 'Verifying...' : 'Verify Email'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <p style={{ color: '#7a8a9e', fontSize: '13px', marginBottom: '8px' }}>
                  Didn't receive the code?
                </p>
                <button
                  style={styles.linkBtn}
                  onClick={handleResendCode}
                  disabled={loading}
                >
                  Resend Code
                </button>
                <span style={{ color: '#2a3a4a', margin: '0 8px' }}>|</span>
                <button
                  style={styles.linkBtn}
                  onClick={() => switchView('login')}
                >
                  Back to Login
                </button>
              </div>
            </>
          )}

          {/* Login & Register Views */}
          {view !== 'verify' && (
            <>
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
              {success && <div style={styles.success}>{success}</div>}

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
            </>
          )}
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
  success: {
    background: 'rgba(0,231,1,0.1)',
    border: '1px solid rgba(0,231,1,0.3)',
    color: '#00e701',
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
  codeInput: {
    textAlign: 'center',
    fontSize: '24px',
    letterSpacing: '8px',
    fontWeight: '700',
    padding: '16px 14px',
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
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#1da1f2',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  verifyHeader: {
    textAlign: 'center',
    marginBottom: '20px',
  },
  verifyIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  verifyTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '8px',
  },
  verifySubtitle: {
    color: '#b1bad3',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  disclaimer: {
    textAlign: 'center',
    color: '#5a6a7e',
    fontSize: '11px',
    marginTop: '20px',
    maxWidth: '360px',
  },
};
