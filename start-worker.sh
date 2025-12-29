#!/bin/bash
# Production start script for Python worker service on Railway

# Output immediately so Railway knows the script is running
echo "=== Python Worker Start Script ==="
echo "Script started at: $(date)"
echo "Current directory: $(pwd)"
echo "Script location: $0"

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
    echo "Creating virtual environment..."
    cd "$BACKEND_DIR"
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to create virtual environment"
        echo "Backend directory contents:"
        ls -la
        exit 1
    fi
    echo "Installing Python dependencies..."
    source venv/bin/activate
    python3 -m pip install --upgrade pip
    python3 -m pip install -r requirements.txt
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

