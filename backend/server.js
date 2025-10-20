/**
 * Social Media Backend Server - Fully Optimized with Working Auth
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server: IOServer } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Serve uploaded files statically
const path = require('path');
const fs = require('fs');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== PERFORMANCE & SECURITY SETUP ==========
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Enable compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    success: false,
    message: 'Quá nhiều requests từ IP này, vui lòng thử lại sau 15 phút'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau 15 phút'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

app.use(generalLimiter);

// CORS configuration - allow all localhost ports for development
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from localhost on any port or no origin (mobile apps, etc.)
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Performance monitoring
let performanceMonitor = null;
try {
  performanceMonitor = require('./middleware/performanceMonitor');
  app.use(performanceMonitor.trackRequest());
  console.log('✅ Performance monitoring loaded');
} catch (error) {
  console.log('⚠️ Performance monitoring not available:', error.message);
}

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
  });
}

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Database status check
let dbStatus = 'disabled';
let poolPromise = null;

try {
  const { poolPromise: dbPool } = require('./config/db');
  poolPromise = dbPool;
  dbStatus = 'connecting';
  
  poolPromise.then(() => {
    dbStatus = 'connected';
    console.log('✅ Database connected - SQL Server');
  }).catch(err => {
    dbStatus = 'error';
    console.error('❌ Database connection failed:', err.message);
  });
} catch (error) {
  dbStatus = 'disabled';
  console.log('⚠️ Database disabled - using mock data');
}

// Health check with enhanced info
app.get('/', async (req, res) => {
  let dbTest = null;
  
  if (dbStatus === 'connected' && poolPromise) {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query('SELECT GETDATE() AS Now');
      dbTest = result.recordset[0];
    } catch (err) {
      dbTest = { error: 'Database query failed' };
    }
  }
  
  res.json({
    success: true,
    message: 'Social Media Backend API đang hoạt động',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: dbStatus,
      test: dbTest
    },
    performance: performanceMonitor ? 'active' : 'disabled'
  });
});

// API Routes - grouped by feature
app.use('/api/auth', require('./routes/auth/authRoutes'));

// Social area
app.use('/api/posts', require('./routes/social/postRoutes'));
app.use('/api/comments', require('./routes/social/commentRoutes'));
app.use('/api/messages', require('./routes/social/messageRoutes'));
app.use('/api/reactions', require('./routes/social/reactionRoutes'));
app.use('/api/shares', require('./routes/social/shareRoutes'));
app.use('/api/stories', require('./routes/social/storyRoutes'));
app.use('/api/notifications', require('./routes/social/notificationRoutes'));

// Follow routes are mounted under /api/users to keep frontend compatibility
app.use('/api/users', require('./routes/social/followRoutes'));
app.use('/api/users', require('./routes/auth/userRoutes'));

// Sport / facility area
app.use('/api/areas', require('./routes/sport/areaRoutes'));
// Use the enhanced facility routes as the single source of truth
app.use('/api/facilities', require('./routes/sport/facilityRoutesNew'));
app.use('/api/sport-fields', require('./routes/sport/sportFieldRoutes'));
app.use('/api/sport-types', require('./routes/sport/sportTypeRoutes'));
app.use('/api/bookings', require('./routes/sport/bookingRoutes'));
app.use('/api/feedback', require('./routes/sport/feedbackRoutes'));

// Roles
app.use('/api/roles', require('./routes/auth/roleRoutes'));

// Share livestreams
app.use('/api/livestreams', require('./routes/livestream/livestreamRoutes'));

// Debug upload listing route removed to avoid accidental exposure of uploaded files.
// If you need a local debug listing, recreate a temporary route under a secure flag.
console.log('ℹ️ Debug upload routes removed from server build');

// Dev-only helper: check whether a file under /uploads exists and return JSON.
// This avoids the frontend having to issue HEAD requests that surface 404 network errors in the browser.
app.get('/api/internal/file-exists', (req, res) => {
  try {
    // query param 'path' should be path under uploads without leading '/uploads/' prefix, e.g. 'comments/abc.jpg'
    const p = String(req.query.path || '').trim();
    if (!p) return res.status(200).json({ success: true, exists: false });
    if (p.includes('..')) return res.status(400).json({ success: false, message: 'Invalid path' });

    const safeRelative = p.replace(/^\/+/, '');
    const full = path.join(__dirname, 'uploads', safeRelative);
    fs.access(full, fs.constants.R_OK, (err) => {
      if (err) return res.status(200).json({ success: true, exists: false });
      return res.status(200).json({ success: true, exists: true });
    });
  } catch (e) {
    console.error('file-exists error', e && e.message);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    success: false,
    message: error.message
  });
});

// Setup Socket.IO for WebRTC signaling
const io = new IOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || origin.startsWith('http://localhost:')) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST']
  }
});

try {
  const signaling = require('./lib/signaling');
  signaling.init(io);
  console.log('✅ Signaling initialized');
} catch (e) {
  console.warn('⚠️ Signaling module not available:', e.message);
}

const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log('🚀 Social Media Backend Server running on http://localhost:' + port);
  console.log('✅ All routes loaded - Database integration only');
  console.log('📝 Ready for database operations and real-time signaling');
});

module.exports = server;