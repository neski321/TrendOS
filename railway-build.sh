#!/bin/bash
# Railway-optimized build script
# This script is designed to work in Railway's build environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_log() {
    local color=$1
    local prefix=$2
    shift 2
    echo -e "${color}[${prefix}]${NC} $@"
}

print_log "$CYAN" "BUILD" "Starting Railway build process..."
echo ""

# Step 1: Install Node.js dependencies
print_log "$BLUE" "STEP 1" "Installing Node.js dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_log "$GREEN" "✓" "Node.js dependencies installed"
else
    print_log "$RED" "ERROR" "Failed to install Node.js dependencies"
    exit 1
fi
echo ""

# Step 2: Set up Python environment
print_log "$BLUE" "STEP 2" "Setting up Python environment..."

# Check if Python is available (Railway should have it, but check anyway)
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    print_log "$YELLOW" "WARNING" "Python not found in PATH, but continuing (Railway may install it later)"
    PYTHON_CMD="python3"
fi

cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_log "$YELLOW" "INFO" "Creating Python virtual environment..."
    $PYTHON_CMD -m venv venv || {
        print_log "$YELLOW" "WARNING" "Failed to create venv, trying without it..."
        VENV_ACTIVATE=""
    }
fi

# Activate virtual environment if it exists
if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    PIP_CMD="pip"
    PYTHON_CMD="python"
else
    # Use system Python
    PIP_CMD="$PYTHON_CMD -m pip"
    print_log "$YELLOW" "INFO" "Using system Python (no venv)"
fi

# Upgrade pip
print_log "$YELLOW" "INFO" "Upgrading pip..."
$PIP_CMD install --upgrade pip --quiet || print_log "$YELLOW" "WARNING" "Failed to upgrade pip, continuing..."

# Install Python dependencies
print_log "$YELLOW" "INFO" "Installing Python dependencies..."
$PIP_CMD install -r requirements.txt
if [ $? -eq 0 ]; then
    print_log "$GREEN" "✓" "Python dependencies installed"
else
    print_log "$RED" "ERROR" "Failed to install Python dependencies"
    cd ..
    exit 1
fi

# Deactivate if we activated venv
if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
    deactivate 2>/dev/null || true
fi

cd ..
echo ""

# Step 3: TypeScript check (non-fatal)
print_log "$BLUE" "STEP 3" "Running TypeScript type check..."
npm run check || print_log "$YELLOW" "WARNING" "TypeScript check found issues (non-fatal)"
echo ""

print_log "$GREEN" "BUILD" "Build completed successfully! 🎉"
echo ""

