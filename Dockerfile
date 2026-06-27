FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install PHP, Python, and OpenCV dependencies
RUN apt-get update && apt-get install -y \
    php-cli \
    python3 \
    python3-pip \
    python3-venv \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the app files
COPY . /app

# Install Python dependencies inside a virtual environment
RUN python3 -m venv venv
RUN ./venv/bin/pip install --no-cache-dir flask flask-cors opencv-python-headless numpy requests

# Create the startup script that runs both the Python API and PHP frontend
RUN echo '#!/bin/bash\n\
# Start the Python backend on port 5000 in the background\n\
./venv/bin/python3 app.py &\n\
\n\
# Railway sets the PORT environment variable for web traffic.\n\
PORT="${PORT:-8080}"\n\
\n\
# Start the PHP frontend in the foreground\n\
php -S 0.0.0.0:$PORT -t .\n\
' > /app/start.sh

RUN chmod +x /app/start.sh

# Run the startup script when the container launches
CMD ["/app/start.sh"]
