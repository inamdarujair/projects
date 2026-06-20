const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureSchema } = require('./database');
const apiRoutes = require('./routes');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));

// Auth-aware routes for entry points
const ADMIN_EMAIL = 'krishbhalerao9@gmail.com';

// Protect admin panel visibility
app.get('/admin.html', (req, res, next) => {
  const uid = req.session && req.session.userId;
  if (!uid) return res.redirect('/login.html');
  // Allow only the specified admin email
  const { getUserById } = require('./database');
  getUserById(uid).then(user => {
    if (user && user.email === ADMIN_EMAIL) {
      res.sendFile(path.join(__dirname, '../../public/admin.html'));
    } else {
      res.status(403).send('Forbidden');
    }
  }).catch(() => res.status(500).send('Auth error'));
});

// Redirect logged-in users away from auth pages
app.get(['/login.html','/signup.html'], (req, res, next) => {
  if (req.session && req.session.userId) return res.redirect('/');
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../public')));

// API routes
app.use('/api', apiRoutes);

// Root -> require login first
app.get('/', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Initialize database and start server
async function startServer() {
  try {
    // Ensure DB schema and seed exist on startup
    await ensureSchema();
    console.log('Database schema initialized successfully');
    
    // Simple health endpoint
    app.get('/health', (req, res) => {
      res.json({ ok: true, uptime: process.uptime() });
    });

    // Attempt to bind, retry on EADDRINUSE by incrementing port up to +10
    function listenWithRetry(startPort, maxAttempts = 10) {
      let attempt = 0;
      function tryListen(port) {
        const server = app.listen(port, () => {
          console.log(`🚀 AUTORIG server running at http://localhost:${port}`);
          console.log(`🎮 Main App: http://localhost:${port}`);
          console.log(`⚙️  Admin Panel: http://localhost:${port}/admin.html`);
          console.log(`💡 Suggestions: http://localhost:${port}/suggestions.html`);
        });
        server.on('error', (err) => {
          if (err && err.code === 'EADDRINUSE' && attempt < maxAttempts) {
            attempt += 1;
            const nextPort = startPort + attempt;
            console.warn(`Port ${port} in use. Retrying on ${nextPort} (attempt ${attempt}/${maxAttempts})...`);
            setTimeout(() => tryListen(nextPort), 300);
          } else {
            console.error('Failed to start server:', err);
            process.exit(1);
          }
        });
      }
      tryListen(startPort);
    }

    listenWithRetry(Number(PORT));
    // Global process error handlers (log and exit)
    process.on('uncaughtException', (e) => {
      console.error('Uncaught exception:', e);
    });
    process.on('unhandledRejection', (e) => {
      console.error('Unhandled rejection:', e);
    });
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
}

startServer();
