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

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes')); // NEW: User routes
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/stories', require('./routes/storyRoutes')); // NEW: Story routes
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/reactions', require('./routes/reactionRoutes'));
app.use('/api/shares', require('./routes/shareRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/facilities', require('./routes/facilityRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/areas', require('./routes/areaRoutes'));
app.use('/api/sport-types', require('./routes/sportTypeRoutes'));
app.use('/api/sport-fields', require('./routes/sportFieldRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
// Livestream feature
app.use('/api/livestreams', require('./routes/livestreamRoutes'));

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