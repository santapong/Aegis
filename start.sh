#!/bin/bash

# Aegis Autonomous Wealth OS - Startup Script
set -e

echo "=========================================="
echo "    Starting Aegis Autonomous Wealth OS   "
echo "=========================================="

echo "[1/3] Starting Database & Message Broker (Docker Compose)..."
cd infrastructure
docker-compose up -d
cd ..

echo "Waiting for PostgreSQL to be ready..."
sleep 3

echo "[2/3] Starting Backend API..."
# Load Virtual Environment if exists, else use standard python/uv depending on environment
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# We use uvicorn to run Litestar/FastAPI app in background
export PYTHONPATH=$(pwd)/backend/src:$PYTHONPATH
# Currently main is `app = Litestar(...)` defined in `backend/src/main.py`
nohup uvicorn main:app --app-dir backend/src --host 0.0.0.0 --port 8000 --reload > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend running (PID: $BACKEND_PID) on http://localhost:8000"

echo "[3/3] Starting React/Next.js Frontend..."
cd frontend
if [ -f "bun.lock" ]; then
    nohup bun run dev > ../frontend.log 2>&1 &
elif [ -f "package-lock.json" ]; then
    nohup npm run dev > ../frontend.log 2>&1 &
elif [ -f "yarn.lock" ]; then
    nohup yarn dev > ../frontend.log 2>&1 &
else
    nohup npm start > ../frontend.log 2>&1 &
fi
FRONTEND_PID=$!
cd ..
echo "Frontend running (PID: $FRONTEND_PID) on http://localhost:3000 (check frontend.log for actual port)"

echo "=========================================="
echo " Aegis OS is currently running in the background."
echo " - Backend PID: $BACKEND_PID"
echo " - Frontend PID: $FRONTEND_PID"
echo " - Infrastructure: Docker containers"
echo " "
echo " Use 'kill $BACKEND_PID $FRONTEND_PID' and 'docker-compose down' in infrastructure/ to stop."
echo "=========================================="
