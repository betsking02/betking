import { NavLink } from 'react-router-dom';
import './MobileNav.css';

export default function MobileNav() {
  return (
    <nav className="mobile-nav">
      <NavLink to="/" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`} end>
        <span className="mobile-nav-icon">🏠</span>
        <span>Home</span>
      </NavLink>
      <NavLink to="/sports/cricket" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <span className="mobile-nav-icon">🏏</span>
        <span>Sports</span>
      </NavLink>
      <NavLink to="/casino" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <span className="mobile-nav-icon">🎰</span>
        <span>Casino</span>
      </NavLink>
      <NavLink to="/my-bets" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <span className="mobile-nav-icon">📋</span>
        <span>My Bets</span>
      </NavLink>
      <NavLink to="/wallet" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <span className="mobile-nav-icon">💰</span>
        <span>Wallet</span>
      </NavLink>
    </nav>
  );
}
