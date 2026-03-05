import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const db = new Database('standards.db');

// Create default admin user if none exists
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  console.log('Default admin user created: admin / admin123');
}

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Middleware to verify token
export const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Middleware to check admin role
export const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Auth routes
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// User Management
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users').all();
  res.json(users);
});

router.post('/users', authenticateToken, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    const info = stmt.run(username, hash, role || 'user');
    res.json({ id: info.lastInsertRowid, username, role });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { password, role } = req.body;
  const { id } = req.params;
  try {
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET password = ?, role = ? WHERE id = ?').run(hash, role, id);
    } else {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

// Settings Management
router.get('/settings', authenticateToken, requireAdmin, (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  res.json(settings);
});

router.post('/settings', authenticateToken, requireAdmin, (req, res) => {
  const { key, value } = req.body;
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?').run(key, value, value);
  res.json({ success: true });
});

// API Token Management
router.get('/tokens', authenticateToken, requireAdmin, (req, res) => {
  const tokens = db.prepare(`
    SELECT t.id, t.token, t.expires_at, t.created_at, u.username 
    FROM api_tokens t 
    JOIN users u ON t.user_id = u.id
  `).all();
  res.json(tokens);
});

router.post('/tokens', authenticateToken, requireAdmin, (req, res) => {
  const { user_id, expires_in_days } = req.body;
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (parseInt(expires_in_days) || 30));
  
  db.prepare('INSERT INTO api_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user_id, token, expiresAt.toISOString());
  res.json({ token, expires_at: expiresAt.toISOString() });
});

router.delete('/tokens/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM api_tokens WHERE id = ?').run(id);
  res.json({ success: true });
});

// API Middleware for external users
export const authenticateApiToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'API token required' });

  const tokenRecord = db.prepare('SELECT * FROM api_tokens WHERE token = ?').get(token) as any;
  if (!tokenRecord) return res.status(401).json({ error: 'Invalid API token' });

  if (new Date(tokenRecord.expires_at) < new Date()) {
    return res.status(401).json({ error: 'API token expired' });
  }

  req.apiUser = tokenRecord.user_id;
  next();
};

export default router;
