#!/bin/bash
# Production start script for Python worker service on Railway

# Output immediately so Railway knows the script is running
echo "=== Python Worker Start Script ==="
echo "Script started at: $(date)"
echo "Current directory: $(pwd)"
echo "Script location: $0"
echo "PATH: $PATH"

# Try to source nix environment if available (Railway uses nixpacks)
if [ -f /nix/var/nix/profiles/default/etc/profile.d/nix.sh ]; then
    echo "Sourcing nix environment..."
    source /nix/var/nix/profiles/default/etc/profile.d/nix.sh
fi

# Enable strict error handling
set -e

# Define paths
BACKEND_DIR="backend"
VENV_DIR="$BACKEND_DIR/venv"
SERVICE_SCRIPT="service.py"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "ERROR: backend directory not found!"
    echo "Current directory contents:"
    ls -la
    exit 1
fi

# Check if venv directory exists, create it if missing
if [ ! -d "$VENV_DIR" ]; then
    echo "WARNING: Python virtual environment not found at $VENV_DIR"
    echo "Finding Python executable..."
    
    # Try to find Python - check common locations and PATH
    PYTHON_CMD=""
    if command -v python3 >/dev/null 2>&1; then
        PYTHON_CMD="python3"
        echo "Found python3 in PATH"
    elif command -v python >/dev/null 2>&1; then
        PYTHON_CMD="python"
        echo "Found python in PATH"
    else
        # Try to find Python in nix store (Railway uses nixpacks)
        echo "Python not in PATH, searching nix store..."
        PYTHON_CMD=$(find /nix/store -name python3 -type f 2>/dev/null | grep -E "python311|python3" | head -1)
        if [ -n "$PYTHON_CMD" ] && [ -x "$PYTHON_CMD" ]; then
            echo "Found Python in nix store: $PYTHON_CMD"
        else
            # Last resort: try common nix paths
            echo "Trying alternative search methods..."
            for path in /nix/store/*/bin/python3 /nix/store/*/bin/python; do
                if [ -x "$path" ] 2>/dev/null; then
                    PYTHON_CMD="$path"
                    echo "Found Python at: $PYTHON_CMD"
                    break
                fi
            done
            if [ -z "$PYTHON_CMD" ]; then
                echo "ERROR: Python executable not found"
                echo "PATH: $PATH"
                echo "Checking common locations..."
                ls -la /usr/bin/python* 2>&1 || true
                ls -la /usr/local/bin/python* 2>&1 || true
                echo "Searching for Python..."
                which python3 python 2>&1 || true
                exit 1
            fi
        fi
    fi
    
    echo "Using Python: $PYTHON_CMD"
    $PYTHON_CMD --version
    
    echo "Creating virtual environment..."
    cd "$BACKEND_DIR"
    $PYTHON_CMD -m venv venv
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to create virtual environment"
        echo "Backend directory contents:"
        ls -la
        exit 1
    fi
    echo "Installing Python dependencies..."
    source venv/bin/activate
    python -m pip install --upgrade pip
    python -m pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install Python dependencies"
        exit 1
    fi
    deactivate
    cd ..
    echo "✓ Virtual environment created and dependencies installed"
fi

# Determine Python executable (try python first, then python3)
PYTHON_EXEC=""
if [ -f "$VENV_DIR/bin/python" ]; then
    PYTHON_EXEC="$VENV_DIR/bin/python"
    echo "✓ Found Python executable: $PYTHON_EXEC"
elif [ -f "$VENV_DIR/bin/python3" ]; then
    PYTHON_EXEC="$VENV_DIR/bin/python3"
    echo "✓ Found Python executable: $PYTHON_EXEC"
else
    echo "ERROR: Python executable not found in venv!"
    echo "Expected location: $VENV_DIR/bin/python or $VENV_DIR/bin/python3"
    echo "Venv directory contents:"
    ls -la "$VENV_DIR/bin/" 2>&1 || echo "Cannot list venv bin directory"
    exit 1
fi

# Verify Python is executable
if [ ! -x "$PYTHON_EXEC" ]; then
    echo "ERROR: Python executable is not executable: $PYTHON_EXEC"
    echo "File permissions:"
    ls -la "$PYTHON_EXEC"
    exit 1
fi

# Check if service.py exists
if [ ! -f "$BACKEND_DIR/$SERVICE_SCRIPT" ]; then
    echo "ERROR: $SERVICE_SCRIPT not found in $BACKEND_DIR/"
    echo "Backend directory contents:"
    ls -la "$BACKEND_DIR/" || echo "Cannot list backend directory"
    exit 1
fi

# Verify Python can run (basic sanity check)
echo "Verifying Python installation..."
PYTHON_VERSION=$("$PYTHON_EXEC" --version 2>&1)
if [ $? -ne 0 ]; then
    echo "ERROR: Python executable failed to run: $PYTHON_EXEC"
    exit 1
fi
echo "✓ Python version: $PYTHON_VERSION"

# Change to backend directory (service.py expects to run from backend/)
echo "Changing to backend directory..."
cd "$BACKEND_DIR"

# Verify we're in the right place
if [ ! -f "$SERVICE_SCRIPT" ]; then
    echo "ERROR: $SERVICE_SCRIPT not found after changing to backend directory"
    echo "Current directory: $(pwd)"
    exit 1
fi

echo "✓ All checks passed"
echo "Starting Python worker service..."
echo ""

# Run the service script
# Use exec to replace shell process with Python process
# This ensures proper signal handling and exit code propagation
exec "$PYTHON_EXEC" "$SERVICE_SCRIPT"

