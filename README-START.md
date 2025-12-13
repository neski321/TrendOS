# TrendOS - Quick Start Guide

## Starting the Application

### Option 1: Using the startup script (Recommended)
```bash
./start.sh
```

### Option 2: Using npm script
```bash
npm run start:all
```

### Option 3: Using Node.js script
```bash
node start.js
```

## What Gets Started

1. **Node.js/Express Server** (Frontend + Backend API)
   - Serves the React frontend
   - Provides API endpoints
   - Runs on: http://localhost:4070
   - Logs prefixed with: `[NODE]`

2. **Python Trend Finder** (Backend Service)
   - Scans YouTube for trending content
   - Scores and stores candidates in NeonDB
   - Sends Discord notifications
   - Logs prefixed with: `[PYTHON]`

## Console Output

All logs are displayed in the console with color-coded prefixes:
- 🔵 **Blue** `[NODE]` - Node.js/Express server logs
- 🟢 **Green** `[PYTHON]` - Python trend finder logs
- 🟡 **Yellow** `[CLEANUP]` - Shutdown messages
- 🔴 **Red** `[ERROR]` - Error messages

## Stopping the Application

Press `Ctrl+C` to stop all services gracefully.

## Prerequisites

Before running, make sure you have:

1. ✅ Installed Node.js dependencies: `npm install`
2. ✅ Installed Python dependencies: `cd clip_trend_finder && pip install -r requirements.txt`
3. ✅ Created `.env` file in `clip_trend_finder/` with:
   - `YOUTUBE_API_KEY`
   - `DATABASE_URL` (NeonDB connection string)
   - `DISCORD_WEBHOOK_URL` (optional)

## Troubleshooting

### Port 4070 already in use
```bash
# Kill process on port 4070
lsof -ti:4070 | xargs kill -9
```

### Python dependencies not installed
```bash
cd clip_trend_finder
pip install -r requirements.txt
```

### .env file missing
```bash
cd clip_trend_finder
cp .env.example .env
# Edit .env and add your API keys
```

