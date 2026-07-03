// ── State ──
let uploadedImageUrl = null;
let selectedStyle = null;
let currentFeature = null; // 'hairstyle' or 'color'

// ── Init ──
window.addEventListener('DOMContentLoaded', () => { checkBackend(); });

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

// ── Navigation ──
function openStudio(feature) {
    currentFeature = feature;
    document.getElementById('landing').style.display = 'none';
    document.getElementById('studio').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Update studio title
    const t = document.getElementById('studio-feature-label');
    t.textContent = feature === 'color' ? 'Hair Color Analysis' : 'Hairstyle Try-On';

    // Show/hide style step for color analysis (not needed)
    showStep('step-upload');
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
    };
    reader.readAsDataURL(file);

    // Upload to server
    const btn = document.getElementById('btn-next');
    btn.textContent = 'Uploading…';
    btn.className = 'btn-primary disabled';

    const fd = new FormData();
    fd.append('image', file);
    fetch('api.php?action=upload', { method: 'POST', body: fd })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                uploadedImageUrl = data.image_url;
                btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continue';
                btn.className = 'btn-primary enabled';
                btn.onclick = goNext;
            } else {
                alert('Upload error: ' + data.error);
                resetUpload();
            }
        })
        .catch(() => { alert('Upload failed.'); resetUpload(); });
}

function goNext() {
    startProcess(null);
}

function resetUpload() {
    uploadedImageUrl = null;
    document.getElementById('file-input').value = '';
    document.getElementById('camera-input').value = '';
    document.getElementById('drop-zone').style.display = 'block';
    document.getElementById('preview-wrap').classList.remove('show');
    const btn = document.getElementById('btn-next');
    btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continue';
    btn.className = 'btn-primary disabled';
    btn.onclick = null;
}

function resetAll() {
    resetUpload();
    showStep('step-upload');
}



// ── Processing ──
function startProcess(hairstyle) {
    if (!uploadedImageUrl) { alert('Please upload a photo first.'); return; }
    showStep('step-loading');

    // Set scan preview
    document.getElementById('scan-img').src = document.getElementById('preview-img').src;
    const lbl = document.getElementById('loading-label');
    lbl.textContent = currentFeature === 'color' ? 'Analyzing Your Hair Color' : 'Applying Your Hairstyle';
    animateLogs();

    const payload = { image_url: uploadedImageUrl };
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

function renderHairstyleResult(url, style) {
    const c = document.getElementById('result-container');
    const label = style || 'Best Match';
    c.innerHTML = `
        <div class="result-wrap">
            <img src="${url}" class="result-img" alt="Result">
            <p style="font-size:0.75rem;color:var(--text-dim);margin-bottom:16px">Style: ${label}</p>
            <div class="result-actions">
                <button class="btn-download" onclick="downloadImg('${url}','${label}')">
                    <i class="fa-solid fa-download"></i> Download
                </button>
                <button class="btn-back" onclick="resetAll();showStep('step-upload')">
                    <i class="fa-solid fa-rotate-left"></i> Try Again
                </button>
            </div>
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
            <button class="btn-download" style="margin:12px auto 0" onclick="downloadImg('${tryonUrl}','${bestColorName}')">
                <i class="fa-solid fa-download"></i> Download
            </button>
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
        </div>`;
}

function downloadImg(url, name) {
    const a = document.createElement('a');
    a.download = 'strand-' + name.toLowerCase().replace(/\s+/g, '-') + '.jpg';
    a.href = url;
    a.click();
}

// ── Log animation ──
function animateLogs() {
    const logs = document.querySelectorAll('.log-box div');
    logs.forEach(l => l.style.opacity = '0');
    const labels = currentFeature === 'color'
        ? ['Detecting face region…', 'Analyzing skin undertone…', 'Finding best hair color…', 'Generating your try-on…', 'Almost there…']
        : ['Detecting face region…', 'Analyzing face shape…', 'Selecting best hairstyle…', 'Applying style changes…', 'Finalizing result…'];
    logs.forEach((l, i) => {
        l.querySelector('span').textContent = labels[i] || '';
        setTimeout(() => l.style.opacity = '1', (i + 1) * 600);
    });
}
