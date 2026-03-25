import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from './useSocket';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/constants';

export function useLiveGame(gameId) {
  const { user } = useContext(AuthContext);
  const socket = useSocket();

  const [gameState, setGameState] = useState({
    status: 'betting',
    secondsLeft: 30,
    roundId: 0,
    betCounts: {},
    totalBets: 0,
    history: [],
    roundData: null,
  });

  const [selectedBet, setSelectedBet] = useState(null);
  const [stake, setStake] = useState(100);
  const [hasBet, setHasBet] = useState(false);
  const hasBetRef = useRef(false);
  const [myBets, setMyBets] = useState([]);
  const [myBetChoice, setMyBetChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [isMyWin, setIsMyWin] = useState(false);
  const [myPayout, setMyPayout] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const prefix = `live:${gameId}`;
    socket.emit(`${prefix}:join`);

    socket.on(`${prefix}:state`, (state) => {
      setGameState(state);
      if (state.status === 'result' && state.roundData) {
        setRoundResult(state.roundData);
      }
    });

    socket.on(`${prefix}:new_round`, ({ roundId, countdown }) => {
      setGameState(prev => ({
        ...prev,
        status: 'betting',
        secondsLeft: countdown,
        roundId,
        roundData: null,
      }));
      setHasBet(false);
      hasBetRef.current = false;
      setMyBets([]);
      setSelectedBet(null);
      setMyBetChoice(null);
      setRoundResult(null);
      setIsMyWin(false);
      setMyPayout(0);
    });

    socket.on(`${prefix}:tick`, ({ secondsLeft, status }) => {
      setGameState(prev => ({ ...prev, secondsLeft, status }));
    });

    socket.on(`${prefix}:locked`, () => {
      setGameState(prev => ({ ...prev, status: 'locked' }));
    });

    socket.on(`${prefix}:revealing`, () => {
      setGameState(prev => ({ ...prev, status: 'revealing', secondsLeft: 0 }));
    });

    socket.on(`${prefix}:result`, ({ roundId, roundData, winners, totalBets }) => {
      setGameState(prev => ({
        ...prev,
        status: 'result',
        roundData,
        history: [{ roundId, result: roundData.result, roundData }, ...prev.history].slice(0, 20),
      }));
      setRoundResult(roundData);

      const myWin = winners?.find(w => w.username === user?.username);
      if (myWin) {
        setIsMyWin(true);
        setMyPayout(myWin.payout);
        toast.success(`You won ${formatCurrency(myWin.payout)}! (${myWin.multiplier}x)`);
      } else if (hasBetRef.current) {
        setIsMyWin(false);
        toast.error('Better luck next round!');
      }
    });

    socket.on(`${prefix}:bets_count`, ({ betCounts, totalBets }) => {
      setGameState(prev => ({ ...prev, betCounts, totalBets }));
    });

    return () => {
      socket.emit(`${prefix}:leave`);
      socket.off(`${prefix}:state`);
      socket.off(`${prefix}:new_round`);
      socket.off(`${prefix}:tick`);
      socket.off(`${prefix}:locked`);
      socket.off(`${prefix}:revealing`);
      socket.off(`${prefix}:result`);
      socket.off(`${prefix}:bets_count`);
    };
  }, [socket, gameId, user]);

  const placeBet = useCallback((betChoice) => {
    if (!socket || !user) return toast.error('Please login first');
    const choice = betChoice || selectedBet;
    if (!choice) return toast.error('Select a bet option');

    socket.emit(`live:${gameId}:place_bet`, { bet: choice, amount: stake }, (res) => {
      if (res?.error) return toast.error(res.error);
      setHasBet(true);
      hasBetRef.current = true;
      setMyBets(prev => [...prev, { choice, amount: stake }]);
      setSelectedBet(choice);
      setMyBetChoice(choice);
      toast.success(`Bet ${formatCurrency(stake)} on ${choice}`);
    });
  }, [socket, user, selectedBet, stake, gameId]);

  return {
    gameState,
    roundResult,
    selectedBet,
    setSelectedBet,
    stake,
    setStake,
    hasBet,
    myBets,
    myBetChoice,
    placeBet,
    isMyWin,
    myPayout,
  };
}
