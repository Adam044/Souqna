require('dotenv').config();
const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose(); // Critical for SQLite
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const app = express();

const dbPath = process.env.DATABASE_URL || './souqna.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
        process.exit(1); // Exit if we can't connect to the database
    }
    console.log('Connected to the database');
});

// Load .env FIRST (before any other code)
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Validate critical env variables
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET not set in .env');
  process.exit(1); // Crash immediately if missing
}

const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Image upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    console.log('Auth header:', authHeader);
    const token = authHeader && authHeader.split(' ')[1];
    console.log('Extracted token:', token);

    if (!token) {
        return res.status(401).json({ error: 'مطلوب مصادقة' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err);
            return res.status(403).json({ error: 'رمز الدخول غير صالح أو منتهي الصلاحية' });
        }
        req.user = user;
        next();
    });
}

// Token verification endpoint
app.get('/api/verify-token', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// Middleware to check if user is authenticated
function checkAuthenticated(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'غير مصرح بالدخول' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'رمز الدخول غير صالح' });
    }
}

// API Routes

// User Authentication
// Register endpoint
app.post('/api/register', async (req, res) => {
    const { name, email, phone, password, confirmPassword } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password || !confirmPassword) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    // Validate password match
    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'كلمة المرور وتأكيدها غير متطابقين' });
    }

    // Validate password length
    if (password.length < 6) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)',
            [name, email, phone, hashedPassword],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    if (err.message.includes('UNIQUE constraint failed: users.email')) {
                        return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
                    }
                    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
                }

                res.status(201).json({
                    success: true,
                    message: 'تم إنشاء الحساب بنجاح'
                });
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب' });
    }
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
        if (!user) return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });

        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });

            const { password: _, ...userData } = user;
            const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '24h' });

            res.json({
                success: true,
                user: userData,
                token
            });
        } catch (error) {
            res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
        }
    });
});

// /api/user endpoint
app.get('/api/user', authenticateToken, (req, res) => {
    console.log('User ID from token:', req.user.id);

    db.get(
        'SELECT id, name, email, phone, location, role, created_at FROM users WHERE id = ?',
        [req.user.id],
        (err, user) => {
            if (err) {
                console.error('DB error while getting user info:', err);
                return res.status(500).json({ error: 'حدث خطأ في قاعدة البيانات' });
            }
            if (!user) {
                console.warn('User not found in DB for ID:', req.user.id);
                return res.status(404).json({ error: 'المستخدم غير موجود' });
            }
            res.json(user);
        }
    );
});

// Get all products
app.get('/api/products', (req, res) => {
    let { search, category, location, minPrice, maxPrice } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    let params = [];

    if (search) {
        sql += ' AND (title LIKE ? OR description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
        const categories = category.split(',');
        sql += ` AND category_id IN (${categories.map(() => '?').join(',')})`;
        params.push(...categories);
    }
    if (location) {
        const locations = location.split(',');
        sql += ` AND location IN (${locations.map(() => '?').join(',')})`;
        params.push(...locations);
    }
    if (minPrice) {
        sql += ' AND price >= ?';
        params.push(minPrice);
    }
    if (maxPrice) {
        sql += ' AND price <= ?';
        params.push(maxPrice);
    }

    db.all(sql, params, (err, products) => {
        if (err) return res.status(500).json({ error: 'حدث خطأ أثناء جلب المنتجات' });
        res.json(products);
    });
});

app.get('/api/products/:id', (req, res) => {
    const { id } = req.params;
    
    db.get(
        'SELECT p.*, u.name as seller_name, u.phone as seller_phone, u.location as seller_location FROM products p JOIN users u ON p.seller_id = u.id WHERE p.id = ?',
        [id],
        (err, product) => {
            if (err) return res.status(500).json({ error: 'حدث خطأ أثناء جلب المنتج' });
            if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
            
            // Parse images from JSON string to array
            const formattedProduct = {
                ...product,
                images: JSON.parse(product.images)
            };
            
            res.json(formattedProduct);
        }
    );
});

app.post('/api/products', authenticateToken, upload.array('images', 5), (req, res) => {
    const { title, price, description, category } = req.body;
    const seller_id = req.user.id;
    
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'يجب رفع صورة واحدة على الأقل' });
    }
    
    const imagePaths = req.files.map(file => `/uploads/${file.filename}`);
    
    db.run(
        'INSERT INTO products (title, price, description, category_id, images, seller_id) VALUES (?, ?, ?, ?, ?, ?)',
        [title, price, description, category, JSON.stringify(imagePaths), seller_id],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'حدث خطأ أثناء إضافة المنتج' });
            }
            
            res.json({ 
                success: true,
                id: this.lastID,
                message: 'تم إضافة المنتج بنجاح'
            });
        }
    );
});

// /api/user/products endpoint
app.get('/api/user/products', authenticateToken, (req, res) => {
    console.log('Fetching products for user:', req.user.id);

    db.all(
        'SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC',
        [req.user.id],
        (err, products) => {
            if (err) {
                console.error('DB error while fetching user products:', err);
                return res.status(500).json({ error: 'حدث خطأ أثناء جلب المنتجات' });
            }

            try {
                const formattedProducts = products.map(product => ({
                    ...product,
                    images: JSON.parse(product.images)
                }));
                res.json(formattedProducts);
            } catch (jsonError) {
                console.error('JSON parse error in product images:', jsonError);
                return res.status(500).json({ error: 'خطأ في تنسيق صور المنتجات' });
            }
        }
    );
});

// Categories
app.get('/api/categories', (req, res) => {
    db.all('SELECT * FROM categories', (err, categories) => {
        if (err) return res.status(500).json({ error: 'حدث خطأ أثناء جلب الفئات' });
        
        // Map to match your frontend structure
        const formattedCategories = categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            icon: getCategoryIcon(cat.name)
        }));
        
        res.json(formattedCategories);
    });
});

function getCategoryIcon(categoryName) {
    const icons = {
        'Electronics': 'laptop',
        'Clothing': 'tshirt',
        'Home & Garden': 'home',
        'Books': 'book',
        'Toys': 'gamepad',
        'Beauty': 'spa',
        'Sports': 'futbol',
        'Groceries': 'shopping-basket'
    };
    return icons[categoryName] || 'tag';
}

// Protect the sell page endpoint
app.get('/sell', checkAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sell.html'));
});

// User stats endpoint
app.get('/api/user/stats', authenticateToken, (req, res) => {
    const userId = req.user.id;
    console.log('User stats requested for userId:', userId);

    db.get('SELECT COUNT(*) as count FROM products WHERE seller_id = ?', [userId], (err, products) => {
        if (err) {
            console.error('Stats DB error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        // Replace the hardcoded stats with real queries as needed
        res.json({
            products: products.count,
            views: 124,    // Replace with actual query
            messages: 3,   // Replace with actual query
            sales: 2       // Replace with actual query
        });
    });
});

// Update user info endpoint
app.put('/api/user', authenticateToken, (req, res) => {
    const { name, phone, location } = req.body;
    const userId = req.user.id;

    db.run(
        'UPDATE users SET name = ?, phone = ?, location = ? WHERE id = ?',
        [name, phone, location, userId],
        function(err) {
            if (err) {
                console.error('Error updating user:', err);
                return res.status(500).json({ error: 'حدث خطأ أثناء تحديث المعلومات' });
            }
            res.json({ success: true, message: 'تم تحديث المعلومات بنجاح' });
        }
    );
});

// Update product endpoint
app.put('/api/products/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, price, description } = req.body;
    const userId = req.user.id;

    // Verify the product belongs to the user
    db.get('SELECT seller_id FROM products WHERE id = ?', [id], (err, product) => {
        if (err) {
            console.error('Error verifying product owner:', err);
            return res.status(500).json({ error: 'حدث خطأ أثناء التحقق من المنتج' });
        }

        if (!product) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }

        if (product.seller_id !== userId) {
            return res.status(403).json({ error: 'غير مصرح لك بتحديث هذا المنتج' });
        }

        db.run(
            'UPDATE products SET title = ?, price = ?, description = ? WHERE id = ?',
            [title, price, description, id],
            function(err) {
                if (err) {
                    console.error('Error updating product:', err);
                    return res.status(500).json({ error: 'حدث خطأ أثناء تحديث المنتج' });
                }
                res.json({ success: true, message: 'تم تحديث المنتج بنجاح' });
            }
        );
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});