#!/bin/bash
# Unified start script for Railway - runs both web and worker in one service

set -e

echo "=== Unified Service Start Script ==="
echo "Script started at: $(date)"
echo "Current directory: $(pwd)"

# Try to source nix environment if available (Railway uses nixpacks)
if [ -f /nix/var/nix/profiles/default/etc/profile.d/nix.sh ]; then
    echo "Sourcing nix environment..."
    source /nix/var/nix/profiles/default/etc/profile.d/nix.sh
fi

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
    echo "Creating virtual environment..."
    cd "$BACKEND_DIR"
    $PYTHON_EXEC -m venv venv
    source venv/bin/activate
    $PYTHON_EXEC -m pip install --upgrade pip
    $PYTHON_EXEC -m pip install -r requirements.txt
    deactivate
    cd ..
    PYTHON_EXEC="$VENV_DIR/bin/python3"
    echo "✓ Venv created and Python set to: $PYTHON_EXEC"
fi

if [ -z "$PYTHON_EXEC" ] || [ ! -x "$PYTHON_EXEC" ]; then
    echo "ERROR: Python executable not found or not executable"
    exit 1
fi

echo "Using Python: $PYTHON_EXEC"
$PYTHON_EXEC --version

# Check if Node.js server build exists
if [ ! -f "dist/index.cjs" ]; then
    echo "WARNING: dist/index.cjs not found, attempting to build..."
    npm run build || echo "Build failed, continuing anyway..."
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
cd "$BACKEND_DIR"
$PYTHON_EXEC "$SERVICE_SCRIPT" &
PYTHON_PID=$!
cd ..

# Wait a moment to ensure Python starts
sleep 3

# Check if Python process is still running
if ! kill -0 $PYTHON_PID 2>/dev/null; then
    echo "ERROR: Python worker failed to start"
    exit 1
fi

echo "✓ Python worker started (PID: $PYTHON_PID)"

# Start Node.js server in foreground (this keeps the service alive)
# When Node.js exits, the trap will cleanup Python
echo ""
echo "=== Starting Node.js Server ==="
if [ -f "dist/index.cjs" ]; then
    exec node dist/index.cjs
else
    echo "ERROR: dist/index.cjs not found"
    cleanup
    exit 1
fi
