#!/bin/bash
# Quick start script for the Trend Finder

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and fill in your API keys."
    exit 1
fi

# Run the main script
python3 main.py

