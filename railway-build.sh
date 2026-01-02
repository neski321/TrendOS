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

# Install Python dependencies (exactly like E-Commerce app)
echo ""
echo "📦 Installing Python dependencies..."
cd backend
pip install --upgrade pip
pip install -r requirements.txt
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
