#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_log() {
    local color=$1
    local prefix=$2
    shift 2
    echo -e "${color}[${prefix}]${NC} $@"
}

# Function to handle Node.js output
handle_node_output() {
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            echo -e "${BLUE}[NODE]${NC} $line"
        fi
    done
}

# Function to handle Python output
handle_python_output() {
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            echo -e "${GREEN}[PYTHON]${NC} $line"
        fi
    done
}

# Cleanup function
cleanup() {
    echo ""
    print_log "$YELLOW" "CLEANUP" "Stopping all processes..."
    
    # Kill Node.js process and its children
    if [ ! -z "$NODE_PID" ]; then
        print_log "$YELLOW" "CLEANUP" "Stopping Node.js server (PID: $NODE_PID)..."
        kill -TERM $NODE_PID 2>/dev/null
        # Kill all node processes spawned by npm
        pkill -P $NODE_PID 2>/dev/null
        kill $NODE_PID 2>/dev/null
    fi
    
    # Kill Python process and its children
    if [ ! -z "$PYTHON_PID" ]; then
        print_log "$YELLOW" "CLEANUP" "Stopping Python process (PID: $PYTHON_PID)..."
        kill -TERM $PYTHON_PID 2>/dev/null
        pkill -P $PYTHON_PID 2>/dev/null
        kill $PYTHON_PID 2>/dev/null
    fi
    if [ ! -z "$PYTHON_PGID" ]; then
        kill -TERM $PYTHON_PGID 2>/dev/null
        pkill -P $PYTHON_PGID 2>/dev/null
    fi
    
    # Also kill any remaining python3 processes that match our pattern
    # This catches processes that might have been spawned in subshells
    print_log "$YELLOW" "CLEANUP" "Killing any remaining Python processes..."
    pkill -f "python3.*main.py" 2>/dev/null
    
    # Wait a moment for processes to die gracefully
    sleep 1
    
    # Force kill if still running
    if [ ! -z "$NODE_PID" ] && kill -0 $NODE_PID 2>/dev/null; then
        kill -9 $NODE_PID 2>/dev/null
    fi
    if [ ! -z "$PYTHON_PID" ] && kill -0 $PYTHON_PID 2>/dev/null; then
        kill -9 -$PYTHON_PID 2>/dev/null || kill -9 $PYTHON_PID 2>/dev/null
    fi
    
    wait 2>/dev/null
    print_log "$GREEN" "CLEANUP" "All processes stopped."
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup SIGINT SIGTERM

# Check if .env exists for Python backend
if [ ! -f "backend/.env" ]; then
    print_log "$RED" "ERROR" ".env file not found in backend/"
    print_log "$YELLOW" "INFO" "Please copy backend/.env.example to backend/.env and fill in your API keys."
    exit 1
fi

print_log "$CYAN" "STARTUP" "Starting TrendOS Full Stack Application..."
echo ""

# Start Node.js/Express server (Frontend + Backend API)
print_log "$BLUE" "NODE" "Starting Express server on port 4070..."
npm run dev 2>&1 | handle_node_output &
NODE_PID=$!

# Wait a moment for Node to start
sleep 3

# Start Python Trend Finder (using virtual environment)
print_log "$GREEN" "PYTHON" "Starting Python Trend Finder..."
(
    cd backend
    source venv/bin/activate
    exec python3 main.py
) 2>&1 | handle_python_output &
PYTHON_PGID=$!
# Get the actual Python process PID (might be in a process group)
sleep 0.5
PYTHON_PID=$(pgrep -P $PYTHON_PGID 2>/dev/null || echo $PYTHON_PGID)

print_log "$GREEN" "STARTUP" "All services started!"
print_log "$CYAN" "INFO" "Frontend/Backend: http://localhost:4070"
print_log "$CYAN" "INFO" "Press Ctrl+C to stop all services"
echo ""

# Wait for both processes (or until interrupted)
while true; do
    # Check if processes are still running
    if ! kill -0 $NODE_PID 2>/dev/null && ! kill -0 $PYTHON_PID 2>/dev/null; then
        # Both processes have exited
        break
    fi
    sleep 1
done

# Cleanup if we get here
cleanup

