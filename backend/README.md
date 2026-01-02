# Automated Trend Finder + Discord Alert System

A production-ready Python system that automatically discovers trending hip hop, NBA, and celebrity interview content, scores videos for clip-worthiness, stores results, and sends Discord notifications.

## Features

- 🔍 **Automated YouTube Scanning**: Queries YouTube Data API for new videos matching configured entities and keywords
- 📊 **Intelligent Scoring**: Calculates "clip potential" scores based on recency, engagement, view velocity, and entity priority
- 💾 **Data Storage**: Saves results to PostgreSQL (NeonDB) database with optional CSV export
- 🔔 **Discord Notifications**: Sends daily summaries of top clip targets via webhook
- ⚙️ **Config-Driven**: Fully configurable via YAML files (entities, scoring weights, limits)
- 🚀 **Production Ready**: Includes Dockerfile and deployment instructions

## Project Structure

```
clip_trend_finder/
├── main.py                  # Entry point: orchestrates pipeline
├── config/
│   ├── entities.yaml        # Categories, entities, channels, keywords
│   └── settings.yaml        # Weights, limits, time windows, regions
├── clients/
│   ├── youtube_client.py    # YouTube API integration
│   └── tiktok_client.py     # Stub for future TikTok integration
├── core/
│   ├── scorer.py            # Scoring, ranking, filtering logic
│   └── storage.py           # SQLite + CSV/Sheet export
├── notifiers/
│   └── discord_notifier.py  # Discord webhook notifications
├── utils/
│   ├── config_loader.py     # Load and validate YAML configs
│   └── time_utils.py        # Time / datetime helpers
├── requirements.txt
├── .env.example
├── Dockerfile
└── README.md
```

## Setup

### 1. Install Dependencies

Create a virtual environment and install dependencies:

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Note:** The startup scripts (`start.sh` and `start.js`) will automatically use the virtual environment, so you don't need to activate it manually when using those scripts.

### 2. Get YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **YouTube Data API v3**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API key

### 3. Set Up NeonDB (PostgreSQL)

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project
3. Copy your connection string (it will look like: `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`)

### 4. Create Discord Webhook

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Copy the webhook URL

### 5. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
YOUTUBE_API_KEY=your_youtube_api_key_here
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_id/your_webhook_token
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
```

### 6. Customize Configuration (Optional)

Edit `config/entities.yaml` to add/remove entities, channels, or keywords.

Edit `config/settings.yaml` to adjust scoring weights, limits, or time windows.

## Usage

### Database Migrations

**Migrations run automatically** when you start the app (when `Storage` is initialized). However, you can also run them manually:

```bash
# Activate virtual environment first
source venv/bin/activate

# Run migrations manually
python migrate.py
```

This will:
- Check current database schema version
- Apply any pending migrations
- Show detailed logs of what's happening

**Note:** If you see "Database schema is up to date", it means all migrations have already been applied.

### Run Once

```bash
python main.py
```

The script will:
1. **Run database migrations automatically** (ensures schema is up to date)
2. Load configuration from YAML files
3. Query YouTube API for videos matching your entities/keywords
4. Filter and score candidates
5. Save results to NeonDB (PostgreSQL)
6. Export CSV to `exports/` directory (if enabled)
7. Send Discord notification with top picks

### Schedule with Cron

Add to your crontab to run daily at 9 AM:

```bash
0 9 * * * cd /path/to/clip_trend_finder && /usr/bin/python3 main.py >> logs/cron.log 2>&1
```

### Deploy with Docker

```bash
# Build image
docker build -t clip-trend-finder .

# Run container
docker run --env-file .env clip-trend-finder
```

### Deploy on Railway/Render

1. **Railway**:
   - Create new project
   - Connect GitHub repo
   - Add environment variables in settings
   - Set up scheduled job (cron) to run `python main.py` daily

2. **Render**:
   - Create new Cron Job
   - Set build command: `pip install -r requirements.txt`
   - Set run command: `python main.py`
   - Add environment variables
   - Set schedule (e.g., `0 9 * * *` for daily at 9 AM)

## Configuration

### Entities Configuration (`config/entities.yaml`)

Define categories, entities, channels, and priority weights:

```yaml
categories:
  hip_hop:
    entities:
      - "Drake"
      - "Kendrick Lamar"
    channels:
      - "VladTV"
    priority_weights:
      "Drake": 1.5
```

### Settings Configuration (`config/settings.yaml`)

Adjust scoring algorithm, limits, and storage:

```yaml
scoring:
  recency_weight: 0.3
  engagement_weight: 0.3
  velocity_weight: 0.2
```

## Output

### Database

Results are stored in NeonDB (PostgreSQL) with the following schema:

- `run_date`: Date of the scan
- `category`: hip_hop, nba, or celebrity
- `entity`: Matched entity name
- `title`, `channel`, `url`: Video information
- `views`, `likes`, `comments`: Engagement metrics
- `score`: Calculated clip potential score (0-100)

### CSV Export

Daily CSV files are exported to `exports/clip_trends_YYYY-MM-DD.csv` (if enabled).

### Discord Notifications

Daily summary message includes:
- Top 5 candidates per category
- Views, score, and direct YouTube links
- Formatted for easy reading

## Scoring Algorithm

The clip potential score (0-100) is calculated using:

1. **Recency** (30%): Newer videos score higher
2. **Engagement** (30%): Based on likes, views, and like/view ratio
3. **Velocity** (20%): Views per hour (log-scaled)
4. **Cross-Platform Signal** (10%): Reserved for future TikTok integration
5. **Entity Priority** (10%): Higher weight for priority entities

## Troubleshooting

### Rate Limit Errors

If you see `403 Forbidden` errors:
- YouTube API has a quota limit (10,000 units/day by default)
- Reduce `max_results_per_query` in `config/settings.yaml`
- Increase `rate_limit_delay_seconds` to slow down requests

### No Results Found

- Check that entities/channels exist on YouTube
- Verify keywords match video titles/descriptions
- Adjust `time_window_hours` to search further back
- Check YouTube API key is valid

### Discord Notifications Not Sending

- Verify `DISCORD_WEBHOOK_URL` is set correctly
- Check webhook is still active in Discord
- Review logs for error messages

### Database Connection Errors

- Verify `DATABASE_URL` is set correctly in `.env`
- Check that your NeonDB project is active
- Ensure the connection string includes `?sslmode=require` for SSL
- Test connection: `psql "your_connection_string"`
- Check firewall/network settings if connecting from restricted environments

## Future Enhancements

- [ ] TikTok API integration for cross-platform signals
- [ ] Real-time streaming updates
- [ ] Web dashboard (connect to existing frontend)
- [ ] Advanced filtering (duration, language, etc.)
- [ ] Multi-region support
- [ ] Email notifications as alternative to Discord

## License

MIT

## Contributing

Contributions welcome! Please open an issue or pull request.

