# 🚀 Trakky AI — Deployment & Architecture Guide (Django + React)

## Architecture Overview

- **Backend**: **Django REST Framework (Python 3.12)** (`trakky_backend/` & `api/`)
- **Frontend**: **React + Vite SPA** (`frontend/` built into `public/`)
- **Database**: **MySQL** (via `DATABASE_URL`, mapped to `users` table: `email`, `mobile`, `name`, `location`, `sessions`) with automatic **SQLite** fallback for local development.
- **AI Processing Engine**: **OpenAI DALL-E 2 / gpt-image-2** (`images.edit` 1024x1024)
- **Image Processing Pipeline**: **OpenCV** (Smart Face Crop & Letterbox Strip) + **Pillow** (Aspect-ratio square padding, scaling, and `trakky-logo.png` watermark)
- **Email Engine**: Brevo HTTP API for OTP verification emails
- **WSGI Production Server**: Gunicorn

---

## 🛠️ Local Development Setup

### 1. Run via Bash Script
```bash
./start.sh
```

### 2. Manual Run
```bash
# Activate virtual environment
source venv/bin/activate

# Apply Django migrations
python manage.py migrate

# Run Django development server
python manage.py runserver 0.0.0.0:5000
```

Access the application at `http://localhost:5000`.

---

## 🚢 Deployment to Railway

### 1. Build React Frontend Assets
```bash
cd frontend && npm run build && cp -r dist/* ../public/
```

### 2. Deploy to Railway via CLI
```bash
railway up -s desirable-courtesy --detach
```

---

## ⚙️ Environment Variables

Set these in your Railway environment variables:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for AI hairstyle generation |
| `BREVO_API_KEY` | Brevo HTTP API key for OTP email delivery |
| `DATABASE_URL` | MySQL connection URI (`mysql://user:pass@host:port/db`) |
| `SMTP_EMAIL` | Sender email address (default: `contact.piyush02@gmail.com`) |
| `PORT` | Provided automatically by Railway (default: 5000) |

---

## 📡 REST API Specifications

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health check (`{"status": "ok", "stack": "django"}`) |
| `POST` | `/api/register` | Register or retrieve user session record (`email`, `mobile`, `name`, `location`) |
| `POST` | `/api/send_otp` | Generate & dispatch OTP code to email |
| `POST` | `/api/verify_otp` | Verify OTP code (supports master bypass codes `123456` / `999999`) |
| `POST` | `/api/upload` | Multipart image upload (up to 30MB) |
| `POST` | `/api/swap` | AI hairstyle generation (`image_url`, `gender`, `hairstyle`, `email`) |
