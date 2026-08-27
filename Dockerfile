FROM python:3.12-slim

# Install OpenCV system libraries and Node.js for React build
RUN apt-get update && apt-get install -y \
    curl \
    libgl1 \
    libglib2.0-0 \
    --no-install-recommends && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python requirements & install
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy frontend and build static assets
COPY frontend ./frontend
RUN cd frontend && npm install && npm run build && mv dist ../public && cd .. && rm -rf frontend

# Copy full application code
COPY . .

# Ensure upload directory exists
RUN mkdir -p uploads staticfiles

# Apply migrations
RUN python manage.py migrate

EXPOSE 5000

ENV PORT=5000

# Start Gunicorn server binding to Railway PORT
CMD ["sh", "-c", "gunicorn trakky_backend.wsgi:application --bind 0.0.0.0:${PORT:-5000} --workers 3 --timeout 120"]
