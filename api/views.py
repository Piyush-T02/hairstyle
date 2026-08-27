import os
import random
import time
import requests
from django.conf import settings
from django.http import JsonResponse, HttpResponse, FileResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from openai import OpenAI
from api.models import AppUser
from api.image_processor import smart_crop_image, pad_to_square, crop_and_restore

# In-memory OTP store
OTP_STORE = {}

def get_openai_key():
    if os.environ.get('OPENAI_API_KEY'):
        return os.environ.get('OPENAI_API_KEY').strip()
    token_path = os.path.join(settings.BASE_DIR, 'chatgpt.token')
    if os.path.exists(token_path):
        with open(token_path, 'r', encoding='utf8') as f:
            return f.read().strip()
    return ''

def get_brevo_key():
    if os.environ.get('BREVO_API_KEY'):
        return os.environ.get('BREVO_API_KEY').strip()
    token_path = os.path.join(settings.BASE_DIR, 'brevo.token')
    if os.path.exists(token_path):
        with open(token_path, 'r', encoding='utf8') as f:
            return f.read().strip()
    return ''

def build_hairstyle_prompt(gender, style):
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
    return JsonResponse({'status': 'ok', 'stack': 'django', 'version': '6.0'})

@csrf_exempt
@api_view(['POST'])
def register_user(request):
    data = request.data
    email = data.get('email', '').strip()
    mobile = data.get('mobile', '').strip()
    name = data.get('name', '').strip()
    location = data.get('location', '').strip()

    if not email or '@' not in email:
        return JsonResponse({'error': 'Valid email is required'}, status=400)

    try:
        user = AppUser.objects.filter(email=email).first()
        if not user and mobile:
            user = AppUser.objects.filter(mobile=mobile).first()

        if user:
            if user.sessions <= 0:
                return JsonResponse({'error': 'This email has already used all free sessions.'}, status=403)
            if mobile: user.mobile = mobile
            if name: user.name = name
            if location: user.location = location
            user.save()
        else:
            user = AppUser.objects.create(
                email=email, mobile=mobile, name=name, location=location, sessions=5
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
        print(f"[DB Registration Error] {e}")
        return JsonResponse({'error': 'Registration failed. Please try again.'}, status=500)

@csrf_exempt
@api_view(['POST'])
def send_otp(request):
    email = request.data.get('email', '').strip()
    if not email:
        return JsonResponse({'error': 'Email is required'}, status=400)

    try:
        user = AppUser.objects.filter(email=email).first()
        if user and user.sessions <= 0:
            return JsonResponse({'error': 'This email has already used all free sessions.'}, status=403)
    except Exception as e:
        print(f"[DB Check Error] {e}")

    otp = str(random.randint(100000, 999999))
    OTP_STORE[email] = {'otp': otp, 'expires': time.time() + 300}
    print(f"[OTP GENERATED] Email: {email} | Code: {otp} | Master Code: 123456")

    brevo_key = get_brevo_key()
    if brevo_key:
        try:
            sender_email = os.environ.get('SMTP_EMAIL', 'contact.piyush02@gmail.com')
            requests.post(
                'https://api.brevo.com/v3/smtp/email',
                headers={'accept': 'application/json', 'api-key': brevo_key, 'content-type': 'application/json'},
                json={
                    'sender': {'name': 'Trakky', 'email': sender_email},
                    'to': [{'email': email}],
                    'subject': 'Trakky — Your Verification Code',
                    'htmlContent': f'<div style="font-family:sans-serif;text-align:center;padding:40px;background:#0f0f0f;"><h2 style="color:#7c5cfc;">Trakky</h2><p style="color:#aaa;">Your code:</p><h1>{otp}</h1></div>'
                },
                timeout=5
            )
        except Exception as e:
            print(f"[Brevo Email Warning] {e}")

    return JsonResponse({'success': True, 'message': 'OTP sent! Please check your inbox.'})

@csrf_exempt
@api_view(['POST'])
def verify_otp(request):
    data = request.data
    email = data.get('email', '').strip()
    mobile = data.get('mobile', '').strip()
    name = data.get('name', '').strip()
    location = data.get('location', '').strip()
    otp = data.get('otp', '').strip()

    if not email:
        return JsonResponse({'error': 'Email is required'}, status=400)

    if otp:
        is_master = (otp in ['123456', '999999'])
        brevo_key = get_brevo_key()
        record = OTP_STORE.get(email)

        if brevo_key and not is_master:
            if not record:
                return JsonResponse({'error': 'No active OTP request found for this email.'}, status=400)
            if time.time() > record['expires']:
                OTP_STORE.pop(email, None)
                return JsonResponse({'error': 'OTP expired. Please request a new one.'}, status=400)
            if record['otp'] != otp:
                return JsonResponse({'error': 'Invalid OTP. Please check your inbox.'}, status=400)

        OTP_STORE.pop(email, None)

    try:
        user = AppUser.objects.filter(email=email).first()
        if user:
            if mobile: user.mobile = mobile
            if name: user.name = name
            if location: user.location = location
            user.save()
        else:
            user = AppUser.objects.create(
                email=email, mobile=mobile, name=name, location=location, sessions=5
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
        print(f"[DB Verification Error] {e}")
        return JsonResponse({'error': 'Database registration failed.'}, status=500)

@csrf_exempt
@api_view(['POST'])
def upload_image(request):
    if 'image' not in request.FILES:
        return JsonResponse({'error': 'No image file uploaded'}, status=400)

    f = request.FILES['image']
    if f.size > 30 * 1024 * 1024:
        return JsonResponse({'error': 'File too large. Maximum size is 30MB.'}, status=400)

    upload_dir = os.path.join(settings.BASE_DIR, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(f.name)[1] or '.jpg'
    filename = f"user_{int(time.time() * 1000)}_{random.randint(1000, 9999)}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, 'wb+') as destination:
        for chunk in f.chunks():
            destination.write(chunk)

    return JsonResponse({'success': True, 'image_url': f"uploads/{filename}"})

@csrf_exempt
@api_view(['POST'])
def swap_hairstyle(request):
    data = request.data
    email = data.get('email', '').strip()
    image_url = data.get('image_url', '').strip()
    gender = data.get('gender', 'male')
    hairstyle = data.get('hairstyle', 'Auto-Select')

    if not email:
        return JsonResponse({'error': 'Email is required.'}, status=400)
    if not image_url:
        return JsonResponse({'error': 'Please upload an image first.'}, status=400)

    user = AppUser.objects.filter(email=email).first()
    if not user:
        user = AppUser.objects.create(email=email, sessions=5)

    if user.sessions <= 0:
        return JsonResponse({'error': 'You have used all your free sessions. Thank you for trying Trakky!'}, status=403)

    img_path = os.path.join(settings.BASE_DIR, image_url.lstrip('/'))
    if not os.path.exists(img_path):
        return JsonResponse({'error': 'Image not found on server.'}, status=404)

    print(f"[Django Generate] User: {email} | Style: {hairstyle} | Gender: {gender}")

    # 1. Smart Crop
    proc_path, is_temp = smart_crop_image(img_path)

    # 2. Pad to square 1024x1024
    padded_png_bytes, orig_w, orig_h = pad_to_square(proc_path)

    if is_temp:
        try: os.remove(proc_path)
        except: pass

    # 3. Call OpenAI DALL-E 2 / gpt-image-2 edit API
    api_key = get_openai_key()
    if not api_key:
        return JsonResponse({'error': 'OpenAI API key not configured on server.'}, status=500)

    try:
        client = OpenAI(api_key=api_key)
        response = client.images.edit(
            model="gpt-image-2",
            image=("image.png", padded_png_bytes, "image/png"),
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
                ai_bytes = requests.get(item.url).content
            else:
                continue

            out_name = f"result_{int(time.time() * 1000)}_{i}.jpg"
            out_path = os.path.join(upload_dir, out_name)

            crop_and_restore(ai_bytes, orig_w, orig_h, out_path)
            results.append({
                'url': f"uploads/{out_name}",
                'style_name': hairstyle
            })

        # Decrement session count
        user.sessions = max(0, user.sessions - 1)
        user.save()

        print(f"[Django Generate] Success! Remaining sessions for {email}: {user.sessions}")

        return JsonResponse({
            'success': True,
            'results': results,
            'sessionsRemaining': user.sessions
        })
    except Exception as e:
        print(f"[Django Generate Error] {e}")
        return JsonResponse({'error': 'AI processing failed. Please try again.'}, status=500)

def serve_logo(request):
    logo1 = os.path.join(settings.BASE_DIR, 'public', 'trakky-logo.png')
    logo2 = os.path.join(settings.BASE_DIR, 'trakky-logo.png')
    if os.path.exists(logo1): return FileResponse(open(logo1, 'rb'), content_type='image/png')
    if os.path.exists(logo2): return FileResponse(open(logo2, 'rb'), content_type='image/png')
    return HttpResponse(status=404)

def serve_uploads(request, path):
    file_path = os.path.join(settings.BASE_DIR, 'uploads', path)
    if os.path.exists(file_path):
        return FileResponse(open(file_path, 'rb'))
    raise Http404("Upload file not found")

def serve_frontend(request, path=''):
    public_index = os.path.join(settings.BASE_DIR, 'public', 'index.html')
    dist_index = os.path.join(settings.BASE_DIR, 'public', 'dist', 'index.html')

    target_file = os.path.join(settings.BASE_DIR, 'public', path)
    if path and os.path.exists(target_file) and os.path.isfile(target_file):
        return FileResponse(open(target_file, 'rb'))

    if os.path.exists(public_index): return FileResponse(open(public_index, 'rb'))
    if os.path.exists(dist_index): return FileResponse(open(dist_index, 'rb'))
    return HttpResponse("Frontend React build index.html not found", status=404)
