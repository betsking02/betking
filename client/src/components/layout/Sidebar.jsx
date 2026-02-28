import { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { SPORT_ICONS } from '../../utils/constants';
import './Sidebar.css';

const sports = [
  { key: 'cricket', name: 'Cricket' },
  { key: 'football', name: 'Football' },
  { key: 'tennis', name: 'Tennis' },
  { key: 'basketball', name: 'Basketball' },
  { key: 'kabaddi', name: 'Kabaddi' },
];

export default function Sidebar() {
  const { user } = useContext(AuthContext);

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Sports</div>
          {sports.map(sport => (
            <NavLink
              key={sport.key}
              to={`/sports/${sport.key}`}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{SPORT_ICONS[sport.key]}</span>
              <span>{sport.name}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Casino</div>
          <NavLink to="/casino" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <span className="sidebar-icon">🎰</span>
            <span>All Games</span>
          </NavLink>
          <NavLink to="/casino/crash" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <span className="sidebar-icon">📈</span>
            <span>Crash</span>
          </NavLink>
          <NavLink to="/casino/color-prediction" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <span className="sidebar-icon">🔴</span>
            <span>Color Prediction</span>
          </NavLink>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Account</div>
          {user && (
            <NavLink to="/dashboard" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <span className="sidebar-icon">📊</span>
              <span>Dashboard</span>
            </NavLink>
          )}
          <NavLink to="/my-bets" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <span className="sidebar-icon">📋</span>
            <span>My Bets</span>
          </NavLink>
          <NavLink to="/wallet" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <span className="sidebar-icon">💰</span>
            <span>Wallet</span>
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <span className="sidebar-icon">🛡️</span>
              <span>Admin Panel</span>
            </NavLink>
          )}
        </div>
      </nav>
    </aside>
  );
}
