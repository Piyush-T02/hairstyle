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

RUN chmod +x /app/railway_start.sh

# Run the startup script when the container launches
CMD ["/app/railway_start.sh"]
