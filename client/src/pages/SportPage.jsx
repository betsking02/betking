import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getMatchesBySport } from '../api/sports';
import MatchCard from '../components/sports/MatchCard';
import BetSlip from '../components/sports/BetSlip';
import { SPORT_ICONS, SPORT_NAMES } from '../utils/constants';

export default function SportPage() {
  const { sportKey } = useParams();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [betSlip, setBetSlip] = useState([]);

  useEffect(() => {
    setLoading(true);
    getMatchesBySport(sportKey)
      .then(res => setMatches(res.data.matches))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sportKey]);

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
            {completed.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>COMPLETED</h3>
                {completed.map(m => <MatchCard key={m.id} match={m} onSelectOdds={addToBetSlip} betSlip={betSlip} />)}
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
