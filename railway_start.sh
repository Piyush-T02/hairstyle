#!/bin/bash
# Railway startup script for Django backend

python manage.py migrate

PORT="${PORT:-5000}"
gunicorn trakky_backend.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 120
