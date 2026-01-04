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

# Set library path for numpy/pandas C extensions
export LD_LIBRARY_PATH="/nix/store/*-gcc-*/lib:/nix/store/*-glibc-*/lib:$LD_LIBRARY_PATH"
echo "✓ Library path configured for C++ dependencies"

# Use the PORT environment variable that Railway provides
PORT=${PORT:-3000}
echo "📡 Server will run on port: $PORT"
echo "🌐 Database: ${DATABASE_URL:0:30}..."
echo ""

# Verify Python is available
echo "🐍 Python version:"
# With Metal OFF, Python should persist from build
PYTHON_EXEC=""

if command -v python3 &> /dev/null; then
  PYTHON_EXEC=$(command -v python3)
  echo "Using Python from PATH: $PYTHON_EXEC"
elif command -v python &> /dev/null; then
  PYTHON_EXEC=$(command -v python)
  echo "Using Python from PATH: $PYTHON_EXEC"
else
  # Search common locations
  for py in /usr/bin/python3 /usr/local/bin/python3 /opt/python/bin/python3 /usr/bin/python; do
    if [ -x "$py" ]; then
      PYTHON_EXEC="$py"
      echo "Found Python at: $PYTHON_EXEC"
      break
    fi
  done
fi

if [ -z "$PYTHON_EXEC" ]; then
  echo "❌ ERROR: Python not found"
  echo "Available in /usr/bin:"
  ls -la /usr/bin/python* 2>/dev/null || echo "  No python found"
  echo ""
  echo "PATH contents:"
  echo "$PATH"
  exit 1
fi

$PYTHON_EXEC --version

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
export PYTHON_EXECUTABLE="$PYTHON_EXEC"
echo "✓ Exported PYTHON_EXECUTABLE=$PYTHON_EXECUTABLE"

echo ""
echo "🔧 Starting Python worker (backend/service.py)..."
$PYTHON_EXEC backend/service.py &
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
