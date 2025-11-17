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

// ========== USERS ENDPOINTS ==========

// Get all users
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

// Get user by ID
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

// Update user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nick_name, email, phone, address, birthday } = req.body;
    
    const result = await poolUsers.query(
      'UPDATE users SET nick_name = $1, email = $2, phone = $3, address = $4, birthday = $5 WHERE id = $6 RETURNING *',
      [nick_name, email, phone, address, birthday, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Update error:', err);
    res.status(500).json({
      success: false,
      error: 'Update error',
      message: err.message
    });
  }
});

// Delete user
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await poolUsers.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Delete error:', err);
    res.status(500).json({
      success: false,
      error: 'Delete error',
      message: err.message
    });
  }
});

// ========== PRODUCTS ENDPOINTS ==========

// Get all products
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

// Get product by ID
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

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { sku, item_name, category, brand, price, description, media } = req.body;
    
    if (!item_name || !price) {
      return res.status(400).json({
        success: false,
        error: 'Item name and price are required'
      });
    }
    
    const result = await poolProducts.query(
      `INSERT INTO products (sku, item_name, category, brand, price, description, media) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [sku, item_name, category, brand, price, description, media || null]
    );
    
    res.json({
      success: true,
      message: 'Product added successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Add product error:', err);
    res.status(500).json({
      success: false,
      error: 'Add product error',
      message: err.message
    });
  }
});

// Update product
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { sku, item_name, category, brand, price, description, media } = req.body;
    
    const result = await poolProducts.query(
      `UPDATE products 
       SET sku = $1, item_name = $2, category = $3, brand = $4, price = $5, description = $6, media = $7 
       WHERE id = $8 
       RETURNING *`,
      [sku, item_name, category, brand, price, description, media, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Update error:', err);
    res.status(500).json({
      success: false,
      error: 'Update error',
      message: err.message
    });
  }
});

// Delete product
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await poolProducts.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Delete error:', err);
    res.status(500).json({
      success: false,
      error: 'Delete error',
      message: err.message
    });
  }
});

// ========== AUTH ENDPOINTS ==========

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt for email:', email);
    
    const result = await poolUsers.query(
      'SELECT id, nick_name, email, password FROM users WHERE email = $1',
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
    const { nick_name, email, password } = req.body;
    
    console.log('Register attempt for email:', email);
    
    if (!nick_name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Nickname, email, and password are required'
      });
    }
    
    // Password strength validation
    const passwordStrength = checkPasswordStrength(password);
    if (passwordStrength.strength === 'weak') {
      return res.status(400).json({
        success: false,
        error: 'Password is too weak',
        details: passwordStrength.missing
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
      `INSERT INTO users (nick_name, email, password) 
       VALUES ($1, $2, $3) 
       RETURNING id, nick_name, email`,
      [nick_name, email, hashedPassword]
    );
    
    console.log('User registered successfully:', result.rows[0].email);
    
    res.json({
      success: true,
      message: 'Registration successful',
      user: result.rows[0],
      passwordStrength: passwordStrength.strength
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

// Password strength checker
function checkPasswordStrength(password) {
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const minLength = password.length >= 8;
  
  let strength = 0;
  const missing = [];
  
  if (hasUpperCase) strength++;
  else missing.push('uppercase letter');
  
  if (hasLowerCase) strength++;
  else missing.push('lowercase letter');
  
  if (hasNumber) strength++;
  else missing.push('number');
  
  if (hasSpecialChar) strength++;
  else missing.push('special character');
  
  if (minLength) strength++;
  else missing.push('minimum 8 characters');
  
  let level = 'weak';
  if (strength >= 5) level = 'high';
  else if (strength >= 3) level = 'medium';
  
  return {
    strength: level,
    score: strength,
    missing: missing
  };
}

app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
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
      users: {
        getAll: 'GET /api/users',
        getById: 'GET /api/users/:id',
        update: 'PUT /api/users/:id (requires token)',
        delete: 'DELETE /api/users/:id (requires token)'
      },
      products: {
        getAll: 'GET /api/products',
        getById: 'GET /api/products/:id',
        add: 'POST /api/products (requires token)',
        update: 'PUT /api/products/:id (requires token)',
        delete: 'DELETE /api/products/:id (requires token)'
      },
      auth: {
        login: 'POST /api/login',
        register: 'POST /api/register',
        verify: 'GET /api/verify-token'
      }
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});