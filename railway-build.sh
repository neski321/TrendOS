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

# Install/upgrade pip (Railway's Python might not have pip installed)
echo ""
echo "📦 Setting up pip..."
# First ensure pip is installed using ensurepip
python3 -m ensurepip --upgrade 2>/dev/null || echo "ensurepip not needed, pip already available"
# Then upgrade pip
python3 -m pip install --upgrade pip --quiet || pip install --upgrade pip --quiet

# Install Python dependencies
echo ""
echo "📦 Installing Python dependencies..."
cd backend
python3 -m pip install -r requirements.txt --quiet || pip install -r requirements.txt --quiet
cd ..

echo ""
echo "✅ Build complete!"
echo "📋 Components:"
echo "  - Node.js server (Express)"
echo "  - Python worker (Trend Scanner)"
echo "  - PostgreSQL database (NeonDB)"
echo "  - Multi-API YouTube integration"
echo "  - Real-time trend scoring"
echo "==================== BUILD COMPLETE ===================="
