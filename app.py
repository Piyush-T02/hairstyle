"""
Trekky — Backend API
--------------------
POST /api/swap            Hairstyle edit (gpt-image-2 edits, ~₹5/image)
POST /api/color           Hair color analysis + try-on
GET  /api/health          Health check

Cost target: ₹90 for 5 photos = ₹18/photo budget.
Actual cost per hairstyle: ~₹5.5 (gpt-4o-mini ~₹0.1 + gpt-image-2 ~₹5.4)
Actual cost per color:     ~₹5.6 (gpt-4o-mini ~₹0.1 × 2 + gpt-image-2 ~₹5.4)
Total 5 photos worst case: ~₹28 (well under ₹90 budget)
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
        token_path = os.path.join(BASE_DIR, 'chatgpt.token')
        if os.path.exists(token_path):
            with open(token_path) as f:
                key = f.read().strip()
    return key


# ── Prompts ───────────────────────────────────────────────────────────────────

FACE_HAIRSTYLE_ANALYSIS_PROMPT = """You are an elite hairstylist doing a haircut consultation.
The client is {gender}.

Look closely at this photo and assess:
• Face shape (oval / round / square / rectangle / heart / diamond / triangle)
• Forehead size and hairline
• Jawline definition and cheekbone prominence
• Current hair length, texture, and density

The client wants a {style_category} style. Using classic hairstyling principles — add
height/volume for round or short faces, add width or a fringe for long faces, soften
an angular jaw with layers, rebalance volume if the forehead/chin look imbalanced —
decide the ONE specific {style_category} haircut that would most flatter THIS SPECIFIC
face. Base it on what you actually see, not a default trendy cut.

Respond with ONLY a concise, specific hairstyle description (1-2 sentences) that
could be handed directly to a barber/stylist — no preamble, no explanation, no
markdown, no quotes.

Example output for male: Medium-length textured crop with a soft side-swept fringe and a
low taper fade, subtle volume at the crown to add height.
Example output for female: Shoulder-length layered cut with curtain bangs and
face-framing layers to soften the jawline."""

HAIRSTYLE_EXECUTE_PROMPT = """You are an elite, high-end hairstylist executing a haircut that has already been chosen for this specific {gender} client: {hairstyle}

Edit ONLY the scalp hair to this exact style.

Absolute rules:
• Face stays identical — eyes, nose, lips, eyebrows, skin, expression, age, ethnicity unchanged.
• Facial hair (beard/mustache/stubble) stays exactly as-is.
• Clothing, accessories, background, lighting, shadows, camera angle, crop — all unchanged.
• Do not beautify, smooth, retouch, or enhance anything except the hair.
• The hair must look incredibly natural and photorealistic, blending naturally with the hairline.
• Output only the edited image."""

HAIRSTYLE_FALLBACK_PROMPT = """You are an elite, high-end celebrity hairstylist. Analyze this {gender} person's face shape and give them a premium, modern haircut that suits them perfectly.
For men, favor clean, sharp fades or tapers with textured, voluminous tops that frame the face perfectly.
For women, favor elegant, face-framing layers or modern voluminous cuts.

Edit ONLY the scalp hair to this perfect style.

Absolute rules:
• Face stays identical — eyes, nose, lips, eyebrows, skin, expression, age, ethnicity unchanged.
• Facial hair (beard/mustache/stubble) stays exactly as-is.
• Clothing, accessories, background, lighting, shadows, camera angle, crop — all unchanged.
• Do not beautify, smooth, retouch, or enhance anything except the hair.
• The hair must look incredibly natural and photorealistic.
• Output only the edited image."""


COLOR_ANALYSIS_PROMPT = """You are an expert hair colorist and personal color analyst. This person is {gender}.
Analyze this person's photo and determine:

1. Their skin undertone (warm, cool, or neutral)
2. Their season type (e.g., Warm & Clear, Cool & Deep, etc.)
3. The 5 BEST hair colors that would flatter them most (appropriate for their gender)
4. The 5 hair colors they should AVOID
5. A brief explanation of WHY these colors work or don't

Return your analysis as valid JSON ONLY (no markdown, no code blocks) in this exact format:
{{
  "undertone": "Warm",
  "season": "Warm & Clear",
  "best_colors": [
    {{"name": "Rich Dark Brown", "hex": "#3B2314"}},
    {{"name": "Chocolate Brown", "hex": "#4A2C2A"}},
    {{"name": "Chestnut Brown", "hex": "#6B3A2E"}},
    {{"name": "Caramel Highlights", "hex": "#A0673D"}},
    {{"name": "Honey Brown Balayage", "hex": "#C48B3F"}}
  ],
  "avoid_colors": [
    {{"name": "Ash Blonde", "hex": "#B8A99A"}},
    {{"name": "Platinum Blonde", "hex": "#E5D9C9"}},
    {{"name": "Jet Black", "hex": "#0A0A0A"}},
    {{"name": "Ash Brown", "hex": "#7A6B5D"}},
    {{"name": "Cherry Red", "hex": "#9C1B30"}}
  ],
  "why_best": "Warm tones enhance your natural glow.",
  "why_avoid": "Cool-toned and ashy shades can wash out your warm complexion."
}}"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def decode_b64_to_bgr(b64):
    if ',' in b64:
        b64 = b64.split(',')[1]
    arr = np.frombuffer(base64.b64decode(b64), np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def bgr_to_b64_jpg(img, quality=92):
    _, buf = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return 'data:image/jpeg;base64,' + base64.b64encode(buf).decode()


# ── Face analysis for hairstyle (gpt-4o-mini vision, ~₹0.1, ~2s) ─────────────

def analyze_face_for_hairstyle(img_bgr, gender="male", style_category=""):
    """Look at the actual face and decide ONE specific, flattering hairstyle."""
    api_key = _get_api_key()

    img_small = cv2.resize(img_bgr, (256, 256), interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode('.jpg', img_small, [cv2.IMWRITE_JPEG_QUALITY, 70])
    img_b64 = base64.b64encode(buf).decode()

    prompt = FACE_HAIRSTYLE_ANALYSIS_PROMPT.format(
        gender=gender,
        style_category=style_category or "best-fitting"
    )

    print(f"[Trekky] Step 1/2: Analyzing face ({gender}, style: {style_category})...")
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
            "max_tokens": 150,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
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

    style = resp.json()['choices'][0]['message']['content'].strip().strip('"')
    print(f"[Trekky] Chosen hairstyle: {style}")
    return style


# ── Hairstyle swap (gpt-image-2, ~₹5.4) ──────────────────────────────────────

def swap_hairstyle(img_bgr, hairstyle="", gender="male"):
    api_key = _get_api_key()
    orig_h, orig_w = img_bgr.shape[:2]

    if hairstyle:
        prompt = HAIRSTYLE_EXECUTE_PROMPT.format(hairstyle=hairstyle, gender=gender)
    else:
        prompt = HAIRSTYLE_FALLBACK_PROMPT.format(gender=gender)

    # Resize to 1024x1024 for API (required minimum pixel budget)
    img_1024 = cv2.resize(img_bgr, (1024, 1024), interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode('.png', img_1024)

    print("[Trekky] Step 2/2: Applying hairstyle with gpt-image-2...")
    resp = requests.post(
        "https://api.openai.com/v1/images/edits",
        headers={"Authorization": f"Bearer {api_key}"},
        files={
            "image": ("photo.png", buf.tobytes(), "image/png"),
            "prompt": (None, prompt),
            "model": (None, "gpt-image-2"),
            "n": (None, "1"),
            "size": (None, "1024x1024"),
            "quality": (None, "medium"),
        },
        timeout=180,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"API error {resp.status_code}: {resp.text}")

    b64_data = resp.json()['data'][0]['b64_json']
    result_bytes = base64.b64decode(b64_data)
    result_img = cv2.imdecode(np.frombuffer(result_bytes, np.uint8), cv2.IMREAD_COLOR)

    # Resize output back to original image dimensions
    if result_img.shape[:2] != (orig_h, orig_w):
        result_img = cv2.resize(result_img, (orig_w, orig_h), interpolation=cv2.INTER_LANCZOS4)

    print("[Trekky] Hairstyle swap done.")
    return result_img


# ── Color analysis (gpt-4o-mini vision → text, ~₹0.1) ────────────────────────

def analyze_color(img_bgr, gender="male"):
    """Step 1: Use cheap text model to determine best hair color."""
    api_key = _get_api_key()

    img_small = cv2.resize(img_bgr, (256, 256), interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode('.jpg', img_small, [cv2.IMWRITE_JPEG_QUALITY, 70])
    img_b64 = base64.b64encode(buf).decode()

    prompt = COLOR_ANALYSIS_PROMPT.format(gender=gender)

    print(f"[Trekky] Step 1/2: Analyzing face with gpt-4o-mini ({gender})...")
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
                    {"type": "text", "text": prompt},
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
    print(f"[Trekky] Best color identified: {analysis['best_colors'][0]['name']}")
    return analysis


def generate_color_tryon(img_bgr, best_color_name, gender="male"):
    """Step 2: Generate 1 image with the best hair color applied."""
    api_key = _get_api_key()
    orig_h, orig_w = img_bgr.shape[:2]

    prompt = (
        f"Change ONLY the hair color in this photo of a {gender} person to {best_color_name}. "
        f"Keep the exact same hairstyle, length, and texture — just change the color. "
        f"The result must look like a natural, professionally done hair coloring.\n\n"
        f"Absolute rules:\n"
        f"• Face stays identical — eyes, nose, lips, eyebrows, skin, expression unchanged.\n"
        f"• Facial hair stays exactly as-is.\n"
        f"• Clothing, accessories, background, lighting — all unchanged.\n"
        f"• Do not change the hairstyle or hair length, only the color.\n"
        f"• Output only the edited image."
    )

    img_1024 = cv2.resize(img_bgr, (1024, 1024), interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode('.png', img_1024)

    print(f"[Trekky] Step 2/2: Generating try-on with '{best_color_name}'...")
    resp = requests.post(
        "https://api.openai.com/v1/images/edits",
        headers={"Authorization": f"Bearer {api_key}"},
        files={
            "image": ("photo.png", buf.tobytes(), "image/png"),
            "prompt": (None, prompt),
            "model": (None, "gpt-image-2"),
            "n": (None, "1"),
            "size": (None, "1024x1024"),
            "quality": (None, "medium"),
        },
        timeout=180,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"API error {resp.status_code}: {resp.text}")

    b64_data = resp.json()['data'][0]['b64_json']
    result_bytes = base64.b64decode(b64_data)
    result_img = cv2.imdecode(np.frombuffer(result_bytes, np.uint8), cv2.IMREAD_COLOR)

    # Resize output back to original image dimensions
    if result_img.shape[:2] != (orig_h, orig_w):
        result_img = cv2.resize(result_img, (orig_w, orig_h), interpolation=cv2.INTER_LANCZOS4)

    print("[Trekky] Color try-on done.")
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
        gender = data.get('gender', 'male') or 'male'

        if not src_b64:
            return jsonify({'error': 'No source image provided.'}), 400
        img = decode_b64_to_bgr(src_b64)
        if img is None:
            return jsonify({'error': 'Could not decode image.'}), 400

        # Auto-pick flow: analyze face first and decide the best style
        if not hairstyle:
            try:
                hairstyle = analyze_face_for_hairstyle(img, gender)
            except Exception:
                print(f"[Trekky] Face analysis failed, falling back to generic prompt:\n{traceback.format_exc()}")
                hairstyle = ""

        result = swap_hairstyle(img, hairstyle, gender)
        return jsonify({'result_url': bgr_to_b64_jpg(result)})
    except Exception:
        print(f"[Trekky] ERROR:\n{traceback.format_exc()}")
        return jsonify({'error': 'Processing failed. Please try again.'}), 500


@app.route('/api/color', methods=['POST'])
def color():
    try:
        data = request.get_json(force=True)
        src_b64 = data.get('source_image', '')
        gender = data.get('gender', 'male') or 'male'

        if not src_b64:
            return jsonify({'error': 'No source image provided.'}), 400
        img = decode_b64_to_bgr(src_b64)
        if img is None:
            return jsonify({'error': 'Could not decode image.'}), 400

        # Step 1: Analyze (cheap, ~₹0.10)
        analysis = analyze_color(img, gender)

        # Step 2: Generate 1 try-on image with the #1 best color (~₹5.4)
        best_color = analysis['best_colors'][0]['name']
        result_img = generate_color_tryon(img, best_color, gender)

        return jsonify({
            'color_analysis': analysis,
            'result_url': bgr_to_b64_jpg(result_img)
        })
    except Exception:
        print(f"[Trekky] ERROR:\n{traceback.format_exc()}")
        return jsonify({'error': 'Analysis failed. Please try again.'}), 500


if __name__ == '__main__':
    print("[Trekky] Backend ready — port 5000")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
