import sys
import os
import cv2
import numpy as np

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
    """Detect and trim solid black/white bars from screenshot edges."""
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

def smart_crop(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"[SmartCrop] Input file not found: {input_path}")
        return False

    img = cv2.imread(input_path)
    if img is None:
        print(f"[SmartCrop] Failed to load image: {input_path}")
        return False

    # 1. Strip black/white letterboxing
    img = strip_letterbox_borders(img)
    H, W = img.shape[:2]

    # 2. Multi-cascade face detection
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
        cv2.imwrite(output_path, cropped)
        print(f"[SmartCrop] Face detected! Cropped {W}x{H} -> {cropped.shape[1]}x{cropped.shape[0]} around face ({x},{y})")
        return True

    # 3. Aspect ratio fallback
    aspect_ratio = H / W
    if aspect_ratio > 1.2:
        crop_h = int(W * 1.1)
        y1 = int(H * 0.08)
        y2 = min(H, y1 + crop_h)
        cropped = img[y1:y2, 0:W]
        cv2.imwrite(output_path, cropped)
        print(f"[SmartCrop] Vertical screenshot fallback crop! {W}x{H} -> {W}x{y2-y1}")
        return True
    elif aspect_ratio < 0.8:
        crop_w = H
        x1 = int((W - H) / 2)
        x2 = x1 + crop_w
        cropped = img[0:H, x1:x2]
        cv2.imwrite(output_path, cropped)
        print(f"[SmartCrop] Horizontal screenshot fallback crop! {W}x{H} -> {crop_w}x{H}")
        return True

    cv2.imwrite(output_path, img)
    print(f"[SmartCrop] Standard image used directly: {W}x{H}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 smart_crop.py <input_path> <output_path>")
        sys.exit(1)
    
    in_file = sys.argv[1]
    out_file = sys.argv[2]
    smart_crop(in_file, out_file)
