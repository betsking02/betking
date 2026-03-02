import { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMatch } from '../api/sports';
import { SocketContext } from '../context/SocketContext';
import { formatOdds, formatDate } from '../utils/constants';
import './MatchDetailPage.css';

export default function MatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const socket = useContext(SocketContext);

  const loadMatch = useCallback(() => {
    getMatch(id)
      .then(res => setMatch(res.data.match))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  // Auto-refresh on socket updates
  useEffect(() => {
    if (!socket) return;
    socket.emit('sports:subscribe');
    const handleUpdate = () => loadMatch();
    socket.on('matches:updated', handleUpdate);
    socket.on('odds:updated', handleUpdate);
    return () => {
      socket.emit('sports:unsubscribe');
      socket.off('matches:updated', handleUpdate);
      socket.off('odds:updated', handleUpdate);
    };
  }, [socket, loadMatch]);

  // Polling for live matches
  useEffect(() => {
    if (!match || match.status !== 'live') return;
    const interval = setInterval(loadMatch, 30000);
    return () => clearInterval(interval);
  }, [match?.status, loadMatch]);

  if (loading) {
    return (
      <div className="match-detail-loading">
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="match-detail-empty">
        <p>Match not found</p>
        <button className="btn-back" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  let details = {};
  try {
    details = typeof match.score_details === 'string' ? JSON.parse(match.score_details) : (match.score_details || {});
  } catch { details = {}; }

  const innings = details.innings || Object.values(details).filter(i => i && i.runs !== undefined);
  const venue = details.venue || '';
  const matchName = details.matchName || `${match.home_team} vs ${match.away_team}`;
  const matchType = details.matchType || '';
  const statusText = details.statusText || '';
  const teamInfo = details.teamInfo || [];

  const homeTeamInfo = teamInfo.find(t => t.name === match.home_team) || {};
  const awayTeamInfo = teamInfo.find(t => t.name === match.away_team) || {};

  const homeOdds = match.odds?.find(o => o.outcome_name === 'Home');
  const awayOdds = match.odds?.find(o => o.outcome_name === 'Away');
  const drawOdds = match.odds?.find(o => o.outcome_name === 'Draw');

  const tabs = ['summary', 'scorecard', 'info'];
  if (match.odds?.length > 0) tabs.push('odds');

  return (
    <div className="match-detail">
      {/* Back button */}
      <button className="btn-back" onClick={() => navigate(-1)}>
        &larr; Back
      </button>

      {/* Match Header */}
      <div className="md-header">
        <div className="md-league">{match.league}</div>
        <div className="md-match-name">{matchName}</div>
        {venue && <div className="md-venue">{venue}</div>}
        <div className="md-date">{formatDate(match.commence_time)}</div>
        <span className={`badge badge-${match.status} md-status-badge`}>
          {match.status === 'live' ? (
            <><span className="live-dot"></span> LIVE</>
          ) : match.status.toUpperCase()}
        </span>
      </div>

      {/* Score Card */}
      <div className="md-scoreboard">
        <div className="md-team">
          {homeTeamInfo.img && <img src={homeTeamInfo.img} alt="" className="md-team-logo" />}
          <div className="md-team-info">
            <div className="md-team-name">{homeTeamInfo.shortname || match.home_team}</div>
            <div className="md-team-fullname">{match.home_team}</div>
          </div>
        </div>

        <div className="md-scores-center">
          {innings.length > 0 ? (
            innings.map((inn, i) => (
              <div key={i} className="md-inning-row">
                <span className="md-inning-label">{inn.inning?.split(' Inning')[0] || `Inning ${i + 1}`}</span>
                <span className="md-inning-score">{inn.runs}/{inn.wickets} ({inn.overs} ov)</span>
              </div>
            ))
          ) : (
            <div className="md-vs-text">VS</div>
          )}
        </div>

        <div className="md-team md-team-right">
          {awayTeamInfo.img && <img src={awayTeamInfo.img} alt="" className="md-team-logo" />}
          <div className="md-team-info">
            <div className="md-team-name">{awayTeamInfo.shortname || match.away_team}</div>
            <div className="md-team-fullname">{match.away_team}</div>
          </div>
        </div>
      </div>

      {/* Status text (e.g., "India won by 5 wickets") */}
      {statusText && <div className="md-result-text">{statusText}</div>}

      {/* Tabs */}
      <div className="md-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`md-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="md-tab-content">
        {activeTab === 'summary' && (
          <div className="md-summary">
            {innings.length > 0 ? (
              <div className="md-innings-detail">
                {innings.map((inn, i) => (
                  <div key={i} className="md-inning-card">
                    <div className="md-inning-header">
                      {inn.inning || `Inning ${i + 1}`}
                    </div>
                    <div className="md-inning-stats">
                      <div className="md-stat">
                        <span className="md-stat-label">Runs</span>
                        <span className="md-stat-value">{inn.runs}</span>
                      </div>
                      <div className="md-stat">
                        <span className="md-stat-label">Wickets</span>
                        <span className="md-stat-value">{inn.wickets}</span>
                      </div>
                      <div className="md-stat">
                        <span className="md-stat-label">Overs</span>
                        <span className="md-stat-value">{inn.overs}</span>
                      </div>
                      <div className="md-stat">
                        <span className="md-stat-label">Run Rate</span>
                        <span className="md-stat-value">
                          {inn.overs > 0 ? (inn.runs / inn.overs).toFixed(2) : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
                Match hasn't started yet. Scores will appear here once the match begins.
              </p>
            )}

            {/* Quick Odds in Summary */}
            {match.odds?.length > 0 && match.status !== 'completed' && (
              <div className="md-quick-odds">
                <h4>Betting Odds</h4>
                <div className="md-odds-row">
                  {homeOdds && (
                    <div className="md-odds-card">
                      <span className="md-odds-team">{match.home_team}</span>
                      <span className="md-odds-value">{formatOdds(homeOdds.odds_value)}</span>
                      {homeOdds.bookmaker && <span className="md-odds-book">{homeOdds.bookmaker}</span>}
                    </div>
                  )}
                  {drawOdds && (
                    <div className="md-odds-card">
                      <span className="md-odds-team">Draw</span>
                      <span className="md-odds-value">{formatOdds(drawOdds.odds_value)}</span>
                      {drawOdds.bookmaker && <span className="md-odds-book">{drawOdds.bookmaker}</span>}
                    </div>
                  )}
                  {awayOdds && (
                    <div className="md-odds-card">
                      <span className="md-odds-team">{match.away_team}</span>
                      <span className="md-odds-value">{formatOdds(awayOdds.odds_value)}</span>
                      {awayOdds.bookmaker && <span className="md-odds-book">{awayOdds.bookmaker}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'scorecard' && (
          <div className="md-scorecard">
            {innings.length > 0 ? (
              innings.map((inn, i) => (
                <div key={i} className="md-scorecard-table">
                  <div className="md-sc-header">
                    <span>{inn.inning || `Inning ${i + 1}`}</span>
                    <span className="md-sc-total">{inn.runs}/{inn.wickets} ({inn.overs} ov)</span>
                  </div>
                  <div className="md-sc-stats">
                    <div className="md-sc-row">
                      <span>Total Runs</span>
                      <span>{inn.runs}</span>
                    </div>
                    <div className="md-sc-row">
                      <span>Wickets</span>
                      <span>{inn.wickets}</span>
                    </div>
                    <div className="md-sc-row">
                      <span>Overs</span>
                      <span>{inn.overs}</span>
                    </div>
                    <div className="md-sc-row">
                      <span>Run Rate</span>
                      <span>{inn.overs > 0 ? (inn.runs / inn.overs).toFixed(2) : '-'}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
                Scorecard will be available once the match starts.
              </p>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="md-info">
            <div className="md-info-grid">
              <div className="md-info-row">
                <span className="md-info-label">Match</span>
                <span className="md-info-value">{matchName}</span>
              </div>
              {venue && (
                <div className="md-info-row">
                  <span className="md-info-label">Venue</span>
                  <span className="md-info-value">{venue}</span>
                </div>
              )}
              <div className="md-info-row">
                <span className="md-info-label">Date</span>
                <span className="md-info-value">{formatDate(match.commence_time)}</span>
              </div>
              <div className="md-info-row">
                <span className="md-info-label">Format</span>
                <span className="md-info-value">{matchType.toUpperCase() || match.league}</span>
              </div>
              <div className="md-info-row">
                <span className="md-info-label">Series</span>
                <span className="md-info-value">{match.league}</span>
              </div>
              <div className="md-info-row">
                <span className="md-info-label">Status</span>
                <span className="md-info-value">{statusText || match.status}</span>
              </div>
              {match.home_team && (
                <div className="md-info-row">
                  <span className="md-info-label">Teams</span>
                  <span className="md-info-value">{match.home_team} vs {match.away_team}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'odds' && (
          <div className="md-odds-full">
            <h4>Match Odds</h4>
            {match.odds?.length > 0 ? (
              <div className="md-odds-table">
                <div className="md-odds-table-header">
                  <span>Outcome</span>
                  <span>Odds</span>
                  <span>Bookmaker</span>
                </div>
                {match.odds.map((o, i) => (
                  <div key={i} className="md-odds-table-row">
                    <span className="md-ot-outcome">
                      {o.outcome_name === 'Home' ? match.home_team
                        : o.outcome_name === 'Away' ? match.away_team
                        : o.outcome_name}
                    </span>
                    <span className="md-ot-odds">{formatOdds(o.odds_value)}</span>
                    <span className="md-ot-book">{o.bookmaker || 'BetKing'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted">No odds available for this match.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
