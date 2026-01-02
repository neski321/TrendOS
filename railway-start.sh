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
# Railpack: Python might not be in PATH at runtime, search for it
PYTHON_EXEC=""

# Try to use the Python path from build time
if [ -f ".python_runtime_path" ]; then
  BUILD_PYTHON=$(cat .python_runtime_path)
  if [ -x "$BUILD_PYTHON" ]; then
    PYTHON_EXEC="$BUILD_PYTHON"
    echo "Using Python from build: $PYTHON_EXEC"
  fi
fi

# Try /app/.local/bin where we might have copied it
if [ -z "$PYTHON_EXEC" ] && [ -x "/app/.local/bin/python3" ]; then
  PYTHON_EXEC="/app/.local/bin/python3"
  echo "Using Python from /app/.local/bin: $PYTHON_EXEC"
fi

# Try PATH
if [ -z "$PYTHON_EXEC" ]; then
  if command -v python3 &> /dev/null; then
    PYTHON_EXEC=$(command -v python3)
    echo "Using Python from PATH: $PYTHON_EXEC"
  elif command -v python &> /dev/null; then
    PYTHON_EXEC=$(command -v python)
    echo "Using Python from PATH: $PYTHON_EXEC"
  fi
fi

# Search common locations
if [ -z "$PYTHON_EXEC" ]; then
  for py in /usr/bin/python3 /usr/local/bin/python3 /opt/python/bin/python3 /usr/bin/python; do
    if [ -x "$py" ]; then
      PYTHON_EXEC="$py"
      echo "Found Python at: $PYTHON_EXEC"
      break
    fi
  done
fi

if [ -z "$PYTHON_EXEC" ]; then
  echo "❌ ERROR: Python not found in PATH or common locations"
  echo "Searched locations:"
  echo "  - .python_runtime_path file"
  echo "  - /app/.local/bin/python3"
  echo "  - PATH (python3/python)"
  echo "  - /usr/bin, /usr/local/bin, /opt/python"
  echo ""
  echo "Available executables in /usr/bin:"
  ls -la /usr/bin/python* 2>/dev/null || echo "  No python found"
  echo ""
  echo "Available executables in /app/.local/bin:"
  ls -la /app/.local/bin/ 2>/dev/null || echo "  Directory not found"
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
