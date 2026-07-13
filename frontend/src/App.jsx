import React, { useState, useEffect, useRef } from 'react';

const MALE_STYLES = [
  "Fade", "Quiff", "Buzz Cut", "Pompadour", "Undercut",
  "Textured Crop", "Side Part", "French Crop", "Crew Cut", "Mullet",
  "Slick Back", "Faux Hawk", "Comb Over", "Shag", "Ivy League"
];

const FEMALE_STYLES = [
  "Layers", "Bob Cut", "Beach Waves", "Pixie Cut", "Curtain Bangs",
  "Lob (Long Bob)", "Shag Cut", "Blunt Cut", "Butterfly Cut", "Wolf Cut",
  "Blunt Bangs", "Angled Bob", "Bixie", "Choppy Layers", "French Bob"
];

const QUOTES = [
  "Life is too short to have boring hair.", "Invest in your hair. It's the crown you never take off.",
  "Your hair is your best accessory.", "New hair, who dis?", "Be your own kind of beautiful.",
  "A good hair day keeps the doctor away.", "Life is short, make every hair flip count.",
  "Love is in the hair.", "Great hair doesn't happen by chance, it happens by appointment.",
  "Hair style is the final tip-off whether or not a woman really knows herself.",
  "I'm a queen crowned in my curls.", "Hair is a beautiful form of self-expression.",
  "Gorgeous hair is the best revenge.", "Let your hair do the talking.",
  "Life is more beautiful when you meet the right hairdresser.",
  "That's why her hair's so big, it's full of secrets.", "Good hair speaks louder than words.",
  "Happy hair, happy life.", "Bad hair day? I don't know her.",
  "Keep calm and love your hair.", "You can't expect to always have a good hair day!",
  "A woman who cuts her hair is about to change her life.", "Messy bun and getting stuff done.",
  "My hairstyle is called 'I tried'.", "Too glam to give a damn.",
  "First I drink the coffee, then I do the hair.", "Curls run the world.",
  "I don't need a hair stylist, my pillow gives me a new hairstyle every morning.",
  "Everything feels better after a haircut.", "Let your hair loose.",
  "Always make sure your hair is on point.", "Embrace your natural texture.",
  "Short hair, don't care.", "Long hair, don't care.", "New hair, new me.",
  "Your hair tells a story.", "Keep your head up and your hair fabulous.",
  "Confidence is the best hairstyle.", "Treat your hair like royalty.",
  "Find your perfect style.", "Your hair is a canvas.", "Make waves.",
  "Let your hair be your signature.", "Hair is jewelry. It's an accessory.",
  "Good hair days make me feel like I can rule the world.", "Shine bright like your hair.",
  "Play with your hair, not my heart.", "Beautiful hair starts with a healthy scalp.",
  "Transform your hair, transform your mood.", "Hair on point.", "Flawless hair.",
  "A bad hair day is just a day you haven't fixed yet.", "Stay fabulous.",
  "Your hair is the ball gown you never take off.", "Own your look.",
  "It's not just a haircut, it's an attitude.", "Style is a way to say who you are.",
  "Perfect hair, perfect day.", "Hair that turns heads.", "Unleash your inner beauty.",
  "Discover a new you.", "Your ideal look awaits.", "Step into your confidence.",
  "Let the magic happen.", "Crafting your perfect style.", "Precision and perfection.",
  "Every strand matters.", "Elevate your look.", "The ultimate hair transformation.",
  "Because you're worth it.", "Unlock your hair's potential.", "A masterpiece in the making.",
  "Where style meets AI.", "Redefining beauty.", "Your virtual salon experience.",
  "Effortless elegance.", "Bold and beautiful.", "Classic meets modern.",
  "Your hair, your rules.", "Create your own trend.", "Daring to be different.",
  "Style starts with hair.", "Slay every day.", "Confidence starts at the salon.",
  "Born to stand out.", "Dream hair, reality check.", "Wake up and slay.",
  "Hair goals achieved.", "Mirror, mirror on the wall...", "From drab to fab.",
  "Head-turning hair starts here.", "Your glow-up awaits.", "Hair so good it should be illegal.",
  "Looking good is feeling good.", "Styled to perfection.", "The best project you'll ever work on is you."
];

// Use relative URLs so it works both locally (with Vite proxy) and on Railway (same origin)
const API_BASE = '';

export default function App() {
  const [step, setStep] = useState('landing');
  const [user, setUser] = useState(null);

  // Registration
  const [regData, setRegData] = useState({ name: '', location: '', mobile: '', email: '' });
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otp, setOtp] = useState('');

  // Upload
  const [imageFile, setImageFile] = useState(null);   // local blob URL for preview
  const [imageUrl, setImageUrl] = useState('');        // server path
  const [gender, setGender] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  // Processing
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [result, setResult] = useState(null);    // single result object { url, style_name }

  // Fullscreen
  const [fullScreenImg, setFullScreenImg] = useState(null);

  // Load saved user from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('trakky_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    const interval = setInterval(() => {
      setQuoteIdx(i => (i + 1) % QUOTES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const goHome = () => {
    setStep('landing');
    setImageFile(null);
    setImageUrl('');
    setGender('');
    setSelectedStyle('');
    setResult(null);
  };

  const handleStart = () => {
    if (user && user.sessions > 0) {
      setStep('upload');
    } else if (user && user.sessions <= 0) {
      alert("You've used all 5 free sessions. Thank you for trying Trakky!");
    } else {
      setStep('register');
    }
  };

  // ============= OTP =============
  const handleSendOtp = async () => {
    if (!regData.email || !regData.email.includes('@')) return alert('Please enter a valid email.');
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/send_otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regData.email })
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        alert('OTP sent to ' + regData.email + '. Check your inbox!');
      } else {
        alert(data.error || 'Failed to send OTP');
      }
    } catch {
      alert('Network error. Please try again.');
    }
    setOtpLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) return alert('Please enter the OTP.');
    try {
      const res = await fetch(`${API_BASE}/api/verify_otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regData.email,
          mobile: regData.mobile,
          name: regData.name,
          location: regData.location,
          otp
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        localStorage.setItem('trakky_user', JSON.stringify(data.user));
        setUser(data.user);
        setStep('upload');
      } else {
        alert(data.error || 'Verification failed');
      }
    } catch {
      alert('Network error. Please try again.');
    }
  };

  // ============= UPLOAD (Gallery + Camera) =============
  const doUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed (JPEG, PNG, WebP, HEIC).');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      alert('File is too large. Maximum size is 30MB.');
      return;
    }

    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setImageUrl(data.image_url);
        setImageFile(URL.createObjectURL(file));
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch {
      alert('Upload failed. Please try again.');
    }
  };

  const handleFileChange = (e) => doUpload(e.target.files[0]);

  // ============= GENERATE =============
  const handleGenerate = async () => {
    if (!imageUrl) return alert('Please upload a photo first.');
    if (!gender) return alert('Please select your gender.');
    if (!selectedStyle) return alert('Please select a hairstyle.');

    setStep('loading');
    try {
      const res = await fetch(`${API_BASE}/api/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          gender,
          hairstyle: selectedStyle,
          email: user.email
        })
      });
      const data = await res.json();
      if (data.success && data.result) {
        setResult(data.result);
        // Update local sessions count
        const updatedUser = { ...user, sessions: data.sessionsRemaining };
        localStorage.setItem('trakky_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setStep('results');
      } else {
        alert(data.error || 'Generation failed');
        setStep('upload');
      }
    } catch {
      alert('Something went wrong. Please try again.');
      setStep('upload');
    }
  };

  // ============= RENDER =============

  // Landing
  if (step === 'landing') {
    return (
      <div className="landing-page">
        <div className="hero">
          <div className="hero-badge"><i className="fa-solid fa-sparkles"></i> Virtual Hair Studio</div>
          <h1>Your Perfect Look,<br/><span>Before the Salon</span></h1>
          <p>Try 15+ premium hairstyles tailored exactly to your face using advanced AI. Upload a photo, pick a style, see results instantly.</p>
          <button className="nav-cta hero-cta" onClick={handleStart}>
            <i className="fa-solid fa-camera"></i> Try It Free
          </button>
          {user && <p className="session-badge">{user.sessions} sessions remaining</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Fullscreen Image Viewer */}
      {fullScreenImg && (
        <div className="fullscreen-overlay" onClick={() => setFullScreenImg(null)}>
          <img src={fullScreenImg} alt="Full view" />
          <button className="fullscreen-close" onClick={() => setFullScreenImg(null)}>&times;</button>
        </div>
      )}

      {/* Logo — always clickable to go home */}
      <div className="app-header">
        <img src="/trakky-logo.png" alt="Trakky" className="app-logo" onClick={goHome} />
      </div>

      {/* =================== REGISTER =================== */}
      {step === 'register' && (
        <div className="reg-form">
          <h2 className="step-title">Get Started</h2>
          <p className="step-sub">Verify your email to unlock 5 free AI hairstyle sessions.</p>

          <div className="form-group">
            <label>Full Name</label>
            <input placeholder="Your name" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input placeholder="City" value={regData.location} onChange={e => setRegData({...regData, location: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Mobile Number</label>
            <input placeholder="10-digit mobile" type="tel" value={regData.mobile} onChange={e => setRegData({...regData, mobile: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Email (Gmail)</label>
            <div className="otp-row">
              <input placeholder="your@gmail.com" type="email" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} disabled={otpSent} />
              <button onClick={handleSendOtp} disabled={otpSent || otpLoading}>
                {otpLoading ? '...' : otpSent ? 'Sent ✓' : 'Send OTP'}
              </button>
            </div>
          </div>
          {otpSent && (
            <div className="form-group">
              <label>Verification Code</label>
              <div className="otp-row">
                <input placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} />
                <button onClick={handleVerifyOtp}>Verify</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== UPLOAD =================== */}
      {step === 'upload' && (
        <div>
          <h2 className="step-title">Upload Your Photo</h2>
          <p className="step-sub">{user?.sessions} session{user?.sessions !== 1 ? 's' : ''} remaining</p>

          {!imageFile ? (
            <div className="upload-options">
              {/* Hidden file inputs */}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
              <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={handleFileChange} />

              <div className="upload-btn-group">
                <button className="upload-option" onClick={() => fileRef.current?.click()}>
                  <i className="fa-solid fa-images"></i>
                  <span>Choose from Gallery</span>
                </button>
                <button className="upload-option" onClick={() => cameraRef.current?.click()}>
                  <i className="fa-solid fa-camera"></i>
                  <span>Take a Photo</span>
                </button>
              </div>
              <p className="upload-hint">Supports JPEG, PNG, WebP, HEIC — up to 30MB</p>
            </div>
          ) : (
            <div className="text-center">
              <img src={imageFile} className="preview-img" alt="Your photo" />
              <div className="mt-4">
                <button className="btn-secondary" onClick={() => { setImageFile(null); setImageUrl(''); setGender(''); setSelectedStyle(''); }}>
                  <i className="fa-solid fa-xmark"></i> Remove & Re-upload
                </button>
              </div>

              {/* Gender */}
              <div className="mt-4 mb-4">
                <h4 className="section-label">Select Gender</h4>
                <div className="gender-row">
                  <button className={`gender-btn ${gender === 'male' ? 'active' : ''}`} onClick={() => setGender('male')}>
                    <i className="fa-solid fa-mars"></i> Male
                  </button>
                  <button className={`gender-btn ${gender === 'female' ? 'active' : ''}`} onClick={() => setGender('female')}>
                    <i className="fa-solid fa-venus"></i> Female
                  </button>
                </div>
              </div>

              {/* Style Grid */}
              {gender && (
                <div>
                  <h4 className="section-label">Choose Your Style</h4>
                  <div className="style-grid">
                    {(gender === 'male' ? MALE_STYLES : FEMALE_STYLES).map(s => (
                      <div key={s} className={`s-card ${selectedStyle === s ? 'selected' : ''}`} onClick={() => setSelectedStyle(s)}>
                        <h5>{s}</h5>
                      </div>
                    ))}
                  </div>

                  {selectedStyle && (
                    <button className="btn-primary" onClick={handleGenerate}>
                      <i className="fa-solid fa-wand-magic-sparkles"></i> Generate My Look
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================== LOADING =================== */}
      {step === 'loading' && (
        <div className="loading-wrap">
          <div className="loading-spinner"></div>
          <h3>Creating your perfect {selectedStyle}...</h3>
          <p className="loading-quote">"{QUOTES[quoteIdx]}"</p>
          <p className="loading-time">This usually takes 30-60 seconds</p>
        </div>
      )}

      {/* =================== RESULT (Single Image) =================== */}
      {step === 'results' && result && (
        <div className="result-section">
          <h2 className="step-title">Your New Look</h2>
          <p className="step-sub">{selectedStyle} — Click the image to view full size</p>

          <div className="result-card">
            <img
              src={`${API_BASE}/${result.url}`}
              alt={result.style_name}
              className="result-image"
              onClick={() => setFullScreenImg(`${API_BASE}/${result.url}`)}
            />
          </div>

          <div className="result-actions">
            <a className="btn-download" href={`${API_BASE}/${result.url}`} download={`trakky_${selectedStyle.toLowerCase().replace(/\s/g, '_')}.jpg`}>
              <i className="fa-solid fa-download"></i> Download
            </a>
            <button className="btn-book" onClick={() => alert(`Booking request for "${selectedStyle}" sent! A salon near you will contact you soon.`)}>
              <i className="fa-solid fa-calendar-check"></i> Book This Style
            </button>
          </div>

          <div className="text-center mt-4">
            <button className="btn-secondary" onClick={() => { setImageFile(null); setImageUrl(''); setGender(''); setSelectedStyle(''); setResult(null); setStep('upload'); }}>
              <i className="fa-solid fa-arrow-rotate-right"></i> Try Another Style ({user?.sessions} left)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
