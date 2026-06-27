# 🚀 Strand — Deployment Guide

## Cost Per Feature

| Feature | Model Used | Cost per Use |
|---|---|---|
| **Hairstyle Try-On** | gpt-image-2 (512×512) | **~₹1.3** (~$0.016) |
| **Hair Color Analysis** | gpt-4o-mini vision (text) | **~₹0.10** (~$0.001) |

> Color analysis uses a **text model** that just looks at the photo and returns JSON — NO image generation at all. That's why it's 13x cheaper.

---

## How to Run Locally

Open **two terminals**, both in `/home/piyush/Downloads/hi`:

### Terminal 1 — Python Backend
```bash
venv/bin/python3 app.py
```

### Terminal 2 — PHP Frontend
```bash
php -S 0.0.0.0:8080 -t .
```

Then open **http://localhost:8080**

---

## Deployment Options (Cheapest → Most Control)

### Option 1: Railway.app (Easiest, ~$5/month)
- Deploy both PHP + Python as separate services
- Free tier: 500 hours/month (enough for demo)
- Steps:
  1. Push code to GitHub
  2. Connect Railway to your repo
  3. Create 2 services: one for PHP, one for Python
  4. Set `OPENAI_API_KEY` as environment variable

### Option 2: DigitalOcean Droplet ($6/month)
- Full VPS, run everything on one server
- Steps:
  1. Create Ubuntu droplet ($6/month)
  2. Install PHP, Python, nginx
  3. Upload code via `scp` or git
  4. Use `nginx` as reverse proxy
  5. Use `systemd` to run `app.py` as a service

### Option 3: Oracle Cloud Free Tier (FREE forever)
- 1 GB RAM VM, always free
- Same setup as DigitalOcean but $0/month
- Steps:
  1. Sign up at cloud.oracle.com
  2. Create free ARM instance
  3. Install PHP, Python, nginx
  4. Deploy same way

### Option 4: Render.com (Free tier available)
- Python backend as Web Service (free tier)
- PHP can be tricky — may need to convert frontend to static HTML
- Good for the Python backend specifically

---

## Recommended: DigitalOcean or Oracle (Best for PHP + Python)

For your specific stack (PHP frontend + Python Flask backend), a **single VPS** is the simplest approach. Here's the full setup:

### Quick Deploy to VPS (DigitalOcean/Oracle/any Ubuntu server)

```bash
# 1. SSH into your server
ssh root@YOUR_SERVER_IP

# 2. Install dependencies
apt update && apt install -y python3 python3-pip python3-venv php nginx

# 3. Clone/upload your code
mkdir -p /var/www/strand
# Upload your files here (scp, git clone, etc.)

# 4. Set up Python venv
cd /var/www/strand
python3 -m venv venv
venv/bin/pip install flask flask-cors opencv-python-headless numpy requests

# 5. Create your API key file
echo "sk-proj-YOUR_KEY_HERE" > /var/www/strand/chatgpt.token

# 6. Create systemd service for Python backend
cat > /etc/systemd/system/strand-backend.service << 'EOF'
[Unit]
Description=Strand Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/strand
ExecStart=/var/www/strand/venv/bin/python3 app.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable strand-backend
systemctl start strand-backend

# 7. Configure nginx
cat > /etc/nginx/sites-available/strand << 'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    root /var/www/strand;
    index index.php;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
EOF

# Install PHP-FPM
apt install -y php-fpm
ln -s /etc/nginx/sites-available/strand /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 8. Set permissions
chown -R www-data:www-data /var/www/strand
chmod -R 755 /var/www/strand
```

Your site will be live at `http://YOUR_SERVER_IP`!

---

## Files Structure for Deployment

```
strand/
├── index.php          # Frontend (main page)
├── api.php            # PHP API proxy
├── app.py             # Python Flask backend
├── app.js             # Frontend JavaScript
├── style.css          # Frontend styles
├── chatgpt.token      # OpenAI API key (keep secret!)
├── assets/            # Hairstyle images
│   └── hairstyles/
├── uploads/           # User uploads (auto-created)
└── venv/              # Python virtual environment
```

## Security Checklist Before Deploy
- [ ] Add `.htaccess` or nginx rule to block access to `chatgpt.token`
- [ ] Add `.htaccess` or nginx rule to block access to `*.py` files
- [ ] Enable HTTPS (use Let's Encrypt: `certbot --nginx`)
- [ ] Set file upload limits in PHP config
