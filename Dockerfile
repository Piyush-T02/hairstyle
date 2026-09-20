# Stage 1: Build React Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend & Final Runtime
FROM python:3.11-slim
WORKDIR /app



# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . ./
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port and run server
EXPOSE 5000
CMD ["sh", "-c", "python manage.py migrate && gunicorn trakky_backend.wsgi:application --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 120"]
