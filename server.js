const express = require('express');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
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

// OTP Store (in-memory)
const otpStore = new Map();

// ========== USERS DATABASE (JSON file — easily migrated to Railway Postgres) ==========
const DB_PATH = path.join(__dirname, 'users.json');
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));

function getUsers() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
    catch { return []; }
}
function saveUsers(users) {
    fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}
// ======================================================================================

// Nodemailer Setup
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_EMAIL || 'contact.piyush02@gmail.com',
        pass: process.env.SMTP_PASSWORD || 'vtmo wqkd ccpv nwrw'
    }
});

// The single perfect prompt — AI analyzes face and applies the best version of the chosen style
const HAIRSTYLE_PROMPT = (gender, style) =>
    `You are a world-class celebrity hairstylist. This is a ${gender} client's photo. ` +
    `Apply a perfect, photorealistic "${style}" hairstyle that flatters their exact face shape, skin tone, and features. ` +
    `CRITICAL RULES: ` +
    `1. Edit ONLY the hair on the scalp. ` +
    `2. The face, eyes, skin, clothing, background, and lighting MUST remain 100% identical. ` +
    `3. The result must look like a real salon photo, not AI-generated. ` +
    `4. Make the hair look natural, volumetric, and perfectly styled. ` +
    `Output only the photorealistic edited image.`;

// ==================== ROUTES ====================

app.get('/api/health', (req, res) => res.json({ status: 'ok', stack: 'node', version: '6.0' }));

// --- OTP ---
app.post('/api/send_otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Check if this email is already exhausted before even sending OTP
    const users = getUsers();
    const existing = users.find(u => u.email === email);
    if (existing && existing.sessions <= 0) {
        return res.status(403).json({ error: 'This email has already used all 5 sessions.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 });

    try {
        await transporter.sendMail({
            from: '"Trakky" <contact.piyush02@gmail.com>',
            to: email,
            subject: 'Trakky — Your Verification Code',
            html: `<div style="font-family:sans-serif;text-align:center;padding:40px 20px;">
                <h2 style="color:#7c5cfc;">Trakky</h2>
                <p>Your verification code is:</p>
                <h1 style="letter-spacing:8px;color:#7c5cfc;">${otp}</h1>
                <p style="color:#888;">This code expires in 5 minutes.</p>
            </div>`
        });
        res.json({ success: true });
    } catch (err) {
        console.error('[SMTP Error]', err.message);
        res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
});

// --- VERIFY OTP + DB REGISTRATION ---
app.post('/api/verify_otp', (req, res) => {
    const { email, mobile, name, location, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

    const record = otpStore.get(email);
    if (!record) return res.status(400).json({ error: 'No OTP was requested for this email.' });
    if (Date.now() > record.expires) {
        otpStore.delete(email);
        return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }
    if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP. Please check and try again.' });

    otpStore.delete(email);

    // ===== STRICT UNIQUE ENFORCEMENT =====
    let users = getUsers();

    // Check if email OR mobile already exists (prevents cheating by swapping one)
    let existingByEmail = users.find(u => u.email === email);
    let existingByMobile = mobile ? users.find(u => u.mobile === mobile) : null;

    if (existingByEmail) {
        // Same email — return their existing profile (even if mobile differs)
        return res.json({ success: true, user: existingByEmail });
    }
    if (existingByMobile) {
        // Different email but same mobile — block them to their existing account
        return res.json({ success: true, user: existingByMobile });
    }

    // Brand new user
    const newUser = {
        email,
        mobile: mobile || '',
        name: name || '',
        location: location || '',
        sessions: 5,
        createdAt: new Date().toISOString()
    };
    users.push(newUser);
    saveUsers(users);
    return res.json({ success: true, user: newUser });
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
        let users = getUsers();
        let userIndex = users.findIndex(u => u.email === email);
        // Also check by mobile if email not found (in case they registered with a different email)
        if (userIndex === -1) {
            return res.status(403).json({ error: 'User not found. Please register first.' });
        }
        if (users[userIndex].sessions <= 0) {
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
        users[userIndex].sessions -= 1;
        saveUsers(users);

        console.log(`[Generate] Done! Remaining sessions for ${email}: ${users[userIndex].sessions}`);

        res.json({
            success: true,
            result: {
                url: `uploads/${outName}`,
                style_name: hairstyle
            },
            sessionsRemaining: users[userIndex].sessions
        });

    } catch (err) {
        console.error('[Generate Error]', err.message || err);
        res.status(500).json({ error: 'AI processing failed. Please try again.' });
    }
});

// Catch-all: serve React app for any non-API route (SPA support)
app.get('*', (req, res) => {
    const publicIndex = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(publicIndex)) {
        res.sendFile(publicIndex);
    } else {
        res.status(404).json({ error: 'Frontend not built yet' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[Trakky] Node.js Backend v6 running on port ${PORT}`));
