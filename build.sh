#!/usr/bin/env bash
# Build script for deployment (Render / Railway / Koyeb)
set -o errexit

echo "1. Building React Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "2. Installing Python Dependencies..."
pip install -r requirements.txt

echo "3. Running Database Migrations..."
python manage.py migrate
