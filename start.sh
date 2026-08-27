#!/bin/bash
# Trakky AI — Virtual Salon (Django + React)

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "  Trakky AI Virtual Salon (Django + React)"
echo "=========================================="
echo ""

# Run migrations
"$DIR/venv/bin/python3" "$DIR/manage.py" migrate

# Start Django backend server
echo "Starting Django server at http://localhost:5000 ..."
"$DIR/venv/bin/python3" "$DIR/manage.py" runserver 0.0.0.0:5000
