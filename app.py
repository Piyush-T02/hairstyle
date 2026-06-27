"""
Strand — Backend API
--------------------
POST /api/swap            Hairstyle edit (gpt-image-2, ~₹1.3/image)
POST /api/color-analysis  Hair color recommendations (gpt-4o-mini vision, ~₹0.1)
GET  /api/health          Health check
"""

import base64
import os
import json
import traceback

import cv2
import numpy as np
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _get_api_key():
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        with open(os.path.join(BASE_DIR, 'chatgpt.token')) as f:
            key = f.read().strip()
    return key


# ── Hairstyle prompt (optimized, generalized) ────────────────────────────────

HAIRSTYLE_PROMPT = """You are an elite, high-end celebrity hairstylist. Your goal is to give this person the most attractive, flattering, and stylish haircut possible.
Analyze their face shape and features, and give them a premium, modern haircut that dramatically improves their appearance and suits them perfectly.
For men, favor clean, sharp fades or tapers on the sides with textured, voluminous tops (e.g., modern quiff, textured fringe, or classic taper) that frame the face perfectly.
For women, favor elegant, face-framing layers or modern voluminous cuts.

Edit ONLY the scalp hair to this perfect style.

Absolute rules:
• Face stays identical — eyes, nose, lips, eyebrows, skin, expression, age, ethnicity unchanged.
• Facial hair (beard/mustache/stubble) stays exactly as-is.
• Clothing, accessories, background, lighting, shadows, camera angle, crop — all unchanged.
• Do not beautify, smooth, retouch, or enhance anything except the hair.
• The hair must look incredibly natural and photorealistic.
• Output only the edited image."""


COLOR_ANALYSIS_PROMPT = """You are an expert hair colorist and personal color analyst. Analyze this person's photo and determine:

1. Their skin undertone (warm, cool, or neutral)
2. Their season type (e.g., Warm & Clear, Cool & Deep, etc.)
3. The 5 BEST hair colors that would flatter them most
4. The 5 hair colors they should AVOID
5. A brief explanation of WHY these colors work or don't

Return your analysis as valid JSON ONLY (no markdown, no code blocks) in this exact format:
{
  "undertone": "Warm",
  "season": "Warm & Clear",
  "best_colors": [
    {"name": "Rich Dark Brown", "hex": "#3B2314"},
    {"name": "Chocolate Brown", "hex": "#4A2C2A"},
    {"name": "Chestnut Brown", "hex": "#6B3A2E"},
    {"name": "Caramel Highlights", "hex": "#A0673D"},
    {"name": "Honey Brown Balayage", "hex": "#C48B3F"}
  ],
  "avoid_colors": [
    {"name": "Ash Blonde", "hex": "#B8A99A"},
    {"name": "Platinum Blonde", "hex": "#E5D9C9"},
    {"name": "Jet Black", "hex": "#0A0A0A"},
    {"name": "Ash Brown", "hex": "#7A6B5D"},
    {"name": "Cherry Red", "hex": "#9C1B30"}
  ],
  "why_best": "Warm tones enhance your natural glow and brighten your complexion. Rich, dimensional shades add depth and make your features stand out.",
  "why_avoid": "Cool-toned and ashy shades can wash out your warm complexion and make you look tired. Very dark solid colors can appear too harsh against your skin."
}"""


def decode_b64_to_bgr(b64):
    if ',' in b64:
        b64 = b64.split(',')[1]
    arr = np.frombuffer(base64.b64decode(b64), np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def bgr_to_b64_jpg(img, quality=92):
    _, buf = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return 'data:image/jpeg;base64,' + base64.b64encode(buf).decode()


def b64_from_file(path):
    """Read a file and return data URI base64."""
    import mimetypes
    mime = mimetypes.guess_type(path)[0] or 'image/jpeg'
    with open(path, 'rb') as f:
        return f'data:{mime};base64,' + base64.b64encode(f.read()).decode()


# ── Hairstyle swap (gpt-image-2, single API call, ~₹1.3) ─────────────────────

def swap_hairstyle(img_bgr, hairstyle=""):
    api_key = _get_api_key()

    prompt = HAIRSTYLE_PROMPT
    if hairstyle:
        prompt += f"\n\nOVERRIDE: Apply this specific hairstyle: {hairstyle}. All other rules still apply."

    # Resize to 1024x1024 (required by gpt-image-2 minimum pixel budget)
    img_1024 = cv2.resize(img_bgr, (1024, 1024), interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode('.png', img_1024)

    print("[Strand] Calling gpt-image-2 for hairstyle swap...")
    resp = requests.post(
        "https://api.openai.com/v1/images/edits",
        headers={"Authorization": f"Bearer {api_key}"},
        files={
            "image": ("photo.png", buf.tobytes(), "image/png"),
            "prompt": (None, prompt),
            "model": (None, "gpt-image-2"),
            "n": (None, "1"),
            "size": (None, "1024x1024"),
        },
        timeout=180,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"API error {resp.status_code}: {resp.text}")

    b64_data = resp.json()['data'][0]['b64_json']
    result_bytes = base64.b64decode(b64_data)
    result_img = cv2.imdecode(np.frombuffer(result_bytes, np.uint8), cv2.IMREAD_COLOR)

    print("[Strand] Hairstyle swap done.")
    return result_img


# ── Color analysis (gpt-4o-mini vision → text, ~₹0.1) ────────────────────────

def analyze_color(img_bgr):
    """Step 1: Use cheap text model to determine best hair color."""
    api_key = _get_api_key()

    img_small = cv2.resize(img_bgr, (256, 256), interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode('.jpg', img_small, [cv2.IMWRITE_JPEG_QUALITY, 70])
    img_b64 = base64.b64encode(buf).decode()

    print("[Strand] Step 1/2: Analyzing face with gpt-4o-mini...")
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
            "max_tokens": 600,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": COLOR_ANALYSIS_PROMPT},
                    {"type": "image_url", "image_url": {
                        "url": f"data:image/jpeg;base64,{img_b64}",
                        "detail": "low"
                    }}
                ]
            }]
        },
        timeout=30,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"API error {resp.status_code}: {resp.text}")

    text = resp.json()['choices'][0]['message']['content'].strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]

    analysis = json.loads(text.strip())
    print(f"[Strand] Best color identified: {analysis['best_colors'][0]['name']}")
    return analysis


def generate_color_tryon(img_bgr, best_color_name):
    """Step 2: Generate 1 image with the best hair color applied."""
    api_key = _get_api_key()

    prompt = (
        f"Change ONLY the hair color in this photo to {best_color_name}. "
        f"Keep the exact same hairstyle, length, and texture — just change the color. "
        f"The result must look like a natural, professionally done hair coloring.\n\n"
        f"Absolute rules:\n"
        f"• Face stays identical — eyes, nose, lips, eyebrows, skin, expression unchanged.\n"
        f"• Facial hair stays exactly as-is.\n"
        f"• Clothing, accessories, background, lighting — all unchanged.\n"
        f"• Do not change the hairstyle or hair length, only the color.\n"
        f"• Output only the edited image."
    )

    img_512 = cv2.resize(img_bgr, (512, 512), interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode('.png', img_512)

    print(f"[Strand] Step 2/2: Generating try-on with '{best_color_name}'...")
    resp = requests.post(
        "https://api.openai.com/v1/images/edits",
        headers={"Authorization": f"Bearer {api_key}"},
        files={
            "image": ("photo.png", buf.tobytes(), "image/png"),
            "prompt": (None, prompt),
            "model": (None, "gpt-image-2"),
            "n": (None, "1"),
            "size": (None, "512x512"),
        },
        timeout=180,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"API error {resp.status_code}: {resp.text}")

    b64_data = resp.json()['data'][0]['b64_json']
    result_bytes = base64.b64decode(b64_data)
    result_img = cv2.imdecode(np.frombuffer(result_bytes, np.uint8), cv2.IMREAD_COLOR)

    print("[Strand] Color try-on done.")
    return result_img


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/api/swap', methods=['POST'])
def swap():
    try:
        data = request.get_json(force=True)
        src_b64 = data.get('source_image', '')
        hairstyle = data.get('hairstyle', '') or ''

        if not src_b64:
            return jsonify({'error': 'No source image provided.'}), 400
        img = decode_b64_to_bgr(src_b64)
        if img is None:
            return jsonify({'error': 'Could not decode image.'}), 400

        result = swap_hairstyle(img, hairstyle)
        return jsonify({'result_url': bgr_to_b64_jpg(result)})
    except Exception:
        print(f"[Strand] ERROR:\n{traceback.format_exc()}")
        return jsonify({'error': 'Processing failed. Please try again.'}), 500


@app.route('/api/color', methods=['POST'])
def color():
    try:
        data = request.get_json(force=True)
        src_b64 = data.get('source_image', '')

        if not src_b64:
            return jsonify({'error': 'No source image provided.'}), 400
        img = decode_b64_to_bgr(src_b64)
        if img is None:
            return jsonify({'error': 'Could not decode image.'}), 400

        # Step 1: Analyze (cheap, ~₹0.10)
        analysis = analyze_color(img)

        # Step 2: Generate 1 try-on image with the #1 best color (~₹1.3)
        best_color = analysis['best_colors'][0]['name']
        result_img = generate_color_tryon(img, best_color)

        return jsonify({
            'color_analysis': analysis,
            'result_url': bgr_to_b64_jpg(result_img)
        })
    except Exception:
        print(f"[Strand] ERROR:\n{traceback.format_exc()}")
        return jsonify({'error': 'Analysis failed. Please try again.'}), 500


if __name__ == '__main__':
    print("[Strand] Backend ready — port 5000")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
