import { Link } from 'react-router-dom';
import { SPORT_ICONS, formatOdds, formatDate } from '../../utils/constants';
import './MatchCard.css';

export default function MatchCard({ match, onSelectOdds, betSlip = [] }) {
  const isSelected = (outcome) =>
    betSlip.some(b => b.matchId === match.id && b.outcome === outcome);

  const handleOddsClick = (outcome, oddsValue) => {
    if (onSelectOdds) {
      onSelectOdds(match, outcome, oddsValue);
    }
  };

  const homeOdds = match.odds?.find(o => o.outcome_name === 'Home');
  const awayOdds = match.odds?.find(o => o.outcome_name === 'Away');
  const drawOdds = match.odds?.find(o => o.outcome_name === 'Draw');

  return (
    <div className="match-card">
      <div className="match-card-header">
        <span className="match-league">
          {SPORT_ICONS[match.sport_key]} {match.league}
        </span>
        <span className={`badge badge-${match.status}`}>
          {match.status === 'live' ? '● LIVE' : match.status}
        </span>
      </div>

      <Link to={`/match/${match.id}`} className="match-teams">
        <div className="team">
          <span className="team-name">{match.home_team}</span>
          {match.status === 'live' && <span className="team-score">{match.home_score}</span>}
        </div>
        <div className="match-vs">vs</div>
        <div className="team">
          <span className="team-name">{match.away_team}</span>
          {match.status === 'live' && <span className="team-score">{match.away_score}</span>}
        </div>
      </Link>

      <div className="match-time">{formatDate(match.commence_time)}</div>

      {match.status !== 'completed' && (
        <div className="match-odds">
          {homeOdds && (
            <button
              className={`odds-btn ${isSelected('Home') ? 'selected' : ''}`}
              onClick={() => handleOddsClick('Home', homeOdds.odds_value)}
            >
              <span className="odds-label">1</span>
              <span className="odds-value">{formatOdds(homeOdds.odds_value)}</span>
            </button>
          )}
          {drawOdds && (
            <button
              className={`odds-btn ${isSelected('Draw') ? 'selected' : ''}`}
              onClick={() => handleOddsClick('Draw', drawOdds.odds_value)}
            >
              <span className="odds-label">X</span>
              <span className="odds-value">{formatOdds(drawOdds.odds_value)}</span>
            </button>
          )}
          {awayOdds && (
            <button
              className={`odds-btn ${isSelected('Away') ? 'selected' : ''}`}
              onClick={() => handleOddsClick('Away', awayOdds.odds_value)}
            >
              <span className="odds-label">2</span>
              <span className="odds-value">{formatOdds(awayOdds.odds_value)}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
