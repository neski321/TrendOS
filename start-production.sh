#!/bin/bash
# Production start script for Railway

set -e

echo "=== Production Start Script ==="
echo "Current directory: $(pwd)"
echo "Checking for dist/index.cjs..."

if [ ! -f "dist/index.cjs" ]; then
    echo "ERROR: dist/index.cjs not found!"
    echo "Current directory contents:"
    ls -la
    echo ""
    echo "dist directory contents:"
    ls -la dist/ 2>&1 || echo "dist/ directory does not exist"
    echo ""
    echo "Attempting to build..."
    npm run build
fi

if [ ! -f "dist/index.cjs" ]; then
    echo "ERROR: Build failed or dist/index.cjs still not found after build attempt"
    exit 1
fi

echo "✓ dist/index.cjs found"
echo "Starting server..."
NODE_ENV=production node dist/index.cjs

