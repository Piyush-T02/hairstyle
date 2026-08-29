# Trakky AI — Hairstyle Transformation & Virtual Try-On

An AI-powered hairstyle transformation and virtual salon try-on web application. Users can upload a photo, select a desired hairstyle (or let AI auto-select the best fit based on facial structure), and receive photorealistic hairstyle edits while maintaining 100% facial identity, lighting, outfit, and background consistency.

---

## 🏗️ Tech Stack & Architecture

- **Frontend**: **React** (Vite SPA located in `frontend/`) with a responsive UI.
- **Backend**: **Django REST Framework** (Python 3 backend located in `api/` and `trakky_backend/`).
- **AI Engine**: OpenAI Image Editing (`gpt-image-2` / DALL-E 2 image edit API).
- **Computer Vision Pipeline**: OpenCV (smart face detection & auto-cropping) + PIL (aspect ratio preservation, 1024x1024 padding, restoration & watermarking).
- **Database**: Django ORM (SQLite / PostgreSQL compatible) for user session tracking.

---

## 🔑 Setting Up Your OpenAI API Key

To run the application and generate AI hairstyles, **you must configure your own OpenAI API key**:

### Option 1: Environment Variable (Recommended)
Create a `.env` file in the project root directory (or set environment variables in your hosting dashboard):

```env
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_OPENAI_API_KEY_HERE
```

### Option 2: Key File
Alternatively, create a text file named `chatgpt.token` in the root directory containing your OpenAI API key string:

```text
sk-proj-YOUR_ACTUAL_OPENAI_API_KEY_HERE
```

---

## 🔐 Authentication & Session Integration Note

> **Note for Client Development Team**:
> OTP generation and user verification flows are offloaded to your existing authentication infrastructure (SMS gateway / WhatsApp OTP / Auth service).
> 
> The `/api/register` endpoint registers user profiles, creates or retrieves user records, and returns the session state for the virtual salon try-on.

---

## ⚙️ How It Works

1. **User Registration & Entry**:
   - The user enters their profile details (Name, Email / Mobile number).
   - Registrations assign 5 initial free try-on sessions tracked in the database.

2. **Image Upload & Pre-Processing**:
   - The user uploads a photo (supports mobile gallery, camera capture, JPEG, PNG, WebP, and iOS HEIC formats).
   - **EXIF Normalization**: Fixes portrait/landscape orientation from mobile phone uploads.
   - **Smart Face Crop**: OpenCV detects facial landmarks to center and frame the face properly for best AI results.
   - **Aspect-Preserved Square Padding**: Pads the image to `1024x1024` without stretching or distorting aspect ratios.

3. **AI Hairstyle Generation**:
   - The backend sends the padded image and a strict identity-lock prompt to OpenAI's image edit API.
   - The prompt explicitly instructs the AI model to transform **only the scalp hair** while locking 100% of facial features, skin tone, expression, outfit, and background.

4. **Post-Processing & Restoration**:
   - The generated image is cropped back to original proportions.
   - A subtle branding watermark is applied and saved to the `uploads/` directory.
   - User's remaining session balance is updated and returned in the JSON response.

---

## 🚀 How to Run Locally

### Prerequisites
- Python 3.10+
- Node.js 18+ (for building React frontend)

### 1. Backend Setup (Django)

```bash
# Create and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Start Django server (runs on http://localhost:5000)
python manage.py runserver 0.0.0.0:5000
```

### 2. Frontend Setup (React)

```bash
# Navigate to frontend folder
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev

# Or build production bundle into frontend/dist
npm run build
```

---

## 🌐 Deployment Guidelines

### Running in Production
- The repository includes `railway_start.sh` for easy deployment on hosting platforms like Railway, Render, or AWS:
  ```bash
  python manage.py migrate
  gunicorn trakky_backend.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 120
  ```
- Ensure `OPENAI_API_KEY` is added to your production environment variables.

---

## 📡 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend status check |
| `POST` | `/api/register` | Register user profile & set free sessions |
| `POST` | `/api/upload` | Upload user photo |
| `POST` | `/api/swap` | Perform AI hairstyle transformation |
| `GET` | `/uploads/<file>` | Serve processed images |
