#!/bin/bash
# railway-run.sh - Runs at STARTUP to start both Python worker and Node.js server
# This runs EVERY TIME the service starts

set -e  # Exit on error

echo "==================== STARTING SERVICES ===================="
echo "🚀 Starting TrendOS Services..."
echo ""

# Set environment variables for production
export PYTHONUNBUFFERED=1
export PYTHONDONTWRITEBYTECODE=1

# Use the PORT environment variable that Railway provides
PORT=${PORT:-3000}
echo "📡 Server will run on port: $PORT"
echo "🌐 Database: ${DATABASE_URL:0:30}..."
echo ""

# Verify Python is available
echo "🐍 Python version:"
python3 --version || python --version

# Check if Node.js server build exists
if [ ! -f "dist/index.cjs" ]; then
  echo "❌ ERROR: Node.js server build not found at dist/index.cjs"
  exit 1
fi

# Check if Python service exists
if [ ! -f "backend/service.py" ]; then
  echo "❌ ERROR: Python service not found at backend/service.py"
  exit 1
fi

# Export Python path for Node.js to use (for manual scan trigger)
PYTHON_EXEC=$(which python3 || which python)
export PYTHON_EXECUTABLE="$PYTHON_EXEC"
echo "✓ Exported PYTHON_EXECUTABLE=$PYTHON_EXECUTABLE"

echo ""
echo "🔧 Starting Python worker (backend/service.py)..."
python3 backend/service.py &
PYTHON_PID=$!
echo "✓ Python worker started (PID: $PYTHON_PID)"

# Wait a moment for Python to initialize
sleep 2

echo ""
echo "🌐 Starting Node.js server (dist/index.cjs)..."
NODE_ENV=production PORT=$PORT node dist/index.cjs &
NODE_PID=$!
echo "✓ Node.js server started (PID: $NODE_PID)"

echo ""
echo "==================== SERVICES RUNNING ===================="
echo "📊 Python worker PID: $PYTHON_PID"
echo "🌐 Node.js server PID: $NODE_PID"
echo "📡 Listening on port: $PORT"
echo "Press Ctrl+C to stop all services"
echo "================================================"

# Graceful shutdown handler
trap "echo 'Shutting down services...'; kill $PYTHON_PID $NODE_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Wait for Node.js (keep container alive)
wait $NODE_PID
