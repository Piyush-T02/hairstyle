# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**StrandAI** — an AI hairstyle try-on tool. User uploads a photo → AI analyzes the face → applies the best hairstyle → returns a single result. Face, background, and clothes must stay pixel-perfect identical; only the hair changes.

Reference quality target: `Gemini_Generated_Image_w02u0zw02u0zw02u.png` — this is what a perfect result looks like (original photo `WhatsApp Image 2026-06-21 at 5.38.33 PM.jpeg`).

## How to Run

StrandAI supports two backend engines. Run only one at a time (both use port 5000):

### Option 1: Vertex AI Imagen 3 Backend
```bash
# Terminal 1 — Python AI backend (port 5000)
cd /home/piyush/Downloads/hi
venv/bin/python3 app.py

# Terminal 2 — PHP frontend (port 8080)
php -S 0.0.0.0:8080 -t /home/piyush/Downloads/hi
```
*Or use `./start.sh` for one-click startup.*

### Option 2: OpenAI DALL-E 2 Backend
```bash
# Terminal 1 — Python OpenAI backend (port 5000)
cd /home/piyush/Downloads/hi
venv/bin/python3 app_openai.py

# Terminal 2 — PHP frontend (port 8080)
php -S 0.0.0.0:8080 -t /home/piyush/Downloads/hi
```
*Or use `./start_openai.sh` for one-click startup.*

Open in browser: `http://localhost:8080` (the UI will auto-detect which engine is running via `/api/health`).

## Architecture

Three-layer stack:

```
Browser (index.php)
  → PHP proxy (api.php)
    → Flask AI backend (app.py OR app_openai.py)
      → Vertex AI / OpenAI API
```

**`index.php`** — Full single-page app (Tailwind CSS, vanilla JS). Studio flow: upload → loading → result. Auto-detects active backend via `/api/health` and updates the top badge.

**`api.php`** — Thin PHP proxy. Actions: `upload`, `swap`, `health`. Proxies to whichever backend is running on `http://localhost:5000`.

**`app.py`** — Flask backend for Vertex AI. Runs `imagen-3.0-capability-001` with user provided reference mask.

**`app_openai.py`** — Flask backend for OpenAI. Reads token from `chatgpt.token` and performs DALL-E 2 inpainting by padding the image to square and using transparent alpha mask.

## Google Cloud / Auth (for Vertex AI)

- **Project ID**: `project-f2696ae8-2196-49db-8c2`
- **Model**: `imagen-3.0-capability-001` on Vertex AI (`us-central1`)
- **Auth**: Application Default Credentials at `~/.config/gcloud/application_default_credentials.json`

## OpenAI / Auth (for DALL-E 2)

- **Token**: Read from `chatgpt.token`
- **Model**: `dall-e-2` via `POST https://api.openai.com/v1/images/edits`

## Python Environment

All Python dependencies are in `venv/`. Run scripts with `venv/bin/python3`.
