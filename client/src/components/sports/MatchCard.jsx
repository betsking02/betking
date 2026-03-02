import { Link } from 'react-router-dom';
import { SPORT_ICONS, formatOdds, formatDate } from '../../utils/constants';
import './MatchCard.css';

function CricketScore({ match }) {
  let details = {};
  try {
    details = typeof match.score_details === 'string' ? JSON.parse(match.score_details) : (match.score_details || {});
  } catch { details = {}; }

  // Handle both new format (details.innings) and old format (values with runs)
  const innings = details.innings || Object.values(details).filter(i => i && typeof i === 'object' && !Array.isArray(i) && i.runs !== undefined);
  const statusText = details.statusText || '';

  // Don't render empty box
  if (innings.length === 0 && !statusText) return null;

  return (
    <div className="cricket-scores">
      {innings.map((inn, i) => (
        <div key={i} className="cricket-inning">
          <span className="inning-name">{inn.inning?.split(' Inning')[0] || `Team ${i + 1}`}</span>
          <span className="inning-score">{inn.runs}/{inn.wickets} <small>({inn.overs} ov)</small></span>
        </div>
      ))}
      {statusText && (
        <div className={`cricket-result-text ${match.status === 'live' ? 'cricket-live-text' : ''}`}>{statusText}</div>
      )}
    </div>
  );
}

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
  const isCricket = match.sport_key === 'cricket';

  return (
    <div className={`match-card ${match.status === 'live' ? 'match-card-live' : ''}`}>
      <div className="match-card-header">
        <span className="match-league">
          {SPORT_ICONS[match.sport_key]} {match.league}
        </span>
        <span className={`badge badge-${match.status}`}>
          {match.status === 'live' ? (
            <><span className="live-dot"></span> LIVE</>
          ) : match.status}
        </span>
      </div>

      <Link to={`/match/${match.id}`} className="match-teams">
        <div className="team">
          <span className="team-name">{match.home_team}</span>
          {match.status !== 'upcoming' && !isCricket && <span className="team-score">{match.home_score}</span>}
        </div>
        <div className="match-vs">vs</div>
        <div className="team">
          <span className="team-name">{match.away_team}</span>
          {match.status !== 'upcoming' && !isCricket && <span className="team-score">{match.away_score}</span>}
        </div>
      </Link>

      {isCricket && match.status !== 'upcoming' && <CricketScore match={match} />}

      <div className="match-time">{formatDate(match.commence_time)}</div>

      {match.odds?.length > 0 && match.status !== 'completed' && (
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
