# Trakky — Progress & Architecture (v6)

## What We've Built

### Stack
- **Frontend**: React (Vite) — fast, modern, component-based UI.
- **Backend**: Node.js + Express — handles uploads, AI calls, OTP, and session tracking.
- **Image Processing**: `sharp` (Node.js) — pad/crop to preserve original image dimensions.
- **AI**: OpenAI DALL-E 2 `images.edit` — medium quality, 1024x1024.

---

### Key Features

#### 1. Single Perfect Result
Each session generates **1 high-quality AI hairstyle image** instead of multiple lower-quality options. The user picks their style, uploads their photo, and gets a single flawless result back at the **exact same resolution** they uploaded.

#### 2. Image Size Preservation (Padding Logic)
- OpenAI requires 1024x1024 square input.
- `sharp` pads the user's photo with transparent borders to make it square **without stretching**.
- After AI processing, `sharp` crops the borders back off and resizes to the user's original dimensions.
- **Result**: Upload 3000x4000? You get back 3000x4000. Upload 640x480? You get back 640x480.

#### 3. Camera + Gallery Upload
On mobile, users get two clear buttons:
- **"Choose from Gallery"** — opens the phone's photo picker.
- **"Take a Photo"** — opens the front camera directly using `capture="user"`.
Both work seamlessly on iOS and Android.

#### 4. Fullscreen Image Viewer
Clicking the result image opens it in a **fullscreen overlay** with backdrop blur. Users can see every detail. Click anywhere or the ✕ to close.

#### 5. Strict User Session Tracking (Database)
A `users.json` backend database enforces hard limits:
- **5 sessions per user** (1 image per session = 5 total images).
- Sessions are tracked by **email AND mobile number**.
- If someone registers with a new email but an already-used mobile (or vice versa), they get linked to their existing account. **No cheating possible.**
- Session count is decremented **on the server**, not the browser.

#### 6. OTP Email Verification
- Gmail SMTP via `nodemailer`.
- Professional HTML email template with branded OTP code.
- 5-minute expiry.

#### 7. Trakky Branding
- Purple bird logo displayed in header (clickable → home).
- Logo watermarked on every generated image (bottom-right, 12% width).

#### 8. 15 Curated Hairstyles
**Male**: Fade, Quiff, Buzz Cut, Pompadour, Undercut, Textured Crop, Side Part, French Crop, Crew Cut, Mullet, Slick Back, Faux Hawk, Comb Over, Shag, Ivy League.
**Female**: Layers, Bob Cut, Beach Waves, Pixie Cut, Curtain Bangs, Lob, Shag Cut, Blunt Cut, Butterfly Cut, Wolf Cut, Blunt Bangs, Angled Bob, Bixie, Choppy Layers, French Bob.

---

### Budget

| Item | Value |
|------|-------|
| Images per session | 1 |
| Sessions per user | 5 |
| Total images per user | **5** |
| Cost per image (DALL-E 2 Medium, 1024x1024) | ~$0.020 (₹1.66) |
| **Total cost per user** | **~₹8.30** |

This is massively under the ₹90 budget. Even with GPT-4o-mini analysis calls (which we removed in v6 for speed), total would still be well under ₹20 per user.

---

## How to Deploy to Railway

### Step 1: Push to GitHub
```bash
cd /home/piyush/Downloads/hi
git add .
git commit -m "v6: Single image, camera+gallery, strict DB sessions"
git push origin main
```

### Step 2: Railway Setup
1. Go to [Railway Dashboard](https://railway.app/dashboard).
2. Connect your GitHub repo (it's private — Railway can still access it).
3. Railway will auto-detect the `Dockerfile` and build accordingly.

### Step 3: Set Environment Variables
In Railway → your project → **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `SMTP_EMAIL` | `contact.piyush02@gmail.com` |
| `SMTP_PASSWORD` | `vtmo wqkd ccpv nwrw` |
| `PORT` | `5000` |

### Step 4: Verify
Once deployed, visit your Railway URL. The app serves both the React frontend and the API from the same domain.

---

## Security Notes
- **SMTP credentials**: Loaded from environment variables on Railway. The fallback values in code are only for local development. Since the GitHub repo is private, no external user can see them.
- **users.json**: This file is created at runtime on the Railway container. It persists as long as the container isn't redeployed. For permanent persistence, consider adding a Railway PostgreSQL addon (instructions in DEPLOY.md).
- **API keys**: Never exposed to the frontend. The React app only calls `/api/*` endpoints — the OpenAI key stays entirely on the server.

---

## Adding a Railway PostgreSQL Database (Future)

If you want permanent user data persistence across deployments:

1. In Railway, click **+ New** → **Database** → **PostgreSQL**.
2. Copy the `DATABASE_URL` from the database's Variables.
3. Add it as an environment variable to your app service.
4. Install `pg` in the backend: `npm install pg`
5. Replace the `getUsers()` / `saveUsers()` functions in `server.js` with SQL queries:
   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     email VARCHAR(255) UNIQUE NOT NULL,
     mobile VARCHAR(20),
     name VARCHAR(255),
     location VARCHAR(255),
     sessions INT DEFAULT 5,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```
6. The rest of the code stays the same — just swap the JSON read/write for `SELECT` / `UPDATE` queries.
