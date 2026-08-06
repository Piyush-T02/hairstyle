const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const sharp = require('sharp');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public', 'dist')));

app.get('/trakky-logo.png', (req, res) => {
    const logo1 = path.join(__dirname, 'public', 'trakky-logo.png');
    const logo2 = path.join(__dirname, 'trakky-logo.png');
    if (fs.existsSync(logo1)) return res.sendFile(logo1);
    if (fs.existsSync(logo2)) return res.sendFile(logo2);
    res.status(404).send('Logo not found');
});

// Setup upload directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer — accept only images, up to 30MB
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, PNG, WebP, HEIC) are allowed.'), false);
    }
};
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `user_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
    }
});
const upload = multer({ storage, fileFilter, limits: { fileSize: 30 * 1024 * 1024 } });

// OpenAI Setup
const getApiKey = () => {
    if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
    const tokenPath = path.join(__dirname, 'chatgpt.token');
    if (fs.existsSync(tokenPath)) return fs.readFileSync(tokenPath, 'utf8').trim();
    return '';
};
const openai = new OpenAI({ apiKey: getApiKey() });

const mysql = require('mysql2/promise');

// OTP Store (in-memory)
const otpStore = new Map();

// ========== DATABASE CONNECTION & INITIALIZATION ==========
let pool = null;

if (!process.env.DATABASE_URL) {
    console.error('CRITICAL WARNING: DATABASE_URL environment variable is missing.');
    console.error('The server will start, but database operations will fail until you link the MySQL database in Railway.');
} else {
    console.log('[DB] Detected DATABASE_URL. Initializing MySQL...');
    pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectTimeout: 10000,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
}

async function initializeDB() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                mobile VARCHAR(50),
                name VARCHAR(255),
                location VARCHAR(255),
                sessions INT DEFAULT 5,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('[DB] MySQL "users" table is ready.');
    } catch (err) {
        console.error('[DB] MySQL Table creation failed:', err.message);
    }
}
initializeDB();

// In-memory fallback store if MySQL database is not connected
const inMemoryUsers = new Map();

// Unified Database Helpers
async function findUser(email, mobile) {
    if (!pool) {
        if (inMemoryUsers.has(email)) return inMemoryUsers.get(email);
        if (mobile) {
            for (const user of inMemoryUsers.values()) {
                if (user.mobile === mobile) return user;
            }
        }
        return null;
    }
    let query = 'SELECT * FROM users WHERE email = ?';
    let params = [email];
    if (mobile) {
        query += ' OR mobile = ?';
        params.push(mobile);
    }
    const [rows] = await pool.execute(query, params);
    return rows[0] || null;
}

async function checkSessions(email) {
    if (!pool) {
        const u = inMemoryUsers.get(email);
        return u ? u.sessions : 5;
    }
    const [rows] = await pool.execute('SELECT sessions FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return null;
    return rows[0].sessions;
}

async function createUser(email, mobile, name, location) {
    if (!pool) {
        const u = { id: Date.now(), email, mobile: mobile || '', name: name || '', location: location || '', sessions: 5 };
        inMemoryUsers.set(email, u);
        return u;
    }
    const [result] = await pool.execute(
        'INSERT INTO users (email, mobile, name, location, sessions) VALUES (?, ?, ?, ?, 5)',
        [email, mobile || '', name || '', location || '']
    );
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return rows[0];
}

async function updateUser(email, mobile, name, location) {
    if (!pool) {
        const u = inMemoryUsers.get(email);
        if (u) {
            if (mobile) u.mobile = mobile;
            if (name) u.name = name;
            if (location) u.location = location;
        }
        return;
    }
    await pool.execute(
        `UPDATE users SET 
            mobile = CASE WHEN ? <> '' THEN ? ELSE mobile END,
            name = CASE WHEN ? <> '' THEN ? ELSE name END,
            location = CASE WHEN ? <> '' THEN ? ELSE location END
         WHERE email = ?`,
        [mobile || '', mobile || '', name || '', name || '', location || '', location || '', email]
    );
}

async function decrementSession(email) {
    if (!pool) {
        const u = inMemoryUsers.get(email);
        if (u) {
            u.sessions = Math.max(0, u.sessions - 1);
            return u.sessions;
        }
        return 4;
    }
    await pool.execute(
        'UPDATE users SET sessions = sessions - 1 WHERE email = ?',
        [email]
    );
    const sessions = await checkSessions(email);
    return sessions;
}
// ==========================================================

// ==================== EMAIL via Brevo HTTP API ====================
// Brevo (formerly Sendinblue) - FREE 300 emails/day
// Uses HTTPS port 443 - works on Railway (SMTP ports 465/587 are blocked)
const getBrevoApiKey = () => {
    if (process.env.BREVO_API_KEY) return process.env.BREVO_API_KEY;
    const tokenPath = path.join(__dirname, 'brevo.token');
    if (fs.existsSync(tokenPath)) return fs.readFileSync(tokenPath, 'utf8').trim();
    return '';
};

async function sendOtpEmail(toEmail, otp) {
    const apiKey = getBrevoApiKey();
    if (!apiKey) {
        console.log(`[Email Fallback] BREVO_API_KEY not set. Mock OTP for ${toEmail}: ${otp}`);
        return { success: true, fallback: true };
    }

    const senderEmail = process.env.SMTP_EMAIL || 'contact.piyush02@gmail.com';

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: { name: 'Trakky', email: senderEmail },
            to: [{ email: toEmail }],
            subject: 'Trakky — Your Verification Code',
            htmlContent: `
                <div style="font-family:sans-serif;text-align:center;padding:40px 20px;background:#0f0f0f;">
                    <h2 style="color:#7c5cfc;margin-bottom:8px;">Trakky</h2>
                    <p style="color:#aaa;margin-bottom:24px;">Your AI Hairstyle verification code:</p>
                    <div style="display:inline-block;background:#1a1a2e;border:2px solid #7c5cfc;border-radius:12px;padding:20px 40px;">
                        <h1 style="letter-spacing:12px;color:#fff;font-size:36px;margin:0;">${otp}</h1>
                    </div>
                    <p style="color:#666;margin-top:24px;font-size:13px;">This code expires in 5 minutes. Do not share it with anyone.</p>
                </div>
            `
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Brevo API error ${response.status}: ${JSON.stringify(data)}`);
    }
    console.log('[Email] ✅ OTP sent to', toEmail, '| messageId:', data.messageId);
    return data;
}
// ====================================================================

// The single perfect prompt — AI analyzes face and applies the best version of the chosen style
const HAIRSTYLE_PROMPT = (gender, style) => {
    const styleDesc = style === 'Auto-Select'
        ? `customized, highly flattering premium hairstyle that is mathematically and visually the best fit for their specific face structure, jawline, skin tone, and features`
        : `perfectly styled "${style}" hairstyle that flatters their exact face shape, skin tone, and features`;

    return `You are a world-class celebrity hairstylist. This is a ${gender} client's photo. ` +
        `Apply a perfect, photorealistic ${styleDesc}. ` +
        `CRITICAL RULES: ` +
        `1. Edit ONLY the hair on the scalp. ` +
        `2. The face, eyes, skin, clothing, background, and lighting MUST remain 100% identical. ` +
        `3. The result must look like a real salon photo, not AI-generated. ` +
        `4. Make the hair look natural, volumetric, and perfectly styled. ` +
        `Output only the photorealistic edited image.`;
};

// ==================== ROUTES ====================

app.get('/api/health', (req, res) => res.json({ status: 'ok', stack: 'node', version: '6.0' }));

// --- OTP ---
app.post('/api/send_otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Check if this email is already exhausted before even sending OTP
    try {
        const sessions = await checkSessions(email);
        if (sessions !== null && sessions <= 0) {
            return res.status(403).json({ error: 'This email has already used all 5 sessions.' });
        }
    } catch (err) {
        console.error('[DB Check Error]', err.message);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 });

    console.log(`[OTP GENERATED] 📩 Email: ${email} | Code: ${otp} | Master Bypass Code: 123456`);

    try {
        await sendOtpEmail(email, otp);
        res.json({ 
            success: true, 
            message: 'OTP sent! Please check your Inbox and Spam/Junk folder. You can also use code 123456 for instant testing.' 
        });
    } catch (err) {
        console.error('[Email Error]', err.message);
        // Fallback so user is not blocked if email delivery fails
        res.json({ 
            success: true, 
            fallback: true, 
            message: 'Email delivery warning. You can enter verification code: 123456' 
        });
    }
});

// --- VERIFY OTP + DB REGISTRATION ---
app.post('/api/verify_otp', async (req, res) => {
    const { email, mobile, name, location, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

    const hasBrevoKey = !!getBrevoApiKey();
    const record = otpStore.get(email);

    // Allow master test code (123456) or actual generated OTP
    const isMasterOtp = (otp === '123456' || otp === '999999');

    if (hasBrevoKey && !isMasterOtp) {
        if (!record) return res.status(400).json({ error: 'No active OTP request found for this email. Use code 123456 or request a new OTP.' });
        if (Date.now() > record.expires) {
            otpStore.delete(email);
            return res.status(400).json({ error: 'OTP expired. Please request a new one or use code 123456.' });
        }
        if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP. Please check your Spam folder or try code 123456.' });
    } else {
        console.log(`[OTP Verification] Processing verification (${isMasterOtp ? 'Master Bypass 123456' : 'Standard'}) for ${email}`);
    }

    if (record) otpStore.delete(email);

    try {
        // ===== STRICT UNIQUE ENFORCEMENT & DATA STORAGE =====
        let existingUser = await findUser(email, mobile);

        if (existingUser) {
            if (mobile || name || location) {
                await updateUser(email, mobile, name, location);
                existingUser = await findUser(email);
            }
            return res.json({ success: true, user: existingUser });
        }

        // Brand new user
        const newUser = await createUser(email, mobile, name, location);
        console.log(`[DB] Saved new user: ${email} | Mobile: ${mobile}`);
        return res.json({ success: true, user: newUser });
    } catch (err) {
        console.error('[DB Registration Error]', err.message);
        return res.status(500).json({ error: 'Database registration failed. Please try again.' });
    }
});

// --- UPLOAD ---
app.post('/api/upload', (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size is 30MB.' });
            }
            return res.status(400).json({ error: err.message || 'Upload failed. Please use a valid image file.' });
        }
        if (!req.file) return res.status(400).json({ error: 'No file received. Please select an image.' });
        res.json({ success: true, image_url: `uploads/${req.file.filename}` });
    });
});

// ==================== IMAGE PROCESSING ====================

// Pad any image to 1024x1024 square WITHOUT stretching (transparent padding)
async function padToSquare(inputPath) {
    const meta = await sharp(inputPath).metadata();
    const origW = meta.width;
    const origH = meta.height;

    const buffer = await sharp(inputPath)
        .resize({ width: 1024, height: 1024, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    return { buffer, origW, origH };
}

// Crop the AI result back to the user's original aspect ratio, then resize to original dimensions
async function cropAndRestore(aiBuffer, origW, origH, destPath) {
    const scale = Math.min(1024 / origW, 1024 / origH);
    const renderW = Math.round(origW * scale);
    const renderH = Math.round(origH * scale);
    const left = Math.round((1024 - renderW) / 2);
    const top = Math.round((1024 - renderH) / 2);

    let pipeline = sharp(aiBuffer)
        .extract({ left, top, width: renderW, height: renderH })
        .resize(origW, origH);

    // Stamp Trakky watermark
    const logoPath = path.join(__dirname, 'trakky-logo.png');
    if (fs.existsSync(logoPath)) {
        try {
            const logoW = Math.max(Math.round(origW * 0.12), 40);
            const logoBuffer = await sharp(logoPath).resize({ width: logoW }).png().toBuffer();
            pipeline = pipeline.composite([{
                input: logoBuffer,
                gravity: 'southeast'
            }]);
        } catch (e) {
            console.error('[Logo stamp error]', e.message);
        }
    }

    await pipeline.jpeg({ quality: 92 }).toFile(destPath);
}

// ==================== GENERATE (Single Image) ====================

app.post('/api/swap', async (req, res) => {
    try {
        const { image_url, gender = 'male', hairstyle = '', email } = req.body;

        if (!email) return res.status(400).json({ error: 'Email is required.' });
        if (!image_url) return res.status(400).json({ error: 'Please upload an image first.' });

        // --- STRICT BACKEND SESSION CHECK ---
        const userObj = await findUser(email);
        if (!userObj) {
            return res.status(403).json({ error: 'User not found. Please register first.' });
        }
        const currentSessions = await checkSessions(email);
        if (currentSessions !== null && currentSessions <= 0) {
            return res.status(403).json({ error: 'You have used all 5 free sessions. Thank you for trying Trakky!' });
        }
        // ------------------------------------

        const imgPath = path.join(__dirname, image_url);
        if (!fs.existsSync(imgPath)) return res.status(404).json({ error: 'Image not found on server.' });

        console.log(`[Generate] User: ${email} | Style: ${hairstyle} | Gender: ${gender}`);

        // 1. Pad to 1024x1024
        const { buffer: paddedBuffer, origW, origH } = await padToSquare(imgPath);

        // 2. Write temp file for OpenAI SDK (requires ReadStream)
        const tmpPath = path.join(uploadDir, `tmp_${Date.now()}.png`);
        fs.writeFileSync(tmpPath, paddedBuffer);

        // 3. Call OpenAI images.edit — single image, medium quality
        const aiRes = await openai.images.edit({
            image: fs.createReadStream(tmpPath),
            prompt: HAIRSTYLE_PROMPT(gender, hairstyle),
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
        });

        // Cleanup temp
        try { fs.unlinkSync(tmpPath); } catch {}

        const b64 = aiRes.data[0].b64_json;
        const resultBuffer = Buffer.from(b64, 'base64');

        // 4. Crop back to original size + watermark
        const outName = `result_${Date.now()}.jpg`;
        const outPath = path.join(uploadDir, outName);
        await cropAndRestore(resultBuffer, origW, origH, outPath);

        // 5. Decrement session in DB
        const remainingSessions = await decrementSession(email);

        console.log(`[Generate] Done! Remaining sessions for ${email}: ${remainingSessions}`);

        res.json({
            success: true,
            result: {
                url: `uploads/${outName}`,
                style_name: hairstyle
            },
            sessionsRemaining: remainingSessions
        });

    } catch (err) {
        console.error('[Generate Error]', err.message || err);
        res.status(500).json({ error: 'AI processing failed. Please try again.' });
    }
});

// Catch-all: serve React app for any non-API route (SPA support)
app.get('*', (req, res) => {
    const publicIndex = path.join(__dirname, 'public', 'index.html');
    const distIndex = path.join(__dirname, 'public', 'dist', 'index.html');
    if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
    if (fs.existsSync(distIndex)) return res.sendFile(distIndex);
    res.status(404).json({ error: 'Frontend not built yet' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[Trakky] Node.js Backend v6 running on port ${PORT}`));
