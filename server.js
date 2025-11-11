require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = '1h';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const poolUsers = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: 'users',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const poolProducts = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: 'products',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

poolUsers.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error connecting to USERS database:', err.stack);
  }
  console.log('✅ Connected to database: users');
  release();
});

poolProducts.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error connecting to PRODUCTS database:', err.stack);
  }
  console.log('✅ Connected to database: products');
  release();
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

app.get('/api/users', async (req, res) => {
  try {
    const result = await poolUsers.query('SELECT * FROM users ORDER BY id');
    res.json({
      success: true,
      database: 'users',
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('❌ Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: err.message
    });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await poolUsers.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      database: 'users',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: err.message
    });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await poolProducts.query('SELECT * FROM products ORDER BY id');
    res.json({
      success: true,
      database: 'products',
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('❌ Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: err.message
    });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await poolProducts.query('SELECT * FROM products WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      database: 'products',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Database error:', err);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: err.message
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt for email:', email);
    
    const result = await poolUsers.query(
      'SELECT id, full_name, nick_name, email, password FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    const tokenPayload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      nick_name: user.nick_name
    };
    
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    
    delete user.password;
    
    res.json({
      success: true,
      message: 'Login successful',
      user: user,
      token: token,
      expiresIn: JWT_EXPIRES_IN
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({
      success: false,
      error: 'Login error',
      message: err.message
    });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { full_name, nick_name, email, password, phone, address, birthday } = req.body;
    
    console.log('Register attempt for email:', email);
    
    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Full name, email, and password are required'
      });
    }
    
    const checkEmail = await poolUsers.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    console.log('Password hashed successfully');
    
    const result = await poolUsers.query(
      `INSERT INTO users (full_name, nick_name, email, password, phone, address, birthday) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, full_name, nick_name, email`,
      [full_name, nick_name, email, hashedPassword, phone, address, birthday || null]
    );
    
    console.log('User registered successfully:', result.rows[0].email);
    
    res.json({
      success: true,
      message: 'Registration successful',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Register error:', err);
    res.status(500).json({
      success: false,
      error: 'Registration error',
      message: err.message
    });
  }
});

app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
});

app.post('/api/admin/hash-passwords', async (req, res) => {
  try {
    const { adminKey } = req.body;
    
    if (process.env.ADMIN_KEY && adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    const users = await poolUsers.query('SELECT id, email, password FROM users');
    
    let updated = 0;
    for (const user of users.rows) {
      if (!user.password.startsWith('$2b$')) {
        const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
        await poolUsers.query(
          'UPDATE users SET password = $1 WHERE id = $2',
          [hashedPassword, user.id]
        );
        updated++;
        console.log(`✅ Hashed password for user: ${user.email}`);
      }
    }
    
    res.json({
      success: true,
      message: `Successfully hashed ${updated} passwords`,
      total: users.rows.length
    });
  } catch (err) {
    console.error('❌ Hash passwords error:', err);
    res.status(500).json({
      success: false,
      error: 'Hash passwords error',
      message: err.message
    });
  }
});

app.get('/api', (req, res) => {
  res.json({
    message: 'PostgreSQL API Server - Multi Database (JWT Secured)',
    status: 'running',
    security: 'JWT authentication with 1 hour expiration',
    databases: {
      users: 'Connected',
      products: 'Connected'
    },
    endpoints: {
      home: '/',
      api: '/api',
      allUsers: '/api/users',
      userById: '/api/users/:id',
      allProducts: '/api/products',
      productById: '/api/products/:id',
      login: 'POST /api/login',
      register: 'POST /api/register',
      verifyToken: 'GET /api/verify-token'
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log('🔒 Security: JWT authentication with 1 hour token expiration');
  console.log('📁 Serving static files from public directory');
  console.log('\n📡 Available API endpoints:');
  console.log(`   - GET  http://localhost:${port}/api/users`);
  console.log(`   - GET  http://localhost:${port}/api/users/:id`);
  console.log(`   - GET  http://localhost:${port}/api/products`);
  console.log(`   - GET  http://localhost:${port}/api/products/:id`);
  console.log(`   - POST http://localhost:${port}/api/login (returns JWT)`);
  console.log(`   - POST http://localhost:${port}/api/register`);
  console.log(`   - GET  http://localhost:${port}/api/verify-token (requires JWT)`);
  console.log(`\n🌐 Web Interface:`);
  console.log(`   - http://localhost:${port}`);
  console.log('\n⚠️  Install dependencies: npm install jsonwebtoken');
});