import { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { placeBet } from '../../api/bets';
import { formatCurrency, BET_AMOUNTS } from '../../utils/constants';
import toast from 'react-hot-toast';
import './BetSlip.css';

export default function BetSlip({ bets, onRemove, onClear, onUpdateStake, onBetPlaced }) {
  const { user, updateBalance } = useContext(AuthContext);
  const [placing, setPlacing] = useState(false);

  const totalStake = bets.reduce((sum, b) => sum + (b.stake || 0), 0);
  const totalPayout = bets.reduce((sum, b) => sum + (b.stake || 0) * (b.odds || 0), 0);

  const handlePlaceBets = async () => {
    if (!user) return toast.error('Please login first');
    if (totalStake === 0) return toast.error('Enter stake amount');
    if (totalStake > user.balance) return toast.error('Insufficient balance');

    setPlacing(true);
    try {
      for (const bet of bets) {
        if (bet.stake > 0) {
          const res = await placeBet({
            match_id: bet.matchId,
            game_type: 'sports',
            bet_type: 'back',
            selection: `${bet.match} - ${bet.outcome}`,
            odds: bet.odds,
            stake: bet.stake
          });
          updateBalance(res.data.balance);
        }
      }
      toast.success('Bets placed successfully!');
      onBetPlaced();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="bet-slip">
      <div className="bet-slip-header">
        <h3>Bet Slip ({bets.length})</h3>
        <button className="btn btn-sm btn-secondary" onClick={onClear}>Clear</button>
      </div>

      <div className="bet-slip-items">
        {bets.map((bet, idx) => (
          <div key={idx} className="bet-slip-item">
            <div className="bet-slip-item-header">
              <div>
                <div className="bet-slip-selection">{bet.outcome}</div>
                <div className="bet-slip-match">{bet.match}</div>
              </div>
              <button className="bet-slip-remove" onClick={() => onRemove(idx)}>×</button>
            </div>
            <div className="bet-slip-item-footer">
              <span className="bet-slip-odds">@ {bet.odds?.toFixed(2)}</span>
              <input
                type="number"
                className="input bet-slip-stake"
                placeholder="Stake"
                value={bet.stake || ''}
                onChange={e => onUpdateStake(idx, parseFloat(e.target.value) || 0)}
                min="0"
              />
            </div>
            <div className="bet-slip-quick-stakes">
              {BET_AMOUNTS.slice(0, 4).map(amt => (
                <button key={amt} className="btn btn-sm btn-secondary"
                  onClick={() => onUpdateStake(idx, amt)}>
                  {amt >= 1000 ? `${amt/1000}K` : amt}
                </button>
              ))}
            </div>
            {bet.stake > 0 && (
              <div className="bet-slip-payout">
                Potential: <span className="text-green">₹{formatCurrency(bet.stake * bet.odds)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bet-slip-footer">
        <div className="bet-slip-totals">
          <div>Total Stake: <strong>₹{formatCurrency(totalStake)}</strong></div>
          <div>Potential Win: <strong className="text-green">₹{formatCurrency(totalPayout)}</strong></div>
        </div>
        <button
          className="btn btn-primary w-full"
          onClick={handlePlaceBets}
          disabled={placing || totalStake === 0 || !user}
        >
          {placing ? 'Placing...' : `Place Bet (₹${formatCurrency(totalStake)})`}
        </button>
      </div>
    </div>
  );
}
