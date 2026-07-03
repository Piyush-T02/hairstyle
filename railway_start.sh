#!/bin/bash
# Start the Python backend on port 5000 in the background (unbuffered so logs show up)
PYTHONUNBUFFERED=1 ./venv/bin/python3 -u app.py &

# Railway sets the PORT environment variable for web traffic.
PORT="${PORT:-8080}"

# Start the PHP frontend in the foreground with increased upload limits
php -d upload_max_filesize=30M -d post_max_size=35M -S 0.0.0.0:$PORT -t .
