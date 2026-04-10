'use strict';

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const path       = require('path');
const jwt        = require('jsonwebtoken');

const db            = require('./services/database');
const serverManager = require('./services/serverManager');
const authRoutes    = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const serversRoutes  = require('./routes/servers');

const app    = express();
const server = http.createServer(app);

const IS_PROD = process.env.NODE_ENV === 'production';
const PORT    = parseInt(process.env.PORT || '8080', 10);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: IS_PROD ? {} : { origin: 'http://localhost:5173', methods: ['GET', 'POST'] }
});

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:']
    }
  }
}));
app.use(cors({ origin: IS_PROD ? false : 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Serve uploaded assets (logo, etc.) ───────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

// ─── Share services with routes ───────────────────────────────────────────────
app.set('io', io);
app.set('serverManager', serverManager);

// ─── Initialise database & server manager ─────────────────────────────────────
db.initialize();
serverManager.initialize(io);

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/servers',  serversRoutes);

// ─── Serve React SPA in production ────────────────────────────────────────────
if (IS_PROD) {
  const PUBLIC = path.join(__dirname, 'public');
  app.use(express.static(PUBLIC));
  app.get('*', (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
}

// ─── Socket.io authentication ─────────────────────────────────────────────────
io.use((socket, next) => {
  const token  = socket.handshake.auth?.token;
  const secret = db.getSetting('jwt_secret');
  if (!token || !secret) return next(new Error('Authentication required'));
  try {
    jwt.verify(token, secret);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  socket.on('join-console', (serverId) => socket.join(`server-${serverId}`));
  socket.on('leave-console', (serverId) => socket.leave(`server-${serverId}`));
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[GSM] Game Server Manager running → http://0.0.0.0:${PORT}`);
});
