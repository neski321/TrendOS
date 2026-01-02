#!/bin/bash
# railway-build.sh - Runs during Railway BUILD PHASE to set up Python environment
# This runs ONCE during deployment build, not at startup

set -e  # Exit on error

echo "==================== BUILD PHASE ===================="
echo "🚀 Building TrendOS Application..."
echo ""

# Set environment variables for build
export PYTHONUNBUFFERED=1
export PYTHONDONTWRITEBYTECODE=1

# Verify Python is available
echo "🐍 Checking Python version..."
python3 --version || python --version

# Store Python location for runtime
PYTHON_BUILD=$(which python3 || which python)
echo "Python at build time: $PYTHON_BUILD"
echo "$PYTHON_BUILD" > .python_runtime_path

# Ensure pip is available (Railpack doesn't include it by default)
echo ""
echo "📦 Setting up pip..."
if ! command -v pip &> /dev/null; then
    echo "pip not found, bootstrapping..."
    curl -sS https://bootstrap.pypa.io/get-pip.py | python3 - --break-system-packages
fi

# Install Python dependencies (Railpack uses externally-managed Python)
echo ""
echo "📦 Installing Python dependencies..."
cd backend
pip install --upgrade pip --break-system-packages
pip install -r requirements.txt --break-system-packages
cd ..

# Copy Python to a persistent location that will be in runtime
echo ""
echo "📦 Ensuring Python is available at runtime..."
# Create a symlink or copy Python executable to a location that persists
if [ -x "$PYTHON_BUILD" ]; then
  mkdir -p /app/.local/bin
  cp "$PYTHON_BUILD" /app/.local/bin/python3 2>/dev/null || ln -sf "$PYTHON_BUILD" /app/.local/bin/python3 2>/dev/null || echo "Cannot copy Python, will rely on system path"
  echo "Python backed up to: /app/.local/bin/python3"
fi

echo ""
echo "✅ Build complete!"
echo "📋 Components:"
echo "  - Node.js server (Express)"
echo "  - Python worker (Trend Scanner)"
echo "  - PostgreSQL database (NeonDB)"
echo "  - Multi-API YouTube integration"
echo "  - Real-time trend scoring"
echo "==================== BUILD COMPLETE ===================="
