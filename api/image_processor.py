import os
import io
import time
from PIL import Image, ImageOps
import cv2
import numpy as np
from django.conf import settings

def get_cascade_dir():
    paths = [
        getattr(cv2, 'data', None) and getattr(cv2.data, 'haarcascades', None),
        '/usr/share/opencv4/haarcascades',
        '/usr/share/opencv/haarcascades',
        '/usr/local/share/opencv4/haarcascades',
        '/usr/local/share/opencv/haarcascades'
    ]
    for p in paths:
        if p and os.path.exists(p):
            return p
    return ''

def strip_letterbox_borders(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    H, W = gray.shape
    row_means = np.mean(gray, axis=1)
    col_means = np.mean(gray, axis=0)

    valid_rows = np.where((row_means > 12) & (row_means < 243))[0]
    valid_cols = np.where((col_means > 12) & (col_means < 243))[0]

    if len(valid_rows) > H * 0.3 and len(valid_cols) > W * 0.3:
        y1, y2 = valid_rows[0], valid_rows[-1] + 1
        x1, x2 = valid_cols[0], valid_cols[-1] + 1
        if (y2 - y1) < H * 0.98 or (x2 - x1) < W * 0.98:
            return img[y1:y2, x1:x2]
    return img

def smart_crop_image(input_path):
    """Smart face crop using OpenCV. Returns (target_path, is_temporary)"""
    if not os.path.exists(input_path):
        return input_path, False

    img = cv2.imread(input_path)
    if img is None:
        return input_path, False

    img = strip_letterbox_borders(img)
    H, W = img.shape[:2]

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    eq_gray = cv2.equalizeHist(gray)

    cascade_dir = get_cascade_dir()
    cascade_names = [
        'haarcascade_frontalface_alt2.xml',
        'haarcascade_frontalface_default.xml',
        'haarcascade_frontalface_alt.xml',
        'haarcascade_profileface.xml'
    ]

    all_faces = []
    if cascade_dir:
        for cname in cascade_names:
            cpath = os.path.join(cascade_dir, cname)
            if not os.path.exists(cpath):
                continue
            cascade = cv2.CascadeClassifier(cpath)
            f1 = cascade.detectMultiScale(gray, scaleFactor=1.06, minNeighbors=3, minSize=(35, 35))
            if len(f1) > 0:
                all_faces.extend(f1)
            f2 = cascade.detectMultiScale(eq_gray, scaleFactor=1.06, minNeighbors=3, minSize=(35, 35))
            if len(f2) > 0:
                all_faces.extend(f2)

    dir_name = os.path.dirname(input_path)
    ext = os.path.splitext(input_path)[1] or '.jpg'
    cropped_path = os.path.join(dir_name, f"smart_crop_{int(time.time() * 1000)}{ext}")

    if len(all_faces) > 0:
        all_faces = sorted(all_faces, key=lambda f: f[2] * f[3], reverse=True)
        x, y, w, h = all_faces[0]
        face_size = max(w, h)
        cx, cy = x + w // 2, y + h // 2

        crop_size = min(max(int(face_size * 5.0), 400), min(W, H))

        y1 = max(0, y - int(face_size * 2.0))
        y2 = min(H, y1 + crop_size)
        if (y2 - y1) < crop_size and y1 > 0:
            y1 = max(0, y2 - crop_size)

        x1 = max(0, cx - crop_size // 2)
        x2 = min(W, x1 + crop_size)
        if (x2 - x1) < crop_size and x1 > 0:
            x1 = max(0, x2 - crop_size)

        cropped = img[y1:y2, x1:x2]
        cv2.imwrite(cropped_path, cropped)
        print(f"[SmartCrop] Cropped around face: {cropped_path}")
        return cropped_path, True

    # Aspect ratio fallback
    aspect_ratio = H / W
    if aspect_ratio > 1.2:
        crop_h = int(W * 1.1)
        y1 = int(H * 0.08)
        y2 = min(H, y1 + crop_h)
        cropped = img[y1:y2, 0:W]
        cv2.imwrite(cropped_path, cropped)
        return cropped_path, True
    elif aspect_ratio < 0.8:
        crop_w = H
        x1 = int((W - H) / 2)
        x2 = x1 + crop_w
        cropped = img[0:H, x1:x2]
        cv2.imwrite(cropped_path, cropped)
        return cropped_path, True

    return input_path, False

def pad_to_square(input_path):
    """Pads image to 1024x1024 square with transparent borders without stretching. Returns (png_bytes, orig_w, orig_h)"""
    with Image.open(input_path) as im:
        im = ImageOps.exif_transpose(im)
        im = im.convert('RGBA')
        orig_w, orig_h = im.size

        # Fit image into 1024x1024
        scale = min(1024 / orig_w, 1024 / orig_h)
        render_w = int(round(orig_w * scale))
        render_h = int(round(orig_h * scale))

        resized = im.resize((render_w, render_h), Image.Resampling.LANCZOS)

        canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
        left = (1024 - render_w) // 2
        top = (1024 - render_h) // 2
        canvas.paste(resized, (left, top), resized)

        out_buffer = io.BytesIO()
        canvas.save(out_buffer, format='PNG')
        return out_buffer.getvalue(), orig_w, orig_h

def crop_and_restore(ai_img_bytes, orig_w, orig_h, dest_path):
    """Crops AI 1024x1024 output back to original aspect ratio, resizes to original dimensions, stamps watermark."""
    with Image.open(io.BytesIO(ai_img_bytes)) as ai_im:
        ai_im = ai_im.convert('RGBA')

        scale = min(1024 / orig_w, 1024 / orig_h)
        render_w = int(round(orig_w * scale))
        render_h = int(round(orig_h * scale))
        left = int(round((1024 - render_w) / 2))
        top = int(round((1024 - render_h) / 2))

        # Extract active area
        cropped = ai_im.crop((left, top, left + render_w, top + render_h))
        restored = cropped.resize((orig_w, orig_h), Image.Resampling.LANCZOS)

        # Watermark
        logo_path = os.path.join(settings.BASE_DIR, 'trakky-logo.png')
        if not os.path.exists(logo_path):
            logo_path = os.path.join(settings.BASE_DIR, 'public', 'trakky-logo.png')

        if os.path.exists(logo_path):
            try:
                with Image.open(logo_path) as logo:
                    logo = logo.convert('RGBA')
                    logo_w = max(int(round(orig_w * 0.12)), 40)
                    logo_h = int(round(logo.height * (logo_w / logo.width)))
                    logo_resized = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)

                    margin = 15
                    pos_x = orig_w - logo_w - margin
                    pos_y = orig_h - logo_h - margin

                    if pos_x >= 0 and pos_y >= 0:
                        restored.paste(logo_resized, (pos_x, pos_y), logo_resized)
            except Exception as e:
                print(f"[Watermark Warning] {e}")

        final_rgb = restored.convert('RGB')
        final_rgb.save(dest_path, 'JPEG', quality=92)
