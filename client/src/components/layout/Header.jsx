import { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import LoginModal from '../auth/LoginModal';
import RegisterModal from '../auth/RegisterModal';
import { formatCurrency } from '../../utils/constants';
import './Header.css';

export default function Header() {
  const { user, demoLogin, logout } = useContext(AuthContext);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleDemoLogin = async () => {
    try { await demoLogin(); } catch (err) { console.error(err); }
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <Link to="/" className="logo">
            <span className="logo-icon">👑</span>
            <span className="logo-text">BetKing</span>
          </Link>
        </div>

        <div className="header-right">
          {user ? (
            <>
              <Link to="/wallet" className="balance-display">
                <span className="balance-label">Balance</span>
                <span className="balance-amount">₹{formatCurrency(user.balance)}</span>
              </Link>
              <Link to="/wallet" className="btn btn-primary btn-sm">Deposit</Link>
              <div className="user-menu">
                <button className="user-avatar">
                  {user.username.charAt(0).toUpperCase()}
                </button>
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <span>{user.display_name || user.username}</span>
                    <span className="text-xs text-muted">{user.role === 'demo' ? 'Demo Account' : user.username}</span>
                  </div>
                  <Link to="/dashboard" className="dropdown-item">Dashboard</Link>
                  <Link to="/my-bets" className="dropdown-item">My Bets</Link>
                  <Link to="/wallet" className="dropdown-item">Wallet</Link>
                  {user.role === 'admin' && <Link to="/admin" className="dropdown-item">Admin Panel</Link>}
                  <button onClick={logout} className="dropdown-item dropdown-logout">Logout</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <button onClick={handleDemoLogin} className="btn btn-orange btn-sm">Try Demo</button>
              <button onClick={() => setShowLogin(true)} className="btn btn-secondary btn-sm">Login</button>
              <button onClick={() => setShowRegister(true)} className="btn btn-primary btn-sm">Register</button>
            </>
          )}
        </div>
      </header>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSwitchToRegister={() => { setShowLogin(false); setShowRegister(true); }} />}
      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} onSwitchToLogin={() => { setShowRegister(false); setShowLogin(true); }} />}
    </>
  );
}
