"""Database migration system for schema versioning and updates."""
import logging
from typing import List, Tuple
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

logger = logging.getLogger(__name__)

# Current schema version
CURRENT_SCHEMA_VERSION = 7


def get_schema_version(cursor) -> int:
    """Get current schema version from database."""
    try:
        cursor.execute("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1")
        result = cursor.fetchone()
        version = result[0] if result else 0
        logger.debug(f"Current schema version from database: {version}")
        return version
    except psycopg2.errors.UndefinedTable:
        # Schema version table doesn't exist yet
        logger.debug("schema_version table does not exist yet, returning version 0")
        return 0
    except Exception as e:
        logger.warning(f"Error getting schema version: {e}, assuming version 0")
        return 0


def create_schema_version_table(cursor):
    """Create schema_version table to track migrations."""
    # Check if table exists
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'schema_version'
        )
    """)
    table_exists = cursor.fetchone()[0]
    
    if not table_exists:
        # Create table with description column (no name column)
        cursor.execute("""
            CREATE TABLE schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                description TEXT
            )
        """)
        logger.info("schema_version table created.")
    else:
        # Check existing columns
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'schema_version'
            ORDER BY column_name
        """)
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        # Add description column if missing
        if 'description' not in existing_columns:
            cursor.execute("""
                ALTER TABLE schema_version 
                ADD COLUMN description TEXT
            """)
            logger.info("Added description column to schema_version table.")
        
        # Remove name column if it exists (it's not needed)
        if 'name' in existing_columns:
            # First, make it nullable if it's not already
            try:
                cursor.execute("""
                    ALTER TABLE schema_version 
                    ALTER COLUMN name DROP NOT NULL
                """)
            except Exception:
                pass  # Already nullable or doesn't exist
            
            # Then drop the column
            try:
                cursor.execute("""
                    ALTER TABLE schema_version 
                    DROP COLUMN name
                """)
                logger.info("Removed name column from schema_version table.")
            except Exception as e:
                logger.warning(f"Could not drop name column: {e}")


def apply_migration(cursor, version: int, description: str, sql: str):
    """Apply a single migration."""
    try:
        logger.info(f"Applying migration {version}: {description}")
        cursor.execute(sql)
        
        # Check what columns exist in schema_version table
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'schema_version'
        """)
        columns = [row[0] for row in cursor.fetchall()]
        
        # Build insert statement based on available columns
        # Check if name column exists and if it's NOT NULL
        has_name = 'name' in columns
        has_description = 'description' in columns
        
        if has_name and has_description:
            # Table has both name and description: use description for both
            cursor.execute(
                "INSERT INTO schema_version (version, name, description) VALUES (%s, %s, %s)",
                (version, description, description)
            )
        elif has_name:
            # Table has only name (old format)
            cursor.execute(
                "INSERT INTO schema_version (version, name) VALUES (%s, %s)",
                (version, description)
            )
        elif has_description:
            # New format: version, description only
            cursor.execute(
                "INSERT INTO schema_version (version, description) VALUES (%s, %s)",
                (version, description)
            )
        else:
            # Fallback: just version
            cursor.execute(
                "INSERT INTO schema_version (version) VALUES (%s)",
                (version,)
            )
        
        logger.info(f"Migration {version} applied successfully")
    except Exception as e:
        logger.error(f"Error applying migration {version}: {e}")
        raise


def get_migrations() -> List[Tuple[int, str, str]]:
    """
    Get list of migrations to apply.
    
    Returns:
        List of (version, description, sql) tuples
    """
    migrations = [
        (
            1,
            "Initial schema: trending_videos table with indexes",
            """
            CREATE TABLE IF NOT EXISTS trending_videos (
                id SERIAL PRIMARY KEY,
                run_date DATE NOT NULL,
                category TEXT NOT NULL,
                entity TEXT NOT NULL,
                title TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                published_at TIMESTAMP WITH TIME ZONE NOT NULL,
                views INTEGER NOT NULL,
                likes INTEGER NOT NULL,
                comments INTEGER NOT NULL,
                duration_seconds INTEGER NOT NULL,
                score REAL NOT NULL,
                url TEXT NOT NULL,
                video_id TEXT NOT NULL UNIQUE,
                description TEXT,
                thumbnail_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_run_date ON trending_videos(run_date);
            CREATE INDEX IF NOT EXISTS idx_category ON trending_videos(category);
            CREATE INDEX IF NOT EXISTS idx_score ON trending_videos(score DESC);
            CREATE INDEX IF NOT EXISTS idx_video_id ON trending_videos(video_id);
            CREATE INDEX IF NOT EXISTS idx_published_at ON trending_videos(published_at DESC);
            """
        ),
        (
            2,
            "Add missing columns (updated_at, created_at) and ensure video_id UNIQUE constraint",
            """
            DO $$ 
            BEGIN
                -- Add created_at if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'trending_videos' AND column_name = 'created_at'
                ) THEN
                    ALTER TABLE trending_videos 
                    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                
                -- Add updated_at if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'trending_videos' AND column_name = 'updated_at'
                ) THEN
                    ALTER TABLE trending_videos 
                    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                
                -- Ensure video_id has UNIQUE constraint (required for ON CONFLICT)
                -- Check for any UNIQUE constraint on video_id column
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint c
                    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                    WHERE c.conrelid = 'trending_videos'::regclass
                    AND c.contype = 'u'
                    AND a.attname = 'video_id'
                ) THEN
                    -- Check if there are any duplicate video_ids first
                    IF (SELECT COUNT(*) FROM (SELECT video_id FROM trending_videos GROUP BY video_id HAVING COUNT(*) > 1) AS dupes) = 0 THEN
                        ALTER TABLE trending_videos 
                        ADD CONSTRAINT trending_videos_video_id_key UNIQUE (video_id);
                    ELSE
                        RAISE NOTICE 'Cannot add UNIQUE constraint: duplicate video_ids exist. Please clean up duplicates first.';
                    END IF;
                END IF;
            END $$;
            """
        ),
        (
            3,
            "Create app_settings table for storing application configuration",
            """
            CREATE TABLE IF NOT EXISTS app_settings (
                id SERIAL PRIMARY KEY,
                setting_key TEXT NOT NULL UNIQUE,
                setting_value JSONB NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_setting_key ON app_settings(setting_key);
            
            -- Insert default settings if they don't exist
            INSERT INTO app_settings (setting_key, setting_value, description)
            VALUES 
                ('scoring', '{"recency_weight": 0.3, "engagement_weight": 0.3, "velocity_weight": 0.2, "cross_platform_weight": 0.1, "entity_priority_weight": 0.1}'::jsonb, 'Scoring algorithm weights'),
                ('limits', '{"max_candidates_per_category": 200, "top_n_per_category_for_discord": 5, "min_video_duration_seconds": 60, "max_video_duration_seconds": 7200}'::jsonb, 'Application limits'),
                ('discord', '{"enabled": true}'::jsonb, 'Discord notification settings')
            ON CONFLICT (setting_key) DO NOTHING;
            """
        ),
        (
            4,
            "Add channel_title column to trending_videos table",
            """
            DO $$ 
            BEGIN
                -- Add channel_title column if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'trending_videos' AND column_name = 'channel_title'
                ) THEN
                    ALTER TABLE trending_videos 
                    ADD COLUMN channel_title TEXT;
                    
                    -- Migrate existing data: if channel_id contains channel names (not IDs), copy to channel_title
                    -- Channel IDs typically start with 'UC' and are 24 characters, so if channel_id doesn't match that pattern,
                    -- it's likely a channel name that should be moved to channel_title
                    UPDATE trending_videos 
                    SET channel_title = channel_id
                    WHERE channel_title IS NULL 
                    AND (channel_id NOT LIKE 'UC%' OR LENGTH(channel_id) != 24);
                    
                    -- If channel_id looks like an ID, leave channel_title as NULL (will be populated on next scan)
                END IF;
            END $$;
            """
        ),
        (
            5,
            "Create system_logs table for storing application logs",
            """
            CREATE TABLE IF NOT EXISTS system_logs (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'success', 'error', 'debug')),
                message TEXT NOT NULL,
                module TEXT
            );
            
            CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);
            """
        ),
        (
            6,
            "Prepare app_settings table for entities configuration",
            """
            -- Migration 6: Entities configuration will be stored in app_settings table
            -- The Python backend will load from YAML and save to DB on first run if needed
            -- This migration ensures the table structure is ready (already created in migration 3)
            SELECT 1;
            """
        ),
        (
            7,
            "Add automatic cleanup function for system_logs (delete logs older than 2 days)",
            """
            -- Create a function to clean up old logs
            CREATE OR REPLACE FUNCTION cleanup_old_logs()
            RETURNS void AS $$
            BEGIN
                DELETE FROM system_logs
                WHERE timestamp < NOW() - INTERVAL '2 days';
            END;
            $$ LANGUAGE plpgsql;
            
            -- Note: The Python backend will call this function periodically
            -- We could also set up a cron job or scheduled task to run this
            """
        ),
    ]
    return migrations


def run_migrations(database_url: str):
    """
    Run all pending migrations.
    
    Args:
        database_url: PostgreSQL connection string
    """
    conn = psycopg2.connect(database_url)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    try:
        logger.info("Starting migration process...")
        
        # Create schema version table
        logger.debug("Creating schema_version table if it doesn't exist...")
        create_schema_version_table(cursor)
        
        # Get current version
        current_version = get_schema_version(cursor)
        logger.info(f"Current database schema version: {current_version}")
        logger.info(f"Target schema version: {CURRENT_SCHEMA_VERSION}")
        
        # Get all migrations
        migrations = get_migrations()
        logger.debug(f"Total migrations defined: {len(migrations)}")
        
        # Apply pending migrations
        pending = [m for m in migrations if m[0] > current_version]
        
        if not pending:
            logger.info("✓ Database schema is up to date (no pending migrations)")
            return
        
        logger.info(f"Found {len(pending)} pending migration(s):")
        for version, description, _ in pending:
            logger.info(f"  - Migration {version}: {description}")
        
        # Apply migrations in order
        for version, description, sql in sorted(pending, key=lambda x: x[0]):
            if version <= current_version:
                continue
            
            # Use a transaction for each migration
            conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_READ_COMMITTED)
            try:
                apply_migration(cursor, version, description, sql)
                conn.commit()
            except Exception as e:
                conn.rollback()
                logger.error(f"Failed to apply migration {version}, rolling back")
                raise
            finally:
                conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        # Verify final version
        final_version = get_schema_version(cursor)
        logger.info(f"Database schema updated to version {final_version}")
        
        if final_version < CURRENT_SCHEMA_VERSION:
            logger.warning(
                f"Database version ({final_version}) is less than current code version ({CURRENT_SCHEMA_VERSION}). "
                "Some migrations may be missing."
            )
        
    except Exception as e:
        logger.error(f"Error running migrations: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

