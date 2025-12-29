# Railway Deployment Guide

## Important: Build Configuration

**DO NOT set a custom build command in Railway!**

Railway will automatically detect `nixpacks.toml` and use it to:
1. Install Node.js 18
2. Install Python 3.11
3. Install dependencies
4. Run the build

If you set a custom build command (like `./build.sh`), Railway will skip the `nixpacks.toml` setup phase, and Python won't be installed.

## Setup Steps

### 1. Connect Repository
- Connect your GitHub repository to Railway

### 2. Create Two Services

#### Service 1: Web (Node.js Frontend + API)
- **Name**: `web` or `trendos-web`
- **Build Command**: (Leave empty - Railway will use `nixpacks.toml`)
- **Start Command**: `npm run dev`
- **Port**: Railway auto-assigns (or set `PORT` env var)

#### Service 2: Worker (Python Scanner)
- **Name**: `worker` or `trendos-worker`
- **Build Command**: (Leave empty - Railway will use `nixpacks.toml`)
- **Start Command**: `cd backend && python3 service.py`
- **Port**: Not needed (this is a background worker)

### 3. Set Environment Variables

In Railway dashboard, set these for **both services**:

**Required:**
- `YOUTUBE_API_KEY` - Your YouTube Data API v3 key
- `DATABASE_URL` - Your NeonDB PostgreSQL connection string

**Optional:**
- `DISCORD_WEBHOOK_URL` - Discord webhook for notifications
- `GOOGLE_TRENDS_API_KEY` - Google Trends API key (optional)
- `PORT` - Port for web service (Railway auto-assigns if not set)

### 4. Deploy

Railway will:
1. Detect `nixpacks.toml`
2. Install Node.js and Python
3. Install all dependencies
4. Start your services

## Troubleshooting

### Build fails with "Python not found"
- **Solution**: Remove any custom build command from Railway
- Railway should automatically use `nixpacks.toml`

### Build fails with "pip not found"
- **Solution**: Make sure `nixpacks.toml` exists in the root directory
- Remove any custom build command
- Railway will install pip automatically via nixpacks

### Services not starting
- Check the logs in Railway dashboard
- Verify all environment variables are set
- Make sure `DATABASE_URL` is correct

## File Structure

Railway will automatically detect:
- `nixpacks.toml` - Build configuration (installs Node.js + Python)
- `Procfile` - Service definitions (optional, for convenience)
- `package.json` - Node.js dependencies
- `backend/requirements.txt` - Python dependencies

## Notes

- The `.env` file is **NOT needed** on Railway (use environment variables in dashboard)
- Database migrations run automatically on first startup
- The Python service checks automation settings before running scans


