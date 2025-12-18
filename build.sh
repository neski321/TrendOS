#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_log() {
    local color=$1
    local prefix=$2
    shift 2
    echo -e "${color}[${prefix}]${NC} $@"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_log "$CYAN" "BUILD" "Checking prerequisites..."
echo ""

# Check Node.js
if ! command_exists node; then
    print_log "$RED" "ERROR" "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node --version)
print_log "$GREEN" "✓" "Node.js found: $NODE_VERSION"

# Check npm
if ! command_exists npm; then
    print_log "$RED" "ERROR" "npm is not installed. Please install npm"
    exit 1
fi
NPM_VERSION=$(npm --version)
print_log "$GREEN" "✓" "npm found: $NPM_VERSION"

# Check Python
if ! command_exists python3; then
    print_log "$RED" "ERROR" "Python 3 is not installed. Please install Python 3.11+ from https://www.python.org"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
print_log "$GREEN" "✓" "Python found: $PYTHON_VERSION"

# Check pip
if ! command_exists pip3; then
    print_log "$RED" "ERROR" "pip3 is not installed. Please install pip"
    exit 1
fi
PIP_VERSION=$(pip3 --version | cut -d' ' -f2)
print_log "$GREEN" "✓" "pip3 found: $PIP_VERSION"

echo ""
print_log "$CYAN" "BUILD" "Starting build process..."
echo ""

# Step 1: Check for .env file
print_log "$BLUE" "STEP 1" "Checking environment configuration..."
if [ ! -f "backend/.env" ]; then
    print_log "$YELLOW" "WARNING" ".env file not found in backend/"
    print_log "$YELLOW" "INFO" "Please create backend/.env with the following variables:"
    echo "  - YOUTUBE_API_KEY"
    echo "  - DATABASE_URL"
    echo "  - DISCORD_WEBHOOK_URL (optional)"
    echo "  - GOOGLE_TRENDS_API_KEY (optional)"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_log "$RED" "BUILD" "Build cancelled. Please create backend/.env first."
        exit 1
    fi
else
    print_log "$GREEN" "✓" "backend/.env file found"
fi
echo ""

# Step 2: Install Node.js dependencies
print_log "$BLUE" "STEP 2" "Installing Node.js dependencies..."
if [ ! -d "node_modules" ]; then
    print_log "$YELLOW" "INFO" "Running npm install (this may take a few minutes)..."
    npm install
    if [ $? -ne 0 ]; then
        print_log "$RED" "ERROR" "Failed to install Node.js dependencies"
        exit 1
    fi
    print_log "$GREEN" "✓" "Node.js dependencies installed"
else
    print_log "$YELLOW" "INFO" "node_modules exists, running npm install to update..."
    npm install
    if [ $? -ne 0 ]; then
        print_log "$RED" "ERROR" "Failed to update Node.js dependencies"
        exit 1
    fi
    print_log "$GREEN" "✓" "Node.js dependencies updated"
fi
echo ""

# Step 3: Set up Python virtual environment
print_log "$BLUE" "STEP 3" "Setting up Python virtual environment..."
cd backend

if [ ! -d "venv" ]; then
    print_log "$YELLOW" "INFO" "Creating Python virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        print_log "$RED" "ERROR" "Failed to create Python virtual environment"
        exit 1
    fi
    print_log "$GREEN" "✓" "Python virtual environment created"
else
    print_log "$GREEN" "✓" "Python virtual environment already exists"
fi

# Activate virtual environment
print_log "$YELLOW" "INFO" "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
print_log "$YELLOW" "INFO" "Upgrading pip..."
pip install --upgrade pip --quiet
if [ $? -ne 0 ]; then
    print_log "$YELLOW" "WARNING" "Failed to upgrade pip, continuing anyway..."
fi

# Step 4: Install Python dependencies
print_log "$BLUE" "STEP 4" "Installing Python dependencies..."
print_log "$YELLOW" "INFO" "Installing from requirements.txt (this may take a few minutes)..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    print_log "$RED" "ERROR" "Failed to install Python dependencies"
    deactivate
    cd ..
    exit 1
fi
print_log "$GREEN" "✓" "Python dependencies installed"

# Deactivate virtual environment
deactivate
cd ..
echo ""

# Step 5: Run database migrations (optional)
print_log "$BLUE" "STEP 5" "Running database migrations..."
if [ -f "backend/.env" ]; then
    # Check if DATABASE_URL is set
    source backend/.env 2>/dev/null || true
    if [ -z "$DATABASE_URL" ]; then
        # Try to load from .env file directly
        DATABASE_URL=$(grep "^DATABASE_URL=" backend/.env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    fi
    
    if [ ! -z "$DATABASE_URL" ]; then
        print_log "$YELLOW" "INFO" "Running database migrations..."
        cd backend
        source venv/bin/activate
        python3 migrate.py
        MIGRATION_EXIT_CODE=$?
        deactivate
        cd ..
        
        if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
            print_log "$GREEN" "✓" "Database migrations completed"
        else
            print_log "$YELLOW" "WARNING" "Database migrations had issues (this is OK if database is already up to date)"
        fi
    else
        print_log "$YELLOW" "WARNING" "DATABASE_URL not found in backend/.env, skipping migrations"
        print_log "$YELLOW" "INFO" "You can run migrations manually later with: cd backend && source venv/bin/activate && python3 migrate.py"
    fi
else
    print_log "$YELLOW" "WARNING" "backend/.env not found, skipping migrations"
fi
echo ""

# Step 6: TypeScript type checking (optional)
print_log "$BLUE" "STEP 6" "Running TypeScript type check..."
npm run check
if [ $? -eq 0 ]; then
    print_log "$GREEN" "✓" "TypeScript type check passed"
else
    print_log "$YELLOW" "WARNING" "TypeScript type check found issues (non-fatal)"
fi
echo ""

# Step 7: Verify installation
print_log "$BLUE" "STEP 7" "Verifying installation..."
VERIFY_FAILED=0

# Check Node.js dependencies
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    print_log "$RED" "✗" "Node.js dependencies not properly installed"
    VERIFY_FAILED=1
else
    print_log "$GREEN" "✓" "Node.js dependencies verified"
fi

# Check Python virtual environment
if [ ! -d "backend/venv" ]; then
    print_log "$RED" "✗" "Python virtual environment not found"
    VERIFY_FAILED=1
else
    print_log "$GREEN" "✓" "Python virtual environment verified"
fi

# Check Python packages
cd backend
source venv/bin/activate
python3 -c "import psycopg2; import yaml; import googleapiclient.discovery" 2>/dev/null
if [ $? -ne 0 ]; then
    print_log "$RED" "✗" "Python dependencies not properly installed"
    VERIFY_FAILED=1
else
    print_log "$GREEN" "✓" "Python dependencies verified"
fi
deactivate
cd ..

if [ $VERIFY_FAILED -eq 1 ]; then
    print_log "$RED" "ERROR" "Installation verification failed"
    exit 1
fi

echo ""
print_log "$GREEN" "BUILD" "Build completed successfully! 🎉"
echo ""
print_log "$CYAN" "INFO" "Next steps:"
echo "  1. Ensure backend/.env is configured with your API keys"
echo "  2. Run './start.sh' to start the application"
echo "  3. Access the app at http://localhost:4070"
echo ""
print_log "$CYAN" "INFO" "Available commands:"
echo "  - ./start.sh          : Start the application (development)"
echo "  - cd backend && source venv/bin/activate && python3 main.py  : Run a manual scan"
echo "  - cd backend && source venv/bin/activate && python3 service.py  : Run as service (checks automation settings)"
echo "  - cd backend && source venv/bin/activate && python3 migrate.py  : Run database migrations"
echo ""

