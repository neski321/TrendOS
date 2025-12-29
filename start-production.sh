#!/bin/bash
# Production start script for Railway

set -e

echo "=== Production Start Script ==="
echo "Current directory: $(pwd)"
echo "Working directory: $PWD"
echo "Checking for dist/index.cjs..."

# Check both relative and absolute paths
DIST_FILE="dist/index.cjs"
if [ ! -f "$DIST_FILE" ]; then
    # Try absolute path
    ABS_DIST="/app/dist/index.cjs"
    if [ -f "$ABS_DIST" ]; then
        DIST_FILE="$ABS_DIST"
        echo "✓ Found dist/index.cjs at absolute path: $ABS_DIST"
    else
        echo "ERROR: dist/index.cjs not found!"
        echo "Current directory contents:"
        ls -la
        echo ""
        echo "dist directory contents:"
        ls -la dist/ 2>&1 || echo "dist/ directory does not exist"
        echo ""
        echo "Checking /app directory:"
        ls -la /app/ 2>&1 || echo "/app/ directory does not exist"
        echo ""
        echo "Attempting to build..."
        npm run build || {
            echo "Build failed! Checking for errors..."
            exit 1
        }
        
        # Check again after build
        if [ ! -f "dist/index.cjs" ] && [ ! -f "/app/dist/index.cjs" ]; then
            echo "ERROR: Build completed but dist/index.cjs still not found"
            echo "Build output directory contents:"
            ls -la dist/ 2>&1 || echo "dist/ directory does not exist"
            exit 1
        fi
        
        # Use whichever path exists
        if [ -f "/app/dist/index.cjs" ]; then
            DIST_FILE="/app/dist/index.cjs"
        fi
    fi
fi

echo "✓ dist/index.cjs found at: $DIST_FILE"
echo "Starting server..."
NODE_ENV=production node "$DIST_FILE"


