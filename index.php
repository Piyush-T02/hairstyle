<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trekky — Virtual Hairstyle & Color Studio</title>
    <meta name="description" content="Try new hairstyles and discover your perfect hair color — all from a single photo. Powered by Trekky.">
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body>

<!-- ═══ LANDING ═══ -->
<div id="landing">

    <header class="nav">
        <div class="nav-inner">
            <a href="#" onclick="window.scrollTo(0,0); return false;" class="logo">
                <img src="logo.jpeg" alt="Trekky" class="logo-img">
                Trekky
            </a>
            <div class="nav-links">
                <a href="#features">Features</a>
                <a href="#how">How It Works</a>
            </div>
            <button class="nav-cta" onclick="openStudio('hairstyle')">Get Started</button>
        </div>
    </header>

    <!-- Hero -->
    <section class="hero">
        <div class="hero-badge"><i class="fa-solid fa-sparkles"></i> Virtual Hair Studio</div>
        <h1>Your Perfect Look,<br><span>Before the Salon</span></h1>
        <p>Upload your photo, try new hairstyles instantly, or discover which hair colors complement your skin tone — all in seconds.</p>
        <button class="nav-cta" style="padding:16px 36px;font-size:1rem;border-radius:16px" onclick="openStudio('hairstyle')">
            <i class="fa-solid fa-camera"></i>&nbsp; Try It Free
        </button>
    </section>

    <!-- Feature Cards -->
    <section id="features" class="features">
        <div class="feat-card" onclick="openStudio('hairstyle')">
            <div class="feat-icon" style="background:rgba(124,92,252,0.1);color:var(--accent-light)">
                <i class="fa-solid fa-scissors"></i>
            </div>
            <h3>Hairstyle Try-On</h3>
            <p>See yourself with a brand new haircut. Select your gender, pick a style category, and get a photorealistic preview instantly.</p>
            <div class="feat-cta">Try a new hairstyle <i class="fa-solid fa-arrow-right"></i></div>
        </div>
        <div class="feat-card" onclick="openStudio('color')">
            <div class="feat-icon" style="background:rgba(251,113,133,0.1);color:var(--rose)">
                <i class="fa-solid fa-palette"></i>
            </div>
            <h3>Hair Color Analysis</h3>
            <p>Discover which hair colors best complement your skin tone and features. Get personalized recommendations with try-on preview.</p>
            <div class="feat-cta">Analyze my colors <i class="fa-solid fa-arrow-right"></i></div>
        </div>
    </section>

    <!-- How It Works -->
    <section id="how" class="how-section">
        <h2>How It Works</h2>
        <div class="how-grid">
            <div class="how-step">
                <div class="how-num">1</div>
                <h4>Upload or Snap</h4>
                <p>Upload a front-facing photo from your gallery or take one with your camera.</p>
            </div>
            <div class="how-step">
                <div class="how-num">2</div>
                <h4>Choose Your Style</h4>
                <p>Select your gender, pick a hairstyle category, and let us work our magic.</p>
            </div>
            <div class="how-step">
                <div class="how-num">3</div>
                <h4>See Your Result</h4>
                <p>Get your photorealistic result in seconds. Download or book a salon appointment.</p>
            </div>
        </div>
    </section>

    <footer class="footer">
        <p>&copy; 2026 Trekky. All rights reserved. &nbsp;|&nbsp; <a href="#" style="color:var(--text-muted)">Privacy</a> &nbsp;|&nbsp; <a href="#" style="color:var(--text-muted)">Terms</a></p>
    </footer>
</div>

<!-- ═══ STUDIO ═══ -->
<div id="studio" class="studio">
    <div class="studio-header">
        <a href="#" class="logo" onclick="closeStudio(); return false;" style="color:white; text-decoration:none; display:flex; align-items:center; gap:8px;">
            <img src="logo.jpeg" alt="Trekky" style="width:32px; height:32px; border-radius:8px; object-fit:contain;">
            <span style="font-weight:700; font-size:1.1rem; letter-spacing:-0.02em;">Trekky</span>
        </a>
        <div class="studio-title" style="flex:1; justify-content:center;">
            <i class="fa-solid fa-wand-magic-sparkles" style="color:var(--accent-light)"></i>
            <span id="studio-feature-label">Hairstyle Try-On</span>
            <span id="studio-badge" class="studio-badge badge-wait">Connecting…</span>
        </div>
        <button class="exit-btn" onclick="closeStudio()"><i class="fa-solid fa-xmark"></i> Close</button>
    </div>

    <div class="studio-body">

        <!-- STEP 0: Registration -->
        <div id="step-register" class="step active">
            <h2 class="step-title">Welcome to Trekky</h2>
            <p class="step-sub">Enter your details to get started. You get 5 free transformations!</p>

            <div class="reg-form">
                <div class="form-group">
                    <label><i class="fa-solid fa-user"></i> Full Name</label>
                    <input type="text" id="reg-name" placeholder="Enter your full name">
                </div>
                <div class="form-group">
                    <label><i class="fa-solid fa-location-dot"></i> Location</label>
                    <input type="text" id="reg-location" placeholder="Your city">
                </div>
                <div class="form-group">
                    <label><i class="fa-solid fa-phone"></i> Mobile Number</label>
                    <input type="tel" id="reg-mobile" placeholder="+91 XXXXX XXXXX" maxlength="15">
                </div>
                <div class="form-group">
                    <label><i class="fa-solid fa-envelope"></i> Gmail</label>
                    <div class="otp-row">
                        <input type="email" id="reg-email" placeholder="your@gmail.com">
                        <button id="btn-send-otp" onclick="sendOtp()">Send OTP</button>
                    </div>
                </div>
                <div class="form-group" id="otp-group" style="display:none">
                    <label><i class="fa-solid fa-shield-halved"></i> Enter OTP</label>
                    <div class="otp-row">
                        <input type="text" id="reg-otp" placeholder="6-digit OTP" maxlength="6">
                        <button id="btn-verify-otp" onclick="verifyOtp()">Verify</button>
                    </div>
                </div>
                <button id="btn-register" class="btn-primary disabled" style="margin-top:24px" disabled>
                    <i class="fa-solid fa-arrow-right"></i> Get Started
                </button>
                <p style="text-align:center;font-size:0.65rem;color:var(--text-muted);margin-top:12px">
                    <i class="fa-solid fa-lock"></i> Your data is secure and never shared with third parties.
                </p>
            </div>
        </div>

        <!-- STEP 1: Upload -->
        <div id="step-upload" class="step">
            <h2 class="step-title">Upload Your Photo</h2>
            <p class="step-sub">Front-facing, well-lit photo works best. No glasses recommended.</p>
            <div style="text-align:center;">
                <span id="usage-counter" class="usage-badge"><i class="fa-solid fa-bolt"></i> 5 uses remaining</span>
            </div>

            <div id="drop-zone" class="drop-zone" onclick="triggerFile()" ondragover="handleDragOver(event)" ondragleave="handleDragLeave()" ondrop="handleDrop(event)">
                <input type="file" id="file-input" hidden accept="image/jpeg,image/png,image/webp" onchange="handleFileSelect(event)">
                <input type="file" id="camera-input" hidden accept="image/*" capture="user" onchange="handleFileSelect(event)">
                <div class="drop-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
                <h4>Drag & drop your photo here</h4>
                <p>or choose an option below</p>
                <div class="cam-row">
                    <button class="cam-btn" onclick="event.stopPropagation(); triggerFile()">
                        <i class="fa-solid fa-image"></i> Gallery
                    </button>
                    <button class="cam-btn" onclick="event.stopPropagation(); triggerCamera()">
                        <i class="fa-solid fa-camera"></i> Camera
                    </button>
                </div>
            </div>

            <div id="preview-wrap" class="preview-wrap">
                <div class="preview-img-wrap"><img id="preview-img" src="#" alt="Preview"></div>
                <p id="preview-name" class="preview-name"></p>
                <button class="remove-btn" onclick="resetUpload()"><i class="fa-solid fa-trash-can"></i> Remove</button>
            </div>

            <!-- Gender selector (shown after upload) -->
            <div id="gender-wrap" style="display:none; margin-top:24px;">
                <p style="text-align:center;font-size:0.8rem;color:var(--text-dim);margin-bottom:12px;">Select your gender for accurate results:</p>
                <div class="gender-row">
                    <button class="gender-btn" id="btn-male" onclick="selectGender('male')">
                        <i class="fa-solid fa-mars"></i> Male
                    </button>
                    <button class="gender-btn" id="btn-female" onclick="selectGender('female')">
                        <i class="fa-solid fa-venus"></i> Female
                    </button>
                </div>
            </div>

            <button id="btn-next" class="btn-primary disabled" style="margin-top:24px" disabled>
                <i class="fa-solid fa-wand-magic-sparkles"></i> Generate My Look
            </button>
            <p style="text-align:center;font-size:0.65rem;color:var(--text-muted);margin-top:12px">
                <i class="fa-solid fa-lock"></i> Your photo is processed securely and never stored.
            </p>
        </div>

        <!-- STEP 1.5: Style Selection (hairstyle only) -->
        <div id="step-style" class="step">
            <h2 class="step-title">Choose a Hairstyle</h2>
            <p class="step-sub">Pick a style category that interests you.</p>

            <div id="style-grid-male" class="style-grid">
                <!-- Male styles injected by JS -->
            </div>
            <div id="style-grid-female" class="style-grid" style="display:none">
                <!-- Female styles injected by JS -->
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                <button class="btn-back" onclick="showStep('step-upload')"><i class="fa-solid fa-chevron-left"></i> Back</button>
                <button id="btn-generate" class="btn-primary disabled" style="width:auto;padding:12px 24px" disabled>
                    Generate <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        </div>

        <!-- STEP 2: Loading -->
        <div id="step-loading" class="step">
            <div class="loading-wrap">
                <div class="scan-box">
                    <img id="scan-img" src="#" alt="Processing">
                    <div class="scan-line"></div>
                </div>
                <div class="loading-spinner"></div>
                <p id="loading-quote" class="loading-quote"></p>
                <p id="loading-quote-author" class="loading-quote-author"></p>
                <h3 id="loading-label" style="font-weight:700;margin-bottom:4px;font-size:0.95rem;">Processing…</h3>
                <p style="font-size:0.7rem;color:var(--text-dim);">This usually takes 30–60 seconds.</p>
            </div>
        </div>

        <!-- STEP 3: Result -->
        <div id="step-result" class="step">
            <h2 class="step-title">Your New Look</h2>
            <p class="step-sub">Here's your personalized result.</p>
            <div id="result-container"></div>
        </div>

    </div>
</div>

<script src="app.js"></script>
</body>
</html>
