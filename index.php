<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Strand — Virtual Hairstyle & Color Studio</title>
    <meta name="description" content="Try new hairstyles and discover your perfect hair color — all from a single photo.">
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body>

<!-- ═══ LANDING ═══ -->
<div id="landing">

    <header class="nav">
        <div class="nav-inner">
            <a href="#" class="logo">
                <div class="logo-icon"><i class="fa-solid fa-scissors"></i></div>
                Strand
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
            <p>See yourself with a brand new haircut. Pick a style or let us auto-select the most flattering one for your face shape.</p>
            <div class="feat-cta">Try a new hairstyle <i class="fa-solid fa-arrow-right"></i></div>
        </div>
        <div class="feat-card" onclick="openStudio('color')">
            <div class="feat-icon" style="background:rgba(251,113,133,0.1);color:var(--rose)">
                <i class="fa-solid fa-palette"></i>
            </div>
            <h3>Hair Color Analysis</h3>
            <p>Discover which hair colors best complement your skin tone and features. Get personalized recommendations with colors to try and avoid.</p>
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
                <h4>Choose a Feature</h4>
                <p>Try a new hairstyle or get your personalized hair color analysis.</p>
            </div>
            <div class="how-step">
                <div class="how-num">3</div>
                <h4>See Your Result</h4>
                <p>Get your photorealistic result in seconds. Download and share it with your stylist.</p>
            </div>
        </div>
    </section>

    <footer class="footer">
        <p>&copy; 2026 Strand. All rights reserved. &nbsp;|&nbsp; <a href="#" style="color:var(--text-muted)">Privacy</a> &nbsp;|&nbsp; <a href="#" style="color:var(--text-muted)">Terms</a></p>
    </footer>
</div>

<!-- ═══ STUDIO ═══ -->
<div id="studio" class="studio">
    <div class="studio-header">
        <div class="studio-title">
            <i class="fa-solid fa-wand-magic-sparkles" style="color:var(--accent-light)"></i>
            <span id="studio-feature-label">Hairstyle Try-On</span>
            <span id="studio-badge" class="studio-badge badge-wait">Connecting…</span>
        </div>
        <button class="exit-btn" onclick="closeStudio()"><i class="fa-solid fa-xmark"></i> Close</button>
    </div>

    <div class="studio-body">

        <!-- STEP 1: Upload -->
        <div id="step-upload" class="step active">
            <h2 class="step-title">Upload Your Photo</h2>
            <p class="step-sub">Front-facing, well-lit photo works best. No glasses recommended.</p>

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

            <button id="btn-next" class="btn-primary disabled" style="margin-top:24px">
                <i class="fa-solid fa-arrow-right"></i> Continue
            </button>
            <p style="text-align:center;font-size:0.65rem;color:var(--text-muted);margin-top:12px">
                <i class="fa-solid fa-lock"></i> Your photo is processed securely and never stored.
            </p>
        </div>

        <!-- STEP 2: Style Selection (hairstyle only) -->
        <div id="step-style" class="step">
            <h2 class="step-title">Choose a Hairstyle</h2>
            <p class="step-sub">Pick a style to try, or skip to let us pick the best one for you.</p>

            <div class="tab-row">
                <div class="tab-group">
                    <button id="tab-men" class="tab-btn active" onclick="switchTab('men')">Men's</button>
                    <button id="tab-women" class="tab-btn" onclick="switchTab('women')">Women's</button>
                </div>
            </div>

            <div id="grid-men" class="style-grid">
                <?php
                $men = [
                    ['Fade','fade','Sharp & Modern'],
                    ['Quiff','quiff','Voluminous & Dynamic'],
                    ['Buzz Cut','buzz_cut','Clean & Bold'],
                    ['Curly Top','curly_top','Textured & Energetic'],
                    ['Pompadour','pompadour','Classic & Polished'],
                    ['Side Part','side_part','Refined & Elegant'],
                ];
                foreach ($men as $s): ?>
                <div class="s-card" id="card-<?= htmlspecialchars($s[0]) ?>" onclick="selectStyle('<?= $s[0] ?>')">
                    <img class="s-img" src="assets/hairstyles/<?= $s[1] ?>.png" alt="<?= $s[0] ?>">
                    <h5><?= $s[0] ?></h5><span><?= $s[2] ?></span>
                </div>
                <?php endforeach; ?>
            </div>

            <div id="grid-women" class="style-grid" style="display:none">
                <?php
                $women = [
                    ['Bob Cut','bob_cut','Sleek & Professional'],
                    ['Beach Waves','beach_waves','Voluminous & Casual'],
                    ['Pixie Cut','pixie_cut','Bold & Minimalist'],
                ];
                foreach ($women as $s): ?>
                <div class="s-card" id="card-<?= htmlspecialchars($s[0]) ?>" onclick="selectStyle('<?= $s[0] ?>')">
                    <img class="s-img" src="assets/hairstyles/<?= $s[1] ?>.png" alt="<?= $s[0] ?>">
                    <h5><?= $s[0] ?></h5><span><?= $s[2] ?></span>
                </div>
                <?php endforeach; ?>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                <button class="btn-back" onclick="showStep('step-upload')"><i class="fa-solid fa-chevron-left"></i> Back</button>
                <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
                    <button class="btn-skip" onclick="startProcess(null)"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto-Pick Best</button>
                    <button id="btn-generate" class="btn-primary disabled" style="width:auto;padding:12px 24px">
                        Generate <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- STEP 3: Loading -->
        <div id="step-loading" class="step">
            <div class="loading-wrap">
                <div class="scan-box">
                    <img id="scan-img" src="#" alt="Processing">
                    <div class="scan-line"></div>
                </div>
                <h3 id="loading-label" style="font-weight:700;margin-bottom:8px">Processing…</h3>
                <p style="font-size:0.75rem;color:var(--text-dim);margin-bottom:24px">This usually takes 10–20 seconds.</p>
                <div class="log-box">
                    <div><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--accent-light)"></i> <span></span></div>
                    <div><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--accent-light)"></i> <span></span></div>
                    <div><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--accent-light)"></i> <span></span></div>
                    <div><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--accent-light)"></i> <span></span></div>
                    <div><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--accent-light)"></i> <span></span></div>
                </div>
            </div>
        </div>

        <!-- STEP 4: Result -->
        <div id="step-result" class="step">
            <h2 class="step-title">Your Result</h2>
            <p class="step-sub">Here's your personalized result.</p>
            <div id="result-container"></div>
        </div>

    </div>
</div>

<script src="app.js"></script>
</body>
</html>
