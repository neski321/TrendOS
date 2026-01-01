# Database Setup & API Data Mapping

## Overview

This document explains how the YouTube API data maps to the database schema and why proper setup is critical.

## Data Flow: API → Database

### 1. What the YouTube API Provides

The `VideoCandidate` dataclass (from `clients/youtube_client.py`) contains:

```python
@dataclass
class VideoCandidate:
    video_id: str              # YouTube video ID (e.g., "dQw4w9WgXcQ")
    title: str                 # Video title
    channel_title: str         # Channel name (e.g., "ESPN")
    published_at: datetime     # When video was published
    views: int                 # View count
    likes: int                 # Like count
    comments: int              # Comment count
    duration_seconds: int      # Video length in seconds
    url: str                   # Full YouTube URL
    category: str              # "hip_hop", "nba", or "celebrity"
    entity_matched: str        # Which entity matched (e.g., "Drake", "LeBron James")
    description: str           # Video description (optional)
    thumbnail_url: str          # Thumbnail image URL (optional)
```

### 2. What the Database Expects

The `trending_videos` table (created by Migration 1) expects:

```sql
CREATE TABLE trending_videos (
    id SERIAL PRIMARY KEY,                    -- Auto-increment ID
    run_date DATE NOT NULL,                   -- Date of the scan
    category TEXT NOT NULL,                   -- "hip_hop", "nba", "celebrity"
    entity TEXT NOT NULL,                     -- Entity matched (e.g., "Drake")
    title TEXT NOT NULL,                      -- Video title
    channel_id TEXT NOT NULL,                  -- Channel identifier/name
    channel_title TEXT,                       -- Channel name (added in Migration 4)
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- Publication timestamp
    views INTEGER NOT NULL,                    -- View count
    likes INTEGER NOT NULL,                    -- Like count
    comments INTEGER NOT NULL,                -- Comment count
    duration_seconds INTEGER NOT NULL,         -- Duration in seconds
    score REAL NOT NULL,                       -- Calculated "Clip Potential" score
    url TEXT NOT NULL,                         -- YouTube URL
    video_id TEXT NOT NULL UNIQUE,             -- YouTube video ID (UNIQUE constraint)
    description TEXT,                         -- Video description
    thumbnail_url TEXT,                        -- Thumbnail URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- Record creation time
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  -- Last update time
);
```

### 3. Data Mapping

| API Field (VideoCandidate) | Database Column | Notes |
|----------------------------|-----------------|-------|
| `video_id` | `video_id` | UNIQUE constraint prevents duplicates |
| `title` | `title` | Direct mapping |
| `channel_title` | `channel_id` | Currently using channel name as ID (until we get actual channel IDs) |
| `channel_title` | `channel_title` | Separate column for channel name (Migration 4) |
| `published_at` | `published_at` | Direct mapping |
| `views` | `views` | Direct mapping |
| `likes` | `likes` | Direct mapping |
| `comments` | `comments` | Direct mapping |
| `duration_seconds` | `duration_seconds` | Direct mapping |
| `category` | `category` | Direct mapping |
| `entity_matched` | `entity` | Direct mapping |
| `url` | `url` | Direct mapping |
| `description` | `description` | Optional, defaults to "" |
| `thumbnail_url` | `thumbnail_url` | Optional, defaults to "" |
| N/A | `run_date` | Added by `save_run()` - date of the scan |
| N/A | `score` | Calculated by scoring algorithm |
| N/A | `created_at` | Auto-set by database (Migration 1) |
| N/A | `updated_at` | Auto-set by database (Migration 1, updated on conflict) |

## Why Errors Occur

### Common Issues:

1. **Migrations Not Run**: If migrations haven't been applied, the database schema may be missing:
   - `channel_title` column (Migration 4)
   - `updated_at` column (Migration 2)
   - `created_at` column (Migration 2)
   - UNIQUE constraint on `video_id` (Migration 2)

2. **Schema Mismatch**: The code expects certain columns to exist, but if migrations failed or weren't run, the schema won't match.

3. **Auto-Fix Limitations**: The code has auto-fix logic for missing columns, but it only works for known optional columns (`created_at`, `updated_at`, `channel_title`). If other required columns are missing, errors will occur.

## How to Ensure Proper Setup

### Step 1: Run Migrations

Migrations are automatically run when `Storage` is initialized (in `main.py`), but you can also run them manually:

```bash
cd backend
source venv/bin/activate
python3 migrate.py
```

This will:
- Create `schema_version` table to track migrations
- Apply all pending migrations (currently up to version 7)
- Ensure all required columns and constraints exist

### Step 2: Verify Schema

After migrations, verify the schema:

```sql
-- Check if trending_videos table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'trending_videos'
);

-- Check all columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'trending_videos'
ORDER BY ordinal_position;

-- Check UNIQUE constraint on video_id
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'trending_videos'::regclass
AND contype = 'u';
```

### Step 3: Check Migration Status

```sql
-- See which migrations have been applied
SELECT version, description, applied_at
FROM schema_version
ORDER BY version;
```

## Migration History

| Version | Description | Key Changes |
|---------|-------------|-------------|
| 1 | Initial schema | Creates `trending_videos` table with all core columns |
| 2 | Add timestamps & UNIQUE constraint | Adds `created_at`, `updated_at`, ensures `video_id` UNIQUE |
| 3 | Create app_settings table | For storing application configuration |
| 4 | Add channel_title column | Separates channel name from channel ID |
| 5 | Create system_logs table | For storing application logs |
| 6 | Prepare for entities config | Placeholder for entities in app_settings |
| 7 | Add cleanup function | Adds `cleanup_old_logs()` function for log retention |

## Current Schema Version

**Current Version: 7**

The code expects schema version 7. If your database is at a lower version, migrations will be applied automatically on startup.

## Troubleshooting

### Error: "column 'channel_title' does not exist"
- **Cause**: Migration 4 hasn't been applied
- **Fix**: Run migrations manually or restart the app (migrations run on startup)

### Error: "no unique or exclusion constraint matching the ON CONFLICT specification"
- **Cause**: Migration 2 hasn't been applied or UNIQUE constraint is missing
- **Fix**: Run migrations. If duplicates exist, clean them up first:
  ```sql
  -- Find duplicates
  SELECT video_id, COUNT(*) 
  FROM trending_videos 
  GROUP BY video_id 
  HAVING COUNT(*) > 1;
  
  -- Remove duplicates (keep the most recent)
  DELETE FROM trending_videos t1
  USING trending_videos t2
  WHERE t1.video_id = t2.video_id
  AND t1.id < t2.id;
  ```

### Error: "column 'updated_at' does not exist"
- **Cause**: Migration 2 hasn't been applied
- **Fix**: Run migrations. The auto-fix logic should handle this, but if it fails, run migrations manually.

## Best Practices

1. **Always run migrations before first use**: Ensure the database schema is up to date
2. **Check migration status**: Verify migrations have been applied successfully
3. **Monitor logs**: Watch for migration errors or warnings during startup
4. **Backup before migrations**: In production, backup the database before running migrations
5. **Test migrations**: Test migrations in a staging environment before applying to production

## Summary

The database schema must match what the API provides and what the code expects. Migrations ensure this alignment. If errors occur, it's usually because:

1. Migrations haven't been run
2. Migrations failed partway through
3. Database schema was manually modified and doesn't match migrations

The fix is always: **Run migrations to ensure schema is up to date**.







