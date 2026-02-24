#!/bin/bash
set -e

echo "=== Setting up Ninja Image Creator ==="

# 1. Backend Python deps
echo "[1/3] Installing backend Python dependencies..."
cd /workspace/ninja-image-creator
pip install -r backend/requirements.txt

# 2. Root-level Python deps (CLI tools etc.)
echo "[2/3] Installing root-level Python dependencies..."
pip install -r requirements.txt

# 3. Frontend Node deps
echo "[3/3] Installing frontend Node.js dependencies..."
cd /workspace/ninja-image-creator/frontend
npm install

echo "=== All dependencies installed. Ready to start the app. ==="
