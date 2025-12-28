#!/bin/bash

# Development script to run both backend and frontend
# Usage: ./dev.sh

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Store PIDs for cleanup
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo "Shutting down..."

    if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null
    fi

    if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null
    fi

    wait 2>/dev/null
    echo "Done."
    exit 0
}

trap cleanup SIGINT SIGTERM

cd "$SCRIPT_DIR"

echo "Starting SHARP development servers..."
echo ""

# Start backend
echo "[Backend] Starting on http://localhost:8765"
uv run sharp serve &
BACKEND_PID=$!

# Start frontend
echo "[Frontend] Starting on http://localhost:5173"
cd frontend && bun run dev &
FRONTEND_PID=$!

echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait
