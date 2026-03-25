import { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';

// Pages
import HomePage from './pages/HomePage';
import SportPage from './pages/SportPage';
import CasinoPage from './pages/CasinoPage';
import SlotGamePage from './pages/SlotGamePage';
import RouletteGamePage from './pages/RouletteGamePage';
import BlackjackGamePage from './pages/BlackjackGamePage';
import PokerGamePage from './pages/PokerGamePage';
import CrashGamePage from './pages/CrashGamePage';
import AviatorGamePage from './pages/AviatorGamePage';
import ColorPredictionPage from './pages/ColorPredictionPage';
import MinesGamePage from './pages/MinesGamePage';
import DiceRollGamePage from './pages/DiceRollGamePage';
import PlinkoGamePage from './pages/PlinkoGamePage';
import CoinFlipGamePage from './pages/CoinFlipGamePage';
import HiLoGamePage from './pages/HiLoGamePage';
import DragonTigerGamePage from './pages/DragonTigerGamePage';
import Lucky7GamePage from './pages/Lucky7GamePage';
import AndarBaharGamePage from './pages/AndarBaharGamePage';
import TowerGamePage from './pages/TowerGamePage';
import MyBetsPage from './pages/MyBetsPage';
import WalletPage from './pages/WalletPage';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import MatchDetailPage from './pages/MatchDetailPage';

function AppRoutes() {
  const { user, loading } = useContext(AuthContext);

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f1923',
        color: '#ffd700',
        fontSize: '24px',
        fontWeight: '700',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#9813;</div>
          <div>BetKing</div>
          <div style={{ fontSize: '14px', color: '#7a8a9e', marginTop: '8px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Not logged in - show login page
  if (!user) {
    return <LoginPage />;
  }

  // Logged in - show full app
  return (
    <SocketProvider>
      <Router>
        <MainLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/sports/:sportKey" element={<SportPage />} />
            <Route path="/match/:id" element={<MatchDetailPage />} />
            <Route path="/casino" element={<CasinoPage />} />
            <Route path="/casino/slots" element={<SlotGamePage />} />
            <Route path="/casino/roulette" element={<RouletteGamePage />} />
            <Route path="/casino/blackjack" element={<BlackjackGamePage />} />
            <Route path="/casino/poker" element={<PokerGamePage />} />
            <Route path="/casino/aviator" element={<AviatorGamePage />} />
            <Route path="/casino/crash" element={<CrashGamePage />} />
            <Route path="/casino/color-prediction" element={<ColorPredictionPage />} />
            <Route path="/casino/mines" element={<MinesGamePage />} />
            <Route path="/casino/dice" element={<DiceRollGamePage />} />
            <Route path="/casino/plinko" element={<PlinkoGamePage />} />
            <Route path="/casino/coinflip" element={<CoinFlipGamePage />} />
            <Route path="/casino/hilo" element={<HiLoGamePage />} />
            <Route path="/casino/dragontiger" element={<DragonTigerGamePage />} />
            <Route path="/casino/lucky7" element={<Lucky7GamePage />} />
            <Route path="/casino/andarbahar" element={<AndarBaharGamePage />} />
            <Route path="/casino/tower" element={<TowerGamePage />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/my-bets" element={<MyBetsPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </MainLayout>
      </Router>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a2c38',
            color: '#fff',
            border: '1px solid #2a3a4a',
          },
          success: { iconTheme: { primary: '#00e701', secondary: '#000' } },
          error: { iconTheme: { primary: '#ff4444', secondary: '#fff' } },
        }}
      />
      <AppRoutes />
    </AuthProvider>
  );
}
