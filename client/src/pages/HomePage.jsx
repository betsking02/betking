import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedMatches, getLiveMatches } from '../api/sports';
import MatchCard from '../components/sports/MatchCard';
import { CASINO_GAMES } from '../utils/constants';
import './HomePage.css';

export default function HomePage() {
  const [featured, setFeatured] = useState([]);
  const [live, setLive] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getFeaturedMatches(), getLiveMatches()])
      .then(([featRes, liveRes]) => {
        setFeatured(featRes.data.matches);
        setLive(liveRes.data.matches);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="home-page">
      {/* Hero Banner */}
      <div className="hero-banner">
        <div className="hero-content">
          <h1>Welcome to <span className="text-gold">BetKing</span></h1>
          <p>The ultimate demo betting & casino platform</p>
          <p className="hero-subtitle">Play with virtual currency - No real money involved</p>
        </div>
      </div>

      {/* Live Matches */}
      {live.length > 0 && (
        <section className="home-section">
          <div className="section-header">
            <h2><span className="badge badge-live">LIVE</span> Live Matches</h2>
          </div>
          <div className="matches-grid">
            {live.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* Featured Matches */}
      <section className="home-section">
        <div className="section-header">
          <h2>Featured Matches</h2>
          <Link to="/sports/cricket" className="view-all">View All</Link>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="matches-grid">
            {featured.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
            {featured.length === 0 && <p className="text-muted">No featured matches right now</p>}
          </div>
        )}
      </section>

      {/* Casino Games */}
      <section className="home-section">
        <div className="section-header">
          <h2>Casino Games</h2>
          <Link to="/casino" className="view-all">View All</Link>
        </div>
        <div className="casino-grid">
          {CASINO_GAMES.map(game => (
            <Link key={game.id} to={game.path} className="casino-card" style={{ borderColor: game.color }}>
              <div className="casino-card-icon">{game.icon}</div>
              <div className="casino-card-name">{game.name}</div>
              <div className="casino-card-desc">{game.description}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
