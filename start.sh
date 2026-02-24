
#!/bin/bash
set -e

echo "=== Starting Ninja Image Creator ==="

# Start backend in background
echo "[1/2] Starting backend (FastAPI on port 8000)..."
cd /workspace/ninja-image-creator
uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "      Backend started (PID: $BACKEND_PID)"

# Start frontend in background
echo "[2/2] Starting frontend (Next.js on port 3000)..."
cd /workspace/ninja-image-creator/frontend
npm run dev &
FRONTEND_PID=$!
echo "      Frontend started (PID: $FRONTEND_PID)"
