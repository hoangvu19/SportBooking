require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server: IOServer } = require('socket.io');
const app = express();
const paymentRoutes = require('./routes/Payment/paymentRoutes');

// Fix: Increase header size limit to prevent "Request header is too large" error
const server = http.createServer({
  maxHeaderSize: 16384 // 16KB (default is 8KB)
}, app);
const path = require('path');
const fs = require('fs');
// VN timezone helper for server-side logs
let toVnIso = null;
try { toVnIso = require('./utils/vnTime').toVnIso; } catch (e) { console.debug('vnTime helper not available:', e && e.message); }
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('trust proxy', 1);
app.disable('x-powered-by');
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

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5000,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many failed login attempts, please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

app.use(generalLimiter);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
let performanceMonitor = null;
try {
  performanceMonitor = require('./middleware/performanceMonitor');
  app.use(performanceMonitor.trackRequest());
} catch (error) {
  // Performance monitoring not available
}
// Request logging disabled in production
if (process.env.NODE_ENV === 'development' && process.env.DEBUG_REQUESTS === 'true') {
  app.use((req, res, next) => {
    const ts = (typeof toVnIso === 'function') ? toVnIso() : new Date().toISOString();
    console.log(`${ts} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
  });
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Localization middleware: attach req.lang and req.t
try {
  const locale = require('./middleware/locale');
  app.use(locale);
} catch (e) {
  console.debug('Locale middleware not loaded:', e && e.message);
}

// Database status check
let dbStatus = 'disabled';
let poolPromise = null;

try {
  const { poolPromise: dbPool } = require('./config/db');
  poolPromise = dbPool;
  dbStatus = 'connecting';
  
  poolPromise.then(() => {
    dbStatus = 'connected';
    console.log('✅ Database connected');

    // Ensure Reports table exists (development convenience)
    try {
      const ReportModel = require('./models/Report/reportModel');
      ReportModel.createTable().then(() => {
        console.log('✅ Reports table verified/created');
      }).catch((createErr) => {
        console.error('❌ Failed to create/verify Reports table:', createErr && createErr.message ? createErr.message : createErr);
      });
    } catch (e) {
      console.debug('ReportModel createTable not available or failed to load:', e && e.message);
    }
  }).catch(err => {
    dbStatus = 'error';
    console.error('❌ Database error:', err.message);
  });
} catch (error) {
  dbStatus = 'disabled';
}

app.get('/', async (req, res) => {
  let dbTest = null;
  
  if (dbStatus === 'connected' && poolPromise) {
    try {
      const pool = await poolPromise;
      const dbQuery = pool.request().query('SELECT GETDATE() AS Now').then(r => r.recordset[0]);
      const timeout = new Promise(resolve => setTimeout(() => resolve({ error: 'timeout' }), 800));
      dbTest = await Promise.race([dbQuery, timeout]);
    } catch (err) {
      dbTest = { error: 'Database query failed' };
    }
  }
  
  const { toVnIso } = require('./utils/vnTime');
  res.json({
    success: true,
    message: 'Social Media Backend API is running',
    timestamp: toVnIso(),
    uptime: process.uptime(),
    database: {
      status: dbStatus,
      test: dbTest
    },
    performance: performanceMonitor ? 'active' : 'disabled',
    timezone: 'Asia/Ho_Chi_Minh'
  });
});


app.use('/api/auth', require('./routes/auth/authRoutes'));
app.use('/api/posts', require('./routes/social/postRoutes'));
app.use('/api/comments', require('./routes/social/commentRoutes'));
app.use('/api/messages', require('./routes/social/messageRoutes'));
app.use('/api/reactions', require('./routes/social/reactionRoutes'));
app.use('/api/shares', require('./routes/social/shareRoutes'));
app.use('/api/stories', require('./routes/social/storyRoutes'));
app.use('/api/notifications', require('./routes/social/notificationRoutes'));
app.use('/api/booking-posts', require('./routes/social/bookingPostRoutes'));
app.use('/api/debug', require('./routes/debug/debugRoutes'));
app.use('/api/users', require('./routes/social/followRoutes'));
app.use('/api/users', require('./routes/auth/userRoutes'));
app.use('/api/areas', require('./routes/sport/areaRoutes'));
app.use('/api/facilities', require('./routes/sport/facilityRoutes'));
app.use('/api/sport-fields', require('./routes/sport/sportFieldRoutes'));
app.use('/api/sport-types', require('./routes/sport/sportTypeRoutes'));
app.use('/api/bookings', require('./routes/sport/bookingRoutes'));
app.use('/api/customers', require('./routes/sport/customerRoutes'));

// 🤖 AI Routes (NEW)
app.use('/api/ai', require('./routes/ai/aiRoutes'));
app.use('/api/feedback', require('./routes/sport/feedbackRoutes')); 
app.use('/api/ratings', require('./routes/sport/ratingRoutes'));
app.use('/api/reports', require('./routes/report/reportRoutes'));
app.use('/api/roles', require('./routes/auth/roleRoutes'));
app.use('/api/livestreams', require('./routes/livestream/livestreamRoutes'));

// 👑 Admin Routes (NEW)
app.use('/api/admin/dashboard', require('./routes/admin/dashboardRoutes'));
app.use('/api/admin/bookings', require('./routes/admin/bookingAdminRoutes'));
app.use('/api/admin/accounts', require('./routes/admin/accountAdminRoutes'));
app.use('/api/admin/sports', require('./routes/admin/sportManagementRoutes'));

//Payment Routes
app.use('/api/payment', paymentRoutes);

app.get('/api/internal/file-exists', (req, res) => {
  try {
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

// Dev-only: scan Owner frontend pages for hard-coded strings and missing t(...) keys
app.post('/api/internal/scan-i18n', async (req, res) => {
  try {
    // only allow from localhost in dev
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ success: false, message: 'Not allowed in production' });
    const ownerDir = path.resolve(__dirname, '../frontend/src/pages/Owner');
    const files = [];
    const walk = (dir) => {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const it of items) {
          const p = path.join(dir, it.name);
          if (it.isDirectory()) walk(p);
          else if (/\.(js|jsx|ts|tsx)$/.test(it.name)) files.push(p);
        }
      } catch (e) {
        // ignore
      }
    };
    walk(ownerDir);

    const translationsPath = path.resolve(__dirname, '../frontend/src/i18n/translations.js');
    let translationsText = '';
    try { translationsText = fs.readFileSync(translationsPath, 'utf8'); } catch (e) { /* ignore */ }

    const hardStrings = [];
    const tKeys = new Set();
    const missingTKeys = new Set();

    const stringRegex = /(['`\"])((?:\\.|(?!\1).)*)\1/gms;
    const tRegex = /t\(\s*['"]([^'"\)]+)['"]\s*\)/g;

    for (const f of files) {
      try {
        const txt = fs.readFileSync(f, 'utf8');

        // collect t(...) keys
        let m;
        while ((m = tRegex.exec(txt))) {
          tKeys.add(m[1]);
          // check existence approximately
          if (!translationsText.includes(m[1])) missingTKeys.add(m[1]);
        }

        // find literal strings that likely contain non-ascii (Vietnamese) text
        while ((m = stringRegex.exec(txt))) {
          const lit = m[2];
          // skip obvious code-like literals
          if (!lit || lit.length > 300) continue;
          // heuristic: contains non-ascii letters (diacritics) or Vietnamese words
          if (/[\u00C0-\u024F\u1EA0-\u1EFF\u0100-\u017F]/u.test(lit) || /[ạáàảãấầậắằếềươđốộễ]/i.test(lit)) {
            // compute line number
            const upTo = txt.slice(0, m.index);
            const line = upTo.split('\n').length;
            hardStrings.push({ file: path.relative(process.cwd(), f), line, text: lit });
          }
        }
      } catch (e) {
        // ignore file read errors
      }
    }

    return res.json({ success: true, scannedFiles: files.length, hardStrings, tKeys: Array.from(tKeys), missingTKeys: Array.from(missingTKeys) });
  } catch (err) {
    console.error('scan-i18n error', err && err.message);
    return res.status(500).json({ success: false, message: 'Scan failed' });
  }
});

// 404 handler
app.use((req, res) => {
  const msg = (req.t && req.t('server.not_found_route', { route: req.originalUrl })) || `Route ${req.originalUrl} not found`;
  res.status(404).json({ success: false, message: msg });
});
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  const msg = (req && req.t) ? req.t('server.internal_error') : (error && error.message) || 'Internal error';
  res.status(500).json({ success: false, message: msg });
});
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
} catch (e) {
  // Signaling not available
}

// Initialize a general realtime namespace for app-level broadcasts (messages, posts, etc.)
try {
  const realtimeNs = io.of('/realtime');
  const realtimeEmitter = require('./lib/realtimeEmitter');
  realtimeEmitter.setNamespace(realtimeNs);

  realtimeNs.on('connection', (socket) => {
    console.log('Realtime: client connected', socket.id);

    // Authenticate the socket using JWT passed in handshake.auth.token
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';
      const AccountDAL = require('./DAL/Auth/accountDAL');

      const token = socket.handshake && socket.handshake.auth && socket.handshake.auth.token;
      if (!token) {
        console.log('Realtime: no token provided, disconnecting', socket.id);
        socket.disconnect(true);
        return;
      }

      let decoded;
      try {
        // token may be 'Bearer TOKEN' or raw token
        const raw = String(token || '').trim();
        const actual = raw.startsWith('Bearer ') ? raw.split(' ')[1] : raw;
        decoded = jwt.verify(actual, JWT_SECRET);
      } catch (e) {
        console.log('Realtime: token verify failed, disconnecting', socket.id);
        socket.disconnect(true);
        return;
      }

      // fetch user from DB to ensure account exists and is active
      (async () => {
        try {
          const accountId = decoded && (decoded.AccountID || decoded.userId || decoded.AccountId);
          if (!accountId) {
            console.log('Realtime: token missing AccountID, disconnecting', socket.id);
            socket.disconnect(true);
            return;
          }
          const user = await AccountDAL.getById(accountId);
          if (!user) {
            console.log('Realtime: account not found, disconnecting', socket.id);
            socket.disconnect(true);
            return;
          }
          // attach to socket and join personal room
          socket.data.userId = user.AccountID || user.userId || user._id;
          const room = `user:${String(socket.data.userId)}`;
          socket.join(room);
          console.log(`Realtime: socket ${socket.id} authenticated and joined ${room}`);
        } catch (err) {
          console.debug('Realtime auth flow error', err && err.message);
          try { socket.disconnect(true); } catch (err) { console.debug('socket.disconnect failed:', err); }
        }
      })();

      socket.on('disconnect', (reason) => {
        console.log('Realtime: client disconnected', socket.id, reason);
      });
    } catch (err) {
      console.debug('Realtime connection handler error', err && err.message);
  try { socket.disconnect(true); } catch (err) { console.debug('socket.disconnect failed:', err); }
    }
  });
} catch (e) {
  console.error('Realtime namespace init failed', e && e.message);
}

const port = process.env.PORT || 5000;
server.listen(port, () => {
  const ts = (typeof toVnIso === 'function') ? toVnIso() : new Date().toISOString().replace('Z', '+07:00');
  console.log(`${ts} - 🚀 Server running on http://localhost:${port}/`);
  try {
    const ScheduledJobs = require('./lib/scheduledJobs');
    ScheduledJobs.start();
  } catch (error) {
    // Scheduled jobs not available
  }
});

module.exports = server;