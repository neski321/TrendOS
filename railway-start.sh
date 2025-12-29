#!/bin/bash
# Railway-specific startup script
# This runs both Node.js and Python services in the background

# Start Node.js server in background
npm run dev &
NODE_PID=$!

# Wait a moment for Node to start
sleep 3

# Start Python service
cd backend
# Activate venv if it exists, otherwise use system python
if [ -d "venv" ]; then
    source venv/bin/activate
    python3 service.py &
else
    python3 service.py &
fi
PYTHON_PID=$!
cd ..

# Wait for both processes
wait $NODE_PID $PYTHON_PID


