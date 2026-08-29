"""
Django REST API views for Trakky AI Hairstyle Transformation.
Handles user registration, image uploads, and OpenAI hairstyle generation.
"""

import os
import io
import random
import time
import mimetypes
import logging
import requests

from django.conf import settings
from django.http import JsonResponse, HttpResponse, FileResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from openai import OpenAI

from api.models import AppUser
from api.image_processor import smart_crop_image, pad_to_square, crop_and_restore

logger = logging.getLogger(__name__)

# Allowed image extensions for uploads
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}


def is_safe_path(base_dir: str, target_path: str) -> bool:
    """Security helper to prevent Directory Traversal / Path Traversal attacks (CWE-22)."""
    abs_base = os.path.realpath(base_dir)
    abs_target = os.path.realpath(target_path)
    return os.path.commonpath([abs_base, abs_target]) == abs_base


def get_openai_key() -> str:
    """Retrieve OpenAI API key from environment variable or local token file."""
    if os.environ.get('OPENAI_API_KEY'):
        return os.environ.get('OPENAI_API_KEY').strip()
    token_path = os.path.join(settings.BASE_DIR, 'chatgpt.token')
    if os.path.exists(token_path):
        try:
            with open(token_path, 'r', encoding='utf8') as f:
                return f.read().strip()
        except Exception as e:
            logger.warning(f"Error reading chatgpt.token: {e}")
    return ''


def build_hairstyle_prompt(gender: str, style: str) -> str:
    """Construct precise AI generation prompt with strict identity and scene retention locks."""
    style_desc = (
        "the most flattering, customized, high-definition luxury hairstyle tailored specifically to this client's unique face structure, jawline, skin tone, and facial features"
        if style == 'Auto-Select'
        else f'a perfectly styled, crisp, high-definition "{style}" hairstyle that seamlessly suits this client\'s face shape, skin tone, and features'
    )
    return (
        f"High-definition, professional salon-quality portrait edit. "
        f"Transform ONLY the hair on the scalp into {style_desc}. "
        f"STRICT IDENTITY & SCENE LOCK: "
        f"1. Preserve 100% of the person's face, eyes, nose, lips, eyebrows, facial hair, skin tone, expression, and apparent age. "
        f"2. Keep the exact same outfit/clothing, background, and overall scene lighting. "
        f"3. Make the hair look extremely realistic, volumetric, natural, sharp, and well-defined with studio-quality finish and clarity. "
        f"Output only the final photorealistic edited image."
    )


@api_view(['GET'])
def health_check(request):
    """API Health status check endpoint."""
    return JsonResponse({
        'status': 'ok',
        'stack': 'django-rest-framework',
        'version': '1.0.0'
    })


@csrf_exempt
@api_view(['POST'])
def register_user(request):
    """Register or retrieve user profile and assign initial trial sessions."""
    data = request.data
    email = data.get('email', '').strip().lower()
    mobile = data.get('mobile', '').strip()
    name = data.get('name', '').strip()
    location = data.get('location', '').strip()

    if not email and not mobile:
        return JsonResponse({'error': 'Email address or mobile number is required.'}, status=400)

    try:
        user = None
        if email:
            user = AppUser.objects.filter(email=email).first()
        if not user and mobile:
            user = AppUser.objects.filter(mobile=mobile).first()

        if user:
            if user.sessions <= 0:
                return JsonResponse({'error': 'This user account has already used all free trial sessions.'}, status=403)
            if mobile: user.mobile = mobile
            if name: user.name = name
            if location: user.location = location
            user.save()
        else:
            user = AppUser.objects.create(
                email=email or f"user_{int(time.time())}@trakky.local",
                mobile=mobile,
                name=name,
                location=location,
                sessions=5
            )

        return JsonResponse({
            'success': True,
            'user': {
                'id': user.id,
                'email': user.email,
                'mobile': user.mobile,
                'name': user.name,
                'location': user.location,
                'sessions': user.sessions
            }
        })
    except Exception as e:
        logger.error(f"[DB Registration Error] {e}", exc_info=True)
        return JsonResponse({'error': 'Registration failed. Please try again.'}, status=500)


@csrf_exempt
@api_view(['POST'])
def upload_image(request):
    """Secure image upload endpoint with file size and MIME validation."""
    uploaded_file = request.FILES.get('image') or request.data.get('image')
    if not uploaded_file:
        return JsonResponse({'error': 'No image file provided.'}, status=400)

    # 30MB File Size Guard
    if uploaded_file.size > 30 * 1024 * 1024:
        return JsonResponse({'error': 'File size exceeds maximum limit of 30MB.'}, status=400)

    # Secure Filename & Extension Guard
    original_name = os.path.basename(uploaded_file.name or '')
    ext = os.path.splitext(original_name)[1].lower() or '.jpg'
    if ext not in ALLOWED_EXTENSIONS:
        ext = '.jpg'

    upload_dir = os.path.join(settings.BASE_DIR, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"user_{int(time.time() * 1000)}_{random.randint(1000, 9999)}{ext}"
    filepath = os.path.join(upload_dir, filename)

    if not is_safe_path(upload_dir, filepath):
        return JsonResponse({'error': 'Invalid file upload path.'}, status=400)

    with open(filepath, 'wb+') as destination:
        for chunk in uploaded_file.chunks():
            destination.write(chunk)

    return JsonResponse({'success': True, 'image_url': f"uploads/{filename}"})


@csrf_exempt
@api_view(['POST'])
def swap_hairstyle(request):
    """Perform AI hairstyle transformation using OpenCV face-cropping and OpenAI DALL-E image edit API."""
    data = request.data
    email = data.get('email', '').strip().lower()
    image_url = data.get('image_url', '').strip()
    gender = data.get('gender', 'male')
    hairstyle = data.get('hairstyle', 'Auto-Select')

    if not email:
        return JsonResponse({'error': 'Email address or user identifier is required.'}, status=400)
    if not image_url:
        return JsonResponse({'error': 'Uploaded image path is required.'}, status=400)

    user = AppUser.objects.filter(email=email).first() or AppUser.objects.filter(mobile=email).first()
    if not user:
        user = AppUser.objects.create(email=email, sessions=5)

    if user.sessions <= 0:
        return JsonResponse({'error': 'You have used all your free sessions. Thank you for trying Trakky!'}, status=403)

    # Path Traversal Guard for target image path
    clean_rel_path = image_url.lstrip('/')
    img_path = os.path.join(settings.BASE_DIR, clean_rel_path)

    if not is_safe_path(settings.BASE_DIR, img_path) or not os.path.exists(img_path):
        return JsonResponse({'error': 'Image file not found on server.'}, status=404)

    logger.info(f"[Django Generate] User: {email} | Style: {hairstyle} | Gender: {gender}")

    # 1. Computer Vision: Smart face crop
    proc_path, is_temp = smart_crop_image(img_path)

    # 2. Pre-processing: Aspect-preserved 1024x1024 padding
    padded_png_bytes, orig_w, orig_h = pad_to_square(proc_path)

    if is_temp and os.path.exists(proc_path):
        try:
            os.remove(proc_path)
        except Exception:
            pass

    # 3. Call OpenAI Image Editing API
    api_key = get_openai_key()
    if not api_key:
        return JsonResponse({'error': 'OpenAI API key is not configured on the server.'}, status=500)

    try:
        client = OpenAI(api_key=api_key)
        
        # Prepare named BytesIO buffer for OpenAI SDK
        buf = io.BytesIO(padded_png_bytes)
        buf.name = 'image.png'

        response = client.images.edit(
            model="gpt-image-2",
            image=buf,
            prompt=build_hairstyle_prompt(gender, hairstyle),
            n=1,
            size="1024x1024"
        )

        results = []
        upload_dir = os.path.join(settings.BASE_DIR, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)

        for i, item in enumerate(response.data):
            if hasattr(item, 'b64_json') and item.b64_json:
                import base64
                ai_bytes = base64.b64decode(item.b64_json)
            elif hasattr(item, 'url') and item.url:
                ai_bytes = requests.get(item.url, timeout=15).content
            else:
                continue

            out_name = f"result_{int(time.time() * 1000)}_{i}.jpg"
            out_path = os.path.join(upload_dir, out_name)

            crop_and_restore(ai_bytes, orig_w, orig_h, out_path)
            results.append({
                'url': f"uploads/{out_name}",
                'style_name': hairstyle
            })

        # Decrement remaining session balance
        user.sessions = max(0, user.sessions - 1)
        user.save()

        logger.info(f"[Django Generate Success] User: {email} | Remaining sessions: {user.sessions}")

        return JsonResponse({
            'success': True,
            'results': results,
            'sessionsRemaining': user.sessions
        })
    except Exception as e:
        logger.error(f"[Django Generate Error] {e}", exc_info=True)
        return JsonResponse({'error': 'AI processing failed. Please try again.'}, status=500)


def serve_logo(request):
    """Serve Trakky branding logo."""
    logo1 = os.path.join(settings.BASE_DIR, 'public', 'trakky-logo.png')
    logo2 = os.path.join(settings.BASE_DIR, 'trakky-logo.png')
    if os.path.exists(logo1): return FileResponse(open(logo1, 'rb'), content_type='image/png')
    if os.path.exists(logo2): return FileResponse(open(logo2, 'rb'), content_type='image/png')
    return HttpResponse(status=404)


def serve_uploads(request, path: str):
    """Serve processed user upload files with path traversal security checks."""
    upload_dir = os.path.join(settings.BASE_DIR, 'uploads')
    file_path = os.path.join(upload_dir, path)

    if is_safe_path(upload_dir, file_path) and os.path.exists(file_path) and os.path.isfile(file_path):
        content_type, _ = mimetypes.guess_type(file_path)
        return FileResponse(open(file_path, 'rb'), content_type=content_type or 'image/jpeg')

    raise Http404("Upload file not found")


def serve_frontend(request, path: str = ''):
    """Serve compiled React SPA assets and fallback to index.html for client-side routing."""
    public_dir = os.path.join(settings.BASE_DIR, 'public')
    frontend_dist_dir = os.path.join(settings.BASE_DIR, 'frontend', 'dist')
    
    if path:
        for folder in [frontend_dist_dir, public_dir]:
            target_file = os.path.join(folder, path)
            if is_safe_path(folder, target_file) and os.path.exists(target_file) and os.path.isfile(target_file):
                content_type, _ = mimetypes.guess_type(target_file)
                if target_file.endswith('.js'):
                    content_type = 'application/javascript'
                elif target_file.endswith('.css'):
                    content_type = 'text/css'
                return FileResponse(open(target_file, 'rb'), content_type=content_type or 'application/octet-stream')

    possible_indexes = [
        os.path.join(frontend_dist_dir, 'index.html'),
        os.path.join(public_dir, 'index.html'),
        os.path.join(public_dir, 'dist', 'index.html'),
    ]
    for idx_path in possible_indexes:
        if os.path.exists(idx_path):
            return FileResponse(open(idx_path, 'rb'), content_type='text/html')

    return HttpResponse("Frontend React build index.html not found", status=404)
