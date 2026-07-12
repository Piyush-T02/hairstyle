// ── State ──
let uploadedImageUrl = null;
let selectedStyle = null;
let selectedGender = null;
let currentFeature = null; // 'hairstyle' or 'color'
let currentUser = null; // { name, location, mobile, email, uses }
let otpVerified = false;

// ── Hairstyle categories ──
const MALE_STYLES = [
    { id: 'fade', name: 'Fade', icon: '💈', desc: 'Sharp & Clean' },
    { id: 'quiff', name: 'Quiff', icon: '💇‍♂️', desc: 'Voluminous Top' },
    { id: 'buzz', name: 'Buzz Cut', icon: '✂️', desc: 'Bold & Minimal' },
    { id: 'pompadour', name: 'Pompadour', icon: '🎩', desc: 'Classic Retro' },
    { id: 'undercut', name: 'Undercut', icon: '🔥', desc: 'Edgy & Modern' },
];
const FEMALE_STYLES = [
    { id: 'layers', name: 'Layers', icon: '✨', desc: 'Face-Framing' },
    { id: 'bob', name: 'Bob Cut', icon: '💇‍♀️', desc: 'Sleek & Chic' },
    { id: 'waves', name: 'Beach Waves', icon: '🌊', desc: 'Casual Volume' },
    { id: 'pixie', name: 'Pixie Cut', icon: '💫', desc: 'Bold & Short' },
    { id: 'bangs', name: 'Curtain Bangs', icon: '🎀', desc: 'Trendy & Soft' },
];

// ── Loading quotes ──
const QUOTES = [
    { text: "A woman who cuts her hair is about to change her life.", author: "— Coco Chanel" },
    { text: "Life is too short to have boring hair.", author: "— Unknown" },
    { text: "Invest in your hair. It's the crown you never take off.", author: "— Unknown" },
    { text: "Your hair is your best accessory.", author: "— Unknown" },
    { text: "Good hair speaks louder than words.", author: "— Unknown" },
    { text: "New hair, who dis?", author: "— Everyone, ever" },
    { text: "A great hairstyle is the best revenge.", author: "— Unknown" },
    { text: "Be your own kind of beautiful.", author: "— Unknown" },
];

// ── Init ──
window.addEventListener('DOMContentLoaded', () => {
    checkBackend();
    renderStyleGrids();
    loadUser();
});

function checkBackend() {
    fetch('api.php?action=health')
        .then(r => r.json())
        .then(data => {
            const b = document.getElementById('studio-badge');
            if (data.python_running) {
                b.textContent = 'Ready';
                b.className = 'studio-badge badge-ok';
            } else {
                b.textContent = 'Offline';
                b.className = 'studio-badge badge-err';
            }
        })
        .catch(() => {
            const b = document.getElementById('studio-badge');
            if(b){ b.textContent='Offline'; b.className='studio-badge badge-err'; }
        });
}

// ── User persistence ──
function loadUser() {
    const stored = localStorage.getItem('trekky_user');
    if (stored) {
        currentUser = JSON.parse(stored);
        otpVerified = true;
    }
}

function saveUser() {
    if (currentUser) localStorage.setItem('trekky_user', JSON.stringify(currentUser));
}

// ── Navigation ──
function openStudio(feature) {
    currentFeature = feature;
    document.getElementById('landing').style.display = 'none';
    document.getElementById('studio').classList.add('active');
    document.body.style.overflow = 'hidden';

    const t = document.getElementById('studio-feature-label');
    t.textContent = feature === 'color' ? 'Hair Color Analysis' : 'Hairstyle Try-On';

    // If user already registered, skip to upload
    if (currentUser && currentUser.uses > 0) {
        showStep('step-upload');
        updateUsageCounter();
    } else if (currentUser && currentUser.uses <= 0) {
        alert('You have used all 5 free transformations. Thank you for trying Trekky!');
        closeStudio();
    } else {
        showStep('step-register');
    }
}

function closeStudio() {
    document.getElementById('studio').classList.remove('active');
    document.getElementById('landing').style.display = 'block';
    document.body.style.overflow = '';
    resetAll();
}

function showStep(id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

// ── Registration & OTP ──
function sendOtp() {
    const email = document.getElementById('reg-email').value.trim();
    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address.');
        return;
    }

    const btn = document.getElementById('btn-send-otp');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    fetch('api.php?action=send_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            document.getElementById('otp-group').style.display = 'block';
            btn.textContent = 'Resend';
            btn.disabled = false;
            alert('OTP sent to ' + email + '! Check your inbox.');
        } else {
            alert('Failed to send OTP: ' + (data.error || 'Unknown error'));
            btn.textContent = 'Send OTP';
            btn.disabled = false;
        }
    })
    .catch(() => {
        alert('Failed to send OTP. Please check your connection.');
        btn.textContent = 'Send OTP';
        btn.disabled = false;
    });
}

function verifyOtp() {
    const email = document.getElementById('reg-email').value.trim();
    const otp = document.getElementById('reg-otp').value.trim();

    if (!otp || otp.length !== 6) {
        alert('Please enter the 6-digit OTP.');
        return;
    }

    const btn = document.getElementById('btn-verify-otp');
    btn.textContent = 'Verifying…';
    btn.disabled = true;

    fetch('api.php?action=verify_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            otpVerified = true;
            btn.textContent = '✓ Verified';
            btn.style.background = 'rgba(34,197,94,0.2)';
            btn.style.color = '#4ade80';
            document.getElementById('reg-otp').disabled = true;
            checkRegistrationReady();
        } else {
            alert('Invalid OTP. Please try again.');
            btn.textContent = 'Verify';
            btn.disabled = false;
        }
    })
    .catch(() => {
        alert('Verification failed. Please try again.');
        btn.textContent = 'Verify';
        btn.disabled = false;
    });
}

function checkRegistrationReady() {
    const name = document.getElementById('reg-name').value.trim();
    const location = document.getElementById('reg-location').value.trim();
    const mobile = document.getElementById('reg-mobile').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const btn = document.getElementById('btn-register');

    if (name && location && mobile && email && otpVerified) {
        btn.className = 'btn-primary enabled';
        btn.disabled = false;
        btn.onclick = completeRegistration;
    } else {
        btn.className = 'btn-primary disabled';
        btn.disabled = true;
        btn.onclick = null;
    }
}

// Attach listeners for checking readiness
['reg-name', 'reg-location', 'reg-mobile', 'reg-email'].forEach(id => {
    document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', checkRegistrationReady);
    });
});

function completeRegistration() {
    const name = document.getElementById('reg-name').value.trim();
    const location = document.getElementById('reg-location').value.trim();
    const mobile = document.getElementById('reg-mobile').value.trim();
    const email = document.getElementById('reg-email').value.trim();

    currentUser = { name, location, mobile, email, uses: 5 };
    saveUser();
    updateUsageCounter();
    showStep('step-upload');
}

function updateUsageCounter() {
    const el = document.getElementById('usage-counter');
    if (el && currentUser) {
        el.innerHTML = `<i class="fa-solid fa-bolt"></i> ${currentUser.uses} use${currentUser.uses !== 1 ? 's' : ''} remaining`;
    }
}

function decrementUsage() {
    if (currentUser) {
        currentUser.uses = Math.max(0, currentUser.uses - 1);
        saveUser();
        updateUsageCounter();
    }
}

// ── Gender selection ──
function selectGender(gender) {
    selectedGender = gender;
    document.getElementById('btn-male').classList.toggle('active', gender === 'male');
    document.getElementById('btn-female').classList.toggle('active', gender === 'female');

    const btn = document.getElementById('btn-next');
    btn.className = 'btn-primary enabled';
    btn.disabled = false;
    btn.onclick = goNext;
}

// ── File handling ──
function triggerFile() {
    if (!uploadedImageUrl) document.getElementById('file-input').click();
}

function triggerCamera() {
    if (!uploadedImageUrl) document.getElementById('camera-input').click();
}

function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('drop-zone').classList.add('dragover');
}
function handleDragLeave() {
    document.getElementById('drop-zone').classList.remove('dragover');
}
function handleDrop(e) {
    e.preventDefault();
    handleDragLeave();
    if (!uploadedImageUrl && e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
}
function handleFileSelect(e) {
    if (e.target.files.length) uploadFile(e.target.files[0]);
}

function uploadFile(file) {
    if (!file.type.startsWith('image/')) {
        alert("Error: Please upload a valid image file (JPEG, PNG, WEBP). Other file types are not allowed.");
        return;
    }
    if (file.size > 30 * 1024 * 1024) { alert('File too large — max 30 MB.'); return; }

    // Show preview
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('drop-zone').style.display = 'none';
        document.getElementById('preview-img').src = e.target.result;
        document.getElementById('preview-name').textContent = file.name;
        document.getElementById('preview-wrap').classList.add('show');
        document.getElementById('gender-wrap').style.display = 'block';
    };
    reader.readAsDataURL(file);

    // Upload to server
    const fd = new FormData();
    fd.append('image', file);
    fetch('api.php?action=upload', { method: 'POST', body: fd })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                uploadedImageUrl = data.image_url;
            } else {
                alert('Upload error: ' + data.error);
                resetUpload();
            }
        })
        .catch(() => { alert('Upload failed.'); resetUpload(); });
}

function goNext() {
    if (!uploadedImageUrl) { alert('Please upload a photo first.'); return; }
    if (!selectedGender) { alert('Please select your gender.'); return; }

    if (currentFeature === 'color') {
        // Color goes straight to processing
        startProcess(null);
    } else {
        // Show style selection for hairstyle
        document.getElementById('style-grid-male').style.display = selectedGender === 'male' ? 'grid' : 'none';
        document.getElementById('style-grid-female').style.display = selectedGender === 'female' ? 'grid' : 'none';
        showStep('step-style');
    }
}

function resetUpload() {
    uploadedImageUrl = null;
    selectedGender = null;
    document.getElementById('file-input').value = '';
    document.getElementById('camera-input').value = '';
    document.getElementById('drop-zone').style.display = 'block';
    document.getElementById('preview-wrap').classList.remove('show');
    document.getElementById('gender-wrap').style.display = 'none';
    document.getElementById('btn-male').classList.remove('active');
    document.getElementById('btn-female').classList.remove('active');
    const btn = document.getElementById('btn-next');
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate My Look';
    btn.className = 'btn-primary disabled';
    btn.disabled = true;
    btn.onclick = null;
}

function resetAll() {
    resetUpload();
    selectedStyle = null;
    if (currentUser && currentUser.uses > 0) {
        showStep('step-upload');
    } else {
        showStep('step-register');
    }
}

// ── Style grids ──
function renderStyleGrids() {
    const maleGrid = document.getElementById('style-grid-male');
    const femaleGrid = document.getElementById('style-grid-female');
    if (!maleGrid || !femaleGrid) return;

    maleGrid.innerHTML = MALE_STYLES.map(s => `
        <div class="s-card" id="card-${s.id}" onclick="selectStyle('${s.id}','${s.name}')">
            <div class="s-icon">${s.icon}</div>
            <h5>${s.name}</h5><span>${s.desc}</span>
        </div>`).join('');

    femaleGrid.innerHTML = FEMALE_STYLES.map(s => `
        <div class="s-card" id="card-${s.id}" onclick="selectStyle('${s.id}','${s.name}')">
            <div class="s-icon">${s.icon}</div>
            <h5>${s.name}</h5><span>${s.desc}</span>
        </div>`).join('');
}

function selectStyle(id, name) {
    document.querySelectorAll('.s-card').forEach(c => c.classList.remove('selected'));
    selectedStyle = name;
    const card = document.getElementById('card-' + id);
    if (card) card.classList.add('selected');

    const btn = document.getElementById('btn-generate');
    btn.className = 'btn-primary enabled';
    btn.disabled = false;
    btn.onclick = () => startProcess(selectedStyle);
}

// ── Processing ──
function startProcess(hairstyle) {
    if (!uploadedImageUrl) { alert('Please upload a photo first.'); return; }
    if (currentUser && currentUser.uses <= 0) {
        alert('You have used all 5 free transformations. Thank you for trying Trekky!');
        return;
    }

    showStep('step-loading');

    // Set scan preview
    document.getElementById('scan-img').src = document.getElementById('preview-img').src;
    const lbl = document.getElementById('loading-label');
    lbl.textContent = currentFeature === 'color' ? 'Analyzing Your Hair Color' : 'Crafting Your New Look';
    showLoadingQuote();

    const payload = { image_url: uploadedImageUrl, gender: selectedGender || 'male' };
    const endpoint = currentFeature === 'color' ? 'api.php?action=color' : 'api.php?action=swap';
    if (currentFeature !== 'color' && hairstyle) payload.hairstyle = hairstyle;

    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            decrementUsage();
            if (currentFeature === 'color' && data.color_analysis) {
                renderColorResult(data.color_analysis, data.result_url || null);
            } else if (data.result_url) {
                renderHairstyleResult(data.result_url, hairstyle);
            }
            showStep('step-result');
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
            showStep('step-upload');
        }
    })
    .catch(() => {
        alert('Connection error. Make sure the backend is running.');
        showStep('step-upload');
    });
}

function showLoadingQuote() {
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    const quoteEl = document.getElementById('loading-quote');
    const authorEl = document.getElementById('loading-quote-author');
    if (quoteEl) {
        quoteEl.textContent = `"${q.text}"`;
        quoteEl.style.animation = 'none';
        quoteEl.offsetHeight; // trigger reflow
        quoteEl.style.animation = 'fadeQuote 1s ease forwards';
    }
    if (authorEl) authorEl.textContent = q.author;
}

function renderHairstyleResult(url, style) {
    const c = document.getElementById('result-container');
    const label = style || 'AI-Recommended';
    c.innerHTML = `
        <div class="result-wrap">
            <img src="${url}" class="result-img" alt="Result">
            <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:16px">Style: <strong style="color:#fff">${label}</strong></p>
            <div class="result-actions">
                <button class="btn-download" onclick="downloadImg('${url}','${label}')">
                    <i class="fa-solid fa-download"></i> Download
                </button>
                <button class="btn-book" onclick="bookHairstyle('${label}')">
                    <i class="fa-solid fa-calendar-check"></i> Book This Hairstyle
                </button>
                <button class="btn-back" onclick="resetAll();showStep('step-upload')">
                    <i class="fa-solid fa-rotate-left"></i> Try Again
                </button>
            </div>
            <img src="logo.jpeg" class="result-logo" alt="Trekky">
        </div>`;
}

function renderColorResult(a, tryonUrl) {
    const c = document.getElementById('result-container');
    const bestSwatches = (a.best_colors||[]).map(cl => `
        <div class="swatch">
            <div class="swatch-circle" style="background:${cl.hex}"></div>
            <span>${cl.name}</span>
        </div>`).join('');
    const avoidSwatches = (a.avoid_colors||[]).map(cl => `
        <div class="swatch">
            <div class="swatch-circle" style="background:${cl.hex}"></div>
            <span>${cl.name}</span>
        </div>`).join('');
    const bestColorName = a.best_colors && a.best_colors[0] ? a.best_colors[0].name : 'Best Match';
    const tryonHtml = tryonUrl ? `
        <div style="text-align:center;margin-bottom:24px">
            <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:12px">Your best color: <strong style="color:#fff">${bestColorName}</strong></p>
            <img src="${tryonUrl}" class="result-img" alt="Color Try-On">
            <div class="result-actions" style="margin-top:12px">
                <button class="btn-download" onclick="downloadImg('${tryonUrl}','${bestColorName}')">
                    <i class="fa-solid fa-download"></i> Download
                </button>
                <button class="btn-book" onclick="bookHairstyle('${bestColorName} Color')">
                    <i class="fa-solid fa-calendar-check"></i> Book This Color
                </button>
            </div>
        </div>` : '';
    c.innerHTML = `
        <div class="color-result">
            <div style="text-align:center;margin-bottom:24px">
                <div style="display:inline-block;padding:6px 16px;border-radius:100px;background:rgba(45,212,191,0.1);border:1px solid rgba(45,212,191,0.2);color:var(--teal);font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
                    ${a.undertone || 'Warm'} &bull; ${a.season || 'Clear'}
                </div>
            </div>
            ${tryonHtml}
            <div class="color-section" style="border-color:rgba(45,212,191,0.2)">
                <h4><i class="fa-solid fa-check-circle" style="color:var(--teal)"></i> Best Hair Colors</h4>
                <div class="color-swatches">${bestSwatches}</div>
                <p style="margin-top:12px;font-size:0.75rem;color:var(--text-dim);line-height:1.5">${a.why_best||''}</p>
            </div>
            <div class="color-section" style="border-color:rgba(251,113,133,0.2)">
                <h4><i class="fa-solid fa-circle-xmark" style="color:var(--rose)"></i> Avoid These Colors</h4>
                <div class="color-swatches">${avoidSwatches}</div>
                <p style="margin-top:12px;font-size:0.75rem;color:var(--text-dim);line-height:1.5">${a.why_avoid||''}</p>
            </div>
            <div class="result-actions" style="margin-top:20px">
                <button class="btn-back" onclick="resetAll();showStep('step-upload')">
                    <i class="fa-solid fa-rotate-left"></i> Try Again
                </button>
            </div>
            <img src="logo.jpeg" class="result-logo" alt="Trekky">
        </div>`;
}

function bookHairstyle(style) {
    // Placeholder: redirect to salon booking page
    const userName = currentUser ? currentUser.name : 'Guest';
    const userMobile = currentUser ? currentUser.mobile : '';
    const userLocation = currentUser ? currentUser.location : '';
    alert(`🎉 Booking request for "${style}"!\n\nName: ${userName}\nMobile: ${userMobile}\nLocation: ${userLocation}\n\nA salon near you will contact you shortly!`);
    // In production, this would redirect to a booking system:
    // window.location.href = `https://your-salon-booking.com?style=${encodeURIComponent(style)}&name=${encodeURIComponent(userName)}&mobile=${encodeURIComponent(userMobile)}`;
}

function downloadImg(url, name) {
    const a = document.createElement('a');
    a.download = 'trekky-' + name.toLowerCase().replace(/\s+/g, '-') + '.jpg';
    a.href = url;
    a.click();
}
