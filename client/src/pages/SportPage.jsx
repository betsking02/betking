import { useState, useEffect, useContext, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getMatchesBySport } from '../api/sports';
import MatchCard from '../components/sports/MatchCard';
import BetSlip from '../components/sports/BetSlip';
import { SPORT_ICONS, SPORT_NAMES } from '../utils/constants';
import { SocketContext } from '../context/SocketContext';

export default function SportPage() {
  const { sportKey } = useParams();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [betSlip, setBetSlip] = useState([]);
  const socket = useContext(SocketContext);

  const loadMatches = useCallback(() => {
    getMatchesBySport(sportKey)
      .then(res => setMatches(res.data.matches))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sportKey]);

  useEffect(() => {
    setLoading(true);
    loadMatches();
  }, [loadMatches]);

  // Auto-refresh when socket says matches or odds updated
  useEffect(() => {
    if (!socket) return;

    socket.emit('sports:subscribe');

    const handleUpdate = () => loadMatches();
    socket.on('matches:updated', handleUpdate);
    socket.on('odds:updated', handleUpdate);

    return () => {
      socket.emit('sports:unsubscribe');
      socket.off('matches:updated', handleUpdate);
      socket.off('odds:updated', handleUpdate);
    };
  }, [socket, loadMatches]);

  // Polling fallback: refresh every 60 seconds when there are live matches
  useEffect(() => {
    const hasLive = matches.some(m => m.status === 'live');
    if (!hasLive) return;

    const interval = setInterval(loadMatches, 60000);
    return () => clearInterval(interval);
  }, [matches, loadMatches]);

  const addToBetSlip = (match, outcome, odds) => {
    const exists = betSlip.find(b => b.matchId === match.id && b.outcome === outcome);
    if (exists) {
      setBetSlip(betSlip.filter(b => !(b.matchId === match.id && b.outcome === outcome)));
    } else {
      setBetSlip([...betSlip, {
        matchId: match.id,
        match: `${match.home_team} vs ${match.away_team}`,
        outcome,
        odds,
        stake: 0
      }]);
    }
  };

  const removeFromSlip = (index) => {
    setBetSlip(betSlip.filter((_, i) => i !== index));
  };

  const clearSlip = () => setBetSlip([]);

  const live = matches.filter(m => m.status === 'live');
  const upcoming = matches.filter(m => m.status === 'upcoming');
  const completed = matches.filter(m => m.status === 'completed');

  // Group completed matches by series/league
  const completedBySeries = {};
  completed.forEach(m => {
    const series = m.league || 'Other';
    if (!completedBySeries[series]) completedBySeries[series] = [];
    completedBySeries[series].push(m);
  });
  // Sort each series by date descending (most recent first) and limit to 3
  Object.keys(completedBySeries).forEach(series => {
    completedBySeries[series].sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time));
    completedBySeries[series] = completedBySeries[series].slice(0, 3);
  });

  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {SPORT_ICONS[sportKey]} {SPORT_NAMES[sportKey] || sportKey}
        </h1>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <>
            {live.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-red)', marginBottom: '0.75rem' }}>LIVE NOW</h3>
                {live.map(m => <MatchCard key={m.id} match={m} onSelectOdds={addToBetSlip} betSlip={betSlip} />)}
              </div>
            )}
            {upcoming.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>UPCOMING</h3>
                {upcoming.map(m => <MatchCard key={m.id} match={m} onSelectOdds={addToBetSlip} betSlip={betSlip} />)}
              </div>
            )}
            {Object.keys(completedBySeries).length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>RECENT RESULTS</h3>
                {Object.entries(completedBySeries).map(([series, seriesMatches]) => (
                  <div key={series} style={{ marginBottom: '1rem' }}>
                    <div style={{
                      fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: '600',
                      padding: '0.4rem 0.75rem', background: 'rgba(114, 137, 218, 0.08)',
                      borderRadius: '4px', marginBottom: '0.5rem', letterSpacing: '0.5px'
                    }}>
                      {series}
                    </div>
                    {seriesMatches.map(m => <MatchCard key={m.id} match={m} onSelectOdds={addToBetSlip} betSlip={betSlip} />)}
                  </div>
                ))}
              </div>
            )}
            {matches.length === 0 && <p className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>No matches found for this sport</p>}
          </>
        )}
      </div>

      {betSlip.length > 0 && (
        <BetSlip bets={betSlip} onRemove={removeFromSlip} onClear={clearSlip} onUpdateStake={(idx, stake) => {
          const updated = [...betSlip];
          updated[idx].stake = stake;
          setBetSlip(updated);
        }} onBetPlaced={() => setBetSlip([])} />
      )}
    </div>
  );
}
