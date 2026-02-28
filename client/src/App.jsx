import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import MainLayout from './components/layout/MainLayout';

// Pages
import HomePage from './pages/HomePage';
import SportPage from './pages/SportPage';
import CasinoPage from './pages/CasinoPage';
import SlotGamePage from './pages/SlotGamePage';
import RouletteGamePage from './pages/RouletteGamePage';
import BlackjackGamePage from './pages/BlackjackGamePage';
import PokerGamePage from './pages/PokerGamePage';
import CrashGamePage from './pages/CrashGamePage';
import ColorPredictionPage from './pages/ColorPredictionPage';
import MyBetsPage from './pages/MyBetsPage';
import WalletPage from './pages/WalletPage';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
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
          <MainLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/sports/:sportKey" element={<SportPage />} />
              <Route path="/casino" element={<CasinoPage />} />
              <Route path="/casino/slots" element={<SlotGamePage />} />
              <Route path="/casino/roulette" element={<RouletteGamePage />} />
              <Route path="/casino/blackjack" element={<BlackjackGamePage />} />
              <Route path="/casino/poker" element={<PokerGamePage />} />
              <Route path="/casino/crash" element={<CrashGamePage />} />
              <Route path="/casino/color-prediction" element={<ColorPredictionPage />} />
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/my-bets" element={<MyBetsPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </MainLayout>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}
