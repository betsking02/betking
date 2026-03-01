require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const initDatabase = require('./database/init');
const errorHandler = require('./middleware/errorHandler');
const { setupSocket } = require('./socket/index');

// Initialize database
initDatabase();

const app = express();
const server = http.createServer(app);

// Production vs Development CORS
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = isProduction ? true : (process.env.CORS_ORIGIN || 'http://localhost:5173');

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sports', require('./routes/sports'));
app.use('/api/bets', require('./routes/bets'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/casino', require('./routes/casino'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'BetKing API', version: '1.0.0' });
});

// Email config test endpoint
app.get('/api/test-email', async (req, res) => {
  const { testEmailConfig } = require('./services/emailService');
  const result = await testEmailConfig();
  res.json(result);
});

// Serve static files in production
if (isProduction) {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

// Setup WebSocket
setupSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`BetKing server running on port ${PORT}`);
  if (!isProduction) {
    console.log(`API: http://localhost:${PORT}/api/health`);
  }
});
