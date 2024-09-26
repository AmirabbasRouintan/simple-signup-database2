const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(session({
    secret: 'your_session_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

let pool;

async function initializeDatabase() {
    try {
        pool = await mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Failed to create database pool:', error);
        process.exit(1);
    }
}

initializeDatabase();

app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ success: false, message: "Email already registered." });
        }

        // Storing password without hashing (for development only)
        await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, password]);
        res.json({ success: true, message: "User registered successfully!" });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, message: "An error occurred during signup." });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (rows.length > 0) {
            const user = rows[0];
            // Comparing passwords directly (for development only)
            if (password === user.password) {
                req.session.userId = user.id;
                req.session.email = user.email;
                res.json({ success: true, message: "Logged in successfully!" });
            } else {
                res.status(401).json({ success: false, message: "Incorrect password." });
            }
        } else {
            res.status(404).json({ success: false, message: "User not found." });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: "An error occurred during login." });
    }
});

app.get('/api/user', (req, res) => {
    if (req.session.userId) {
        res.json({ success: true, userId: req.session.userId, email: req.session.email });
    } else {
        res.status(401).json({ success: false, message: "Not authenticated" });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).json({ success: false, message: "Logout failed" });
        } else {
            res.json({ success: true, message: "Logged out successfully" });
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));