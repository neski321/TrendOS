#!/bin/bash
# Unified start script - runs both web and worker in one service
# Works for both local development and Railway deployment

set -e

echo "=== Unified Service Start Script ==="
echo "Script started at: $(date)"
echo "Current directory: $(pwd)"

# Try to source nix environment if available (Railway uses nixpacks)
if [ -f /nix/var/nix/profiles/default/etc/profile.d/nix.sh ]; then
    echo "Sourcing nix environment..."
    source /nix/var/nix/profiles/default/etc/profile.d/nix.sh
fi

# Check for required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  WARNING: DATABASE_URL not set. Checking for .env file..."
    if [ -f "backend/.env" ]; then
        echo "✓ Found backend/.env file"
        # Load .env file (basic parsing)
        export $(grep -v '^#' backend/.env | xargs)
    elif [ -f ".env" ]; then
        echo "✓ Found .env file in root"
        export $(grep -v '^#' .env | xargs)
    else
        echo "❌ ERROR: DATABASE_URL not set and no .env file found"
        echo "Please set DATABASE_URL or create a .env file"
        exit 1
    fi
fi

# Set PORT if not provided (default to 3000 for local, Railway will override)
export PORT=${PORT:-3000}
echo "📡 Server will run on port: $PORT"

# Define paths
BACKEND_DIR="backend"
VENV_DIR="$BACKEND_DIR/venv"
SERVICE_SCRIPT="service.py"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "ERROR: backend directory not found!"
    exit 1
fi

# Find Python executable (same logic as worker script)
PYTHON_EXEC=""
if [ -f "$VENV_DIR/bin/python3" ]; then
    PYTHON_EXEC="$VENV_DIR/bin/python3"
    echo "✓ Found venv Python: $PYTHON_EXEC"
elif [ -f "$VENV_DIR/bin/python" ]; then
    PYTHON_EXEC="$VENV_DIR/bin/python"
    echo "✓ Found venv Python (alt): $PYTHON_EXEC"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_EXEC="python3"
    echo "✓ Found python3 in PATH"
elif command -v python >/dev/null 2>&1; then
    PYTHON_EXEC="python"
    echo "✓ Found python in PATH"
else
    # Try to find Python in nix store
    echo "Python not in PATH, searching nix store..."
    PYTHON_EXEC=$(find /nix/store -name python3 -type f 2>/dev/null | grep -E "python311|python3" | head -1)
    if [ -n "$PYTHON_EXEC" ] && [ -x "$PYTHON_EXEC" ]; then
        echo "✓ Found Python in nix store: $PYTHON_EXEC"
    else
        # Try glob pattern
        for path in /nix/store/*/bin/python3 /nix/store/*/bin/python; do
            if [ -x "$path" ] 2>/dev/null; then
                PYTHON_EXEC="$path"
                echo "✓ Found Python at: $PYTHON_EXEC"
                break
            fi
        done
    fi
fi

# Create venv if it doesn't exist
if [ ! -d "$VENV_DIR" ] && [ -n "$PYTHON_EXEC" ]; then
    echo ""
    echo "=== Creating Python Virtual Environment ==="
    cd "$BACKEND_DIR"
    $PYTHON_EXEC -m venv venv
    source venv/bin/activate
    echo "✓ Upgrading pip..."
    $PYTHON_EXEC -m pip install --upgrade pip --quiet
    echo "✓ Installing Python dependencies..."
    $PYTHON_EXEC -m pip install -r requirements.txt --quiet
    deactivate
    cd ..
    PYTHON_EXEC="$VENV_DIR/bin/python3"
    echo "✓ Venv created and Python set to: $PYTHON_EXEC"
fi

# Activate venv if it exists (for proper Python path)
if [ -d "$VENV_DIR" ] && [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
    PYTHON_EXEC="$VENV_DIR/bin/python3"
    echo "✓ Activated virtual environment"
fi

if [ -z "$PYTHON_EXEC" ] || [ ! -x "$PYTHON_EXEC" ]; then
    echo "ERROR: Python executable not found or not executable"
    exit 1
fi

echo "Using Python: $PYTHON_EXEC"
$PYTHON_EXEC --version

# Export Python path for Node.js to use (for manual scan trigger)
export PYTHON_EXECUTABLE="$PYTHON_EXEC"
echo "Exported PYTHON_EXECUTABLE=$PYTHON_EXECUTABLE for Node.js"

# Check if Node.js dependencies are installed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "=== Installing Node.js Dependencies ==="
    npm install
    echo "✓ Node.js dependencies installed"
fi

# Check if we should use development mode (no build needed)
USE_DEV_MODE=${USE_DEV_MODE:-false}
if [ "$USE_DEV_MODE" = "true" ] || [ "$NODE_ENV" = "development" ]; then
    echo ""
    echo "=== Development Mode ==="
    echo "Using tsx to run TypeScript directly (no build required)"
    USE_DEV_MODE=true
else
    # Production mode - check if build exists
    if [ ! -f "dist/index.cjs" ]; then
        echo ""
        echo "=== Building Node.js Application ==="
        echo "dist/index.cjs not found, building..."
        if npm run build; then
            echo "✓ Build successful"
        else
            echo "❌ ERROR: Build failed"
            echo "Please run 'npm run build' manually to see detailed errors"
            exit 1
        fi
    fi
    USE_DEV_MODE=false
fi

# Function to handle shutdown
cleanup() {
    echo ""
    echo "=== Shutting down ==="
    if [ -n "$PYTHON_PID" ] && kill -0 $PYTHON_PID 2>/dev/null; then
        echo "Stopping Python worker (PID: $PYTHON_PID)..."
        kill $PYTHON_PID 2>/dev/null || true
        wait $PYTHON_PID 2>/dev/null || true
    fi
    exit 0
}

# Trap signals to cleanup
trap cleanup SIGTERM SIGINT

# Start Python worker in background
echo ""
echo "=== Starting Python Worker ==="

# Set Python environment variables
export PYTHONUNBUFFERED=1
export PYTHONDONTWRITEBYTECODE=1

# Change to backend directory and start service
cd "$BACKEND_DIR"

# Use venv Python if available (relative path from backend directory)
if [ -f "venv/bin/python3" ]; then
    PYTHON_EXEC="venv/bin/python3"
elif [ -f "venv/bin/python" ]; then
    PYTHON_EXEC="venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_EXEC="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_EXEC="python"
else
    echo "❌ ERROR: Python executable not found"
    cd ..
    exit 1
fi

echo "Starting: $PYTHON_EXEC $SERVICE_SCRIPT"
$PYTHON_EXEC "$SERVICE_SCRIPT" &
PYTHON_PID=$!
cd ..

# Wait a moment to ensure Python starts
sleep 3

# Check if Python process is still running
if ! kill -0 $PYTHON_PID 2>/dev/null; then
    echo "❌ ERROR: Python worker failed to start"
    echo "Check the logs above for errors"
    exit 1
fi

echo "✓ Python worker started (PID: $PYTHON_PID)"

# Start Node.js server in foreground (this keeps the service alive)
# When Node.js exits, the trap will cleanup Python
echo ""
echo "=== Starting Node.js Server ==="
if [ "$USE_DEV_MODE" = "true" ]; then
    # Development mode - run TypeScript directly with tsx
    export NODE_ENV=development
    echo "Starting Node.js server in DEVELOPMENT mode (NODE_ENV=$NODE_ENV, PORT=$PORT)..."
    echo "Changes to server code will be picked up automatically"
    echo ""
    echo "==================== SERVICES RUNNING ===================="
    echo "📊 Python worker PID: $PYTHON_PID"
    echo "🌐 Node.js server starting on port: $PORT (dev mode)"
    echo "Press Ctrl+C to stop all services"
    echo "========================================================"
    echo ""
    exec npm run dev
elif [ -f "dist/index.cjs" ]; then
    # Production mode - run built file
    export NODE_ENV=${NODE_ENV:-production}
    echo "Starting Node.js server in PRODUCTION mode (NODE_ENV=$NODE_ENV, PORT=$PORT)..."
    echo ""
    echo "==================== SERVICES RUNNING ===================="
    echo "📊 Python worker PID: $PYTHON_PID"
    echo "🌐 Node.js server starting on port: $PORT"
    echo "Press Ctrl+C to stop all services"
    echo "========================================================"
    echo ""
    exec node dist/index.cjs
else
    echo "❌ ERROR: dist/index.cjs not found"
    echo "Please run 'npm run build' first, or set USE_DEV_MODE=true for development"
    cleanup
    exit 1
fi
