"""Storage layer for PostgreSQL (NeonDB) database and CSV export."""
import csv
import logging
from pathlib import Path
from datetime import date, datetime, timedelta
from typing import List, Optional, Set
import psycopg2
from psycopg2 import pool
from psycopg2.extras import execute_values
from psycopg2 import sql
import re

from clients.youtube_client import VideoCandidate
from core.scorer import ScoredCandidate
from core.migrations import run_migrations
from core.validators import validate_candidates
from utils.time_utils import format_iso_datetime

logger = logging.getLogger(__name__)

# Schema definition for auto-fixing missing columns
SCHEMA_COLUMNS = {
    'created_at': 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
    'updated_at': 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
    'channel_title': 'TEXT',  # Added in Migration 4, but auto-fixable if missing
    # Add other optional columns here if needed in the future
}


class Storage:
    """Storage manager for PostgreSQL database and CSV exports."""
    
    def __init__(self, database_url: str, min_connections: int = 1, max_connections: int = 5):
        """
        Initialize storage with connection pooling.
        
        Args:
            database_url: PostgreSQL connection string (e.g., postgresql://user:pass@host/db)
            min_connections: Minimum number of connections in pool
            max_connections: Maximum number of connections in pool
        """
        self.database_url = database_url
        # Run migrations first to ensure schema is up to date
        run_migrations(database_url)
        
        # Create connection pool
        try:
            self.connection_pool = pool.SimpleConnectionPool(
                min_connections,
                max_connections,
                database_url
            )
            if self.connection_pool:
                logger.info(f"Connection pool created: {min_connections}-{max_connections} connections")
            else:
                logger.error("Failed to create connection pool")
                raise Exception("Failed to create connection pool")
        except Exception as e:
            logger.error(f"Error creating connection pool: {e}")
            raise
        
        self.init_db()
    
    def _get_connection(self):
        """Get a database connection from the pool."""
        try:
            return self.connection_pool.getconn()
        except Exception as e:
            logger.error(f"Error getting connection from pool: {e}")
            # Fallback to direct connection if pool fails
            logger.warning("Falling back to direct connection")
            return psycopg2.connect(self.database_url)
    
    def _return_connection(self, conn):
        """Return a connection to the pool."""
        try:
            if self.connection_pool:
                self.connection_pool.putconn(conn)
        except Exception as e:
            logger.error(f"Error returning connection to pool: {e}")
            try:
                conn.close()
            except Exception:
                pass
    
    def close(self):
        """Close all connections in the pool."""
        if hasattr(self, 'connection_pool') and self.connection_pool:
            self.connection_pool.closeall()
            logger.info("Connection pool closed")
    
    def init_db(self):
        """
        Initialize database schema.
        
        Note: Migrations are handled by run_migrations() called in __init__.
        This method is kept for backward compatibility and to verify schema.
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Verify that trending_videos table exists (should be created by migrations)
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'trending_videos'
                )
            """)
            table_exists = cursor.fetchone()[0]
            
            if not table_exists:
                logger.warning("trending_videos table not found. This should not happen if migrations ran correctly.")
                # Fallback: create table if migrations somehow didn't run
                # This is a safety net, but migrations should handle this
                raise Exception("Database table not found. Migrations may have failed.")
            
            # Verify indexes exist (migrations should have created them)
            cursor.execute("""
                SELECT indexname FROM pg_indexes 
                WHERE tablename = 'trending_videos'
            """)
            indexes = [row[0] for row in cursor.fetchall()]
            logger.debug(f"Found {len(indexes)} indexes on trending_videos table")
            
            # Verify all required columns exist
            cursor.execute("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'trending_videos'
                ORDER BY column_name
            """)
            existing_columns = {row[0] for row in cursor.fetchall()}
            
            # Required columns for the application to work
            required_columns = {
                'id', 'run_date', 'category', 'entity', 'title', 'channel_id',
                'published_at', 'views', 'likes', 'comments', 'duration_seconds',
                'score', 'url', 'video_id', 'description', 'thumbnail_url'
            }
            
            missing_columns = required_columns - existing_columns
            if missing_columns:
                logger.warning(f"Missing required columns: {missing_columns}")
                logger.warning("This may cause errors when saving candidates. Please run migrations.")
            else:
                logger.debug("All required columns verified")
            
            # Optional columns (nice to have but not required)
            optional_columns = {'created_at', 'updated_at'}
            missing_optional = optional_columns - existing_columns
            if missing_optional:
                logger.debug(f"Optional columns missing (will be added by migration): {missing_optional}")
            
            conn.commit()
            logger.info("Database schema verified successfully")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error verifying database schema: {e}")
            raise
        finally:
            cursor.close()
            self._return_connection(conn)
    
    def cleanup_old_candidates(self, retention_days: int = 3) -> int:
        """
        Remove candidates older than the specified retention period.
        
        Args:
            retention_days: Number of days to retain candidates (default: 3)
            
        Returns:
            Number of candidates deleted
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Calculate cutoff date
            cutoff_date = date.today() - timedelta(days=retention_days)
            
            # Delete candidates with run_date older than cutoff
            cursor.execute("""
                DELETE FROM trending_videos
                WHERE run_date < %s
            """, (cutoff_date,))
            
            deleted_count = cursor.rowcount
            conn.commit()
            
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} candidates older than {retention_days} days (cutoff: {cutoff_date})")
            else:
                logger.debug(f"No candidates older than {retention_days} days to clean up")
            
            return deleted_count
        except Exception as e:
            conn.rollback()
            logger.error(f"Error cleaning up old candidates: {e}")
            return 0
        finally:
            cursor.close()
            self._return_connection(conn)
    
    def save_run(
        self,
        run_date: date,
        scored_candidates: List[ScoredCandidate]
    ):
        """
        Save a run's results to the database.
        
        Args:
            run_date: Date of the run
            scored_candidates: List of scored candidates to save (should be pre-validated)
            
        Returns:
            Tuple of (saved_count, error_count, invalid_count, saved_candidates_list)
        """
        # Validate candidates before saving (if not already validated)
        # Note: main.py now validates before calling save_run, but we keep this as a safety check
        valid_candidates, invalid_candidates = validate_candidates(scored_candidates)
        
        if invalid_candidates:
            logger.warning(f"Skipping {len(invalid_candidates)} invalid candidates")
            for candidate, errors in invalid_candidates[:5]:  # Log first 5
                logger.warning(f"  - {candidate.candidate.video_id}: {', '.join(errors)}")
        
        if not valid_candidates:
            logger.warning("No valid candidates to save")
            return 0, 0, len(invalid_candidates), []
        
        # Clean up old candidates (older than 3 days) before saving new ones
        deleted_count = self.cleanup_old_candidates(retention_days=3)
        if deleted_count > 0:
            logger.info(f"Removed {deleted_count} old candidates before saving new scan results")
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Check if updated_at and channel_title columns exist once (not in the loop for performance)
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'trending_videos' AND column_name = 'updated_at'
            )
        """)
        has_updated_at = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'trending_videos' AND column_name = 'channel_title'
            )
        """)
        has_channel_title = cursor.fetchone()[0]
        
        # Track if we've already tried to auto-fix columns in this session
        # to avoid infinite loops
        if not hasattr(self, '_auto_fix_attempted'):
            self._auto_fix_attempted = set()
        
        # Build the update clause once based on column existence
        update_parts = [
            "run_date = EXCLUDED.run_date",
            "score = EXCLUDED.score",
            "views = EXCLUDED.views",
            "likes = EXCLUDED.likes",
            "comments = EXCLUDED.comments"
        ]
        
        if has_channel_title:
            update_parts.append("channel_title = EXCLUDED.channel_title")
        
        if has_updated_at:
            update_parts.append("updated_at = CURRENT_TIMESTAMP")
        
        update_clause = ",\n                    ".join(update_parts)
        
        saved_count = 0
        error_count = 0
        saved_candidates_list = []  # Initialize list of successfully saved candidates
        
        for scored in valid_candidates:
            candidate = scored.candidate
            try:
                # Convert numpy types to native Python types to avoid PostgreSQL errors
                # PostgreSQL interprets "np.float64" as a schema reference
                # Use item() method to convert numpy scalars to native Python types
                if hasattr(scored.score, 'item'):
                    score_value = float(scored.score.item())
                else:
                    score_value = float(scored.score) if scored.score is not None else 0.0
                
                views_value = int(candidate.views) if candidate.views is not None else 0
                likes_value = int(candidate.likes) if candidate.likes is not None else 0
                comments_value = int(candidate.comments) if candidate.comments is not None else 0
                duration_value = int(candidate.duration_seconds) if candidate.duration_seconds is not None else 0
                
                # Use ON CONFLICT for upsert (PostgreSQL equivalent of INSERT OR REPLACE)
                # Conditionally include channel_title if the column exists
                if has_channel_title:
                    cursor.execute(f"""
                        INSERT INTO trending_videos (
                            run_date, category, entity, title, channel_id, channel_title,
                            published_at, views, likes, comments, duration_seconds,
                            score, url, video_id, description, thumbnail_url
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (video_id) 
                        DO UPDATE SET {update_clause}
                    """, (
                        run_date,
                        candidate.category,
                        candidate.entity_matched,
                        candidate.title,
                        candidate.channel_title,  # Using channel_title as channel_id for now (until we get actual IDs)
                        candidate.channel_title,  # Store channel title separately
                        candidate.published_at,
                        views_value,
                        likes_value,
                        comments_value,
                        duration_value,
                        score_value,
                        candidate.url,
                        candidate.video_id,
                        candidate.description or "",
                        candidate.thumbnail_url or ""
                    ))
                else:
                    # Fallback: don't include channel_title if column doesn't exist
                    cursor.execute(f"""
                        INSERT INTO trending_videos (
                            run_date, category, entity, title, channel_id,
                            published_at, views, likes, comments, duration_seconds,
                            score, url, video_id, description, thumbnail_url
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (video_id) 
                        DO UPDATE SET {update_clause}
                    """, (
                        run_date,
                        candidate.category,
                        candidate.entity_matched,
                        candidate.title,
                        candidate.channel_title,  # Using channel_title as channel_id
                        candidate.published_at,
                        views_value,
                        likes_value,
                        comments_value,
                        duration_value,
                        score_value,
                        candidate.url,
                        candidate.video_id,
                        candidate.description or "",
                        candidate.thumbnail_url or ""
                    ))
                saved_count += 1
                saved_candidates_list.append(scored)  # Track successfully saved candidate
            except Exception as e:
                error_msg = str(e)
                
                # Check if error is about missing column
                missing_column_match = re.search(r'column "(\w+)" (?:of relation|does not exist)', error_msg, re.IGNORECASE)
                
                # Check if error is about missing UNIQUE constraint
                missing_constraint_match = re.search(r'no unique or exclusion constraint matching the ON CONFLICT', error_msg, re.IGNORECASE)
                
                if missing_column_match:
                    missing_column = missing_column_match.group(1)
                    
                    # Only auto-fix if it's a known optional column and we haven't tried yet
                    if missing_column in SCHEMA_COLUMNS and missing_column not in self._auto_fix_attempted:
                        logger.warning(f"Missing column '{missing_column}' detected. Attempting to auto-add...")
                        self._auto_fix_attempted.add(missing_column)
                        
                        try:
                            # Rollback the failed transaction first
                            conn.rollback()
                            
                            # Add the missing column in a separate transaction
                            alter_sql = f"ALTER TABLE trending_videos ADD COLUMN IF NOT EXISTS {missing_column} {SCHEMA_COLUMNS[missing_column]}"
                            cursor.execute(alter_sql)
                            conn.commit()
                            
                            logger.info(f"Successfully added missing column '{missing_column}'. Retrying save...")
                            
                            # Update flags if we just added columns
                            if missing_column == 'updated_at':
                                has_updated_at = True
                            elif missing_column == 'channel_title':
                                has_channel_title = True
                            
                            # Rebuild update clause
                            update_parts = [
                                "run_date = EXCLUDED.run_date",
                                "score = EXCLUDED.score",
                                "views = EXCLUDED.views",
                                "likes = EXCLUDED.likes",
                                "comments = EXCLUDED.comments"
                            ]
                            
                            # Check current state of columns
                            cursor.execute("""
                                SELECT EXISTS (
                                    SELECT 1 FROM information_schema.columns 
                                    WHERE table_name = 'trending_videos' AND column_name = 'channel_title'
                                )
                            """)
                            has_channel_title_retry = cursor.fetchone()[0]
                            
                            cursor.execute("""
                                SELECT EXISTS (
                                    SELECT 1 FROM information_schema.columns 
                                    WHERE table_name = 'trending_videos' AND column_name = 'updated_at'
                                )
                            """)
                            has_updated_at_retry = cursor.fetchone()[0]
                            
                            if has_channel_title_retry:
                                update_parts.append("channel_title = EXCLUDED.channel_title")
                            
                            if has_updated_at_retry:
                                update_parts.append("updated_at = CURRENT_TIMESTAMP")
                            
                            update_clause_retry = ",\n                                        ".join(update_parts)
                            
                            # Retry saving this candidate
                            try:
                                if hasattr(scored.score, 'item'):
                                    score_value = float(scored.score.item())
                                else:
                                    score_value = float(scored.score) if scored.score is not None else 0.0
                                
                                views_value = int(candidate.views) if candidate.views is not None else 0
                                likes_value = int(candidate.likes) if candidate.likes is not None else 0
                                comments_value = int(candidate.comments) if candidate.comments is not None else 0
                                duration_value = int(candidate.duration_seconds) if candidate.duration_seconds is not None else 0
                                
                                # Use channel_title column if it exists
                                if has_channel_title_retry:
                                    cursor.execute(f"""
                                        INSERT INTO trending_videos (
                                            run_date, category, entity, title, channel_id, channel_title,
                                            published_at, views, likes, comments, duration_seconds,
                                            score, url, video_id, description, thumbnail_url
                                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                        ON CONFLICT (video_id) 
                                        DO UPDATE SET {update_clause_retry}
                                    """, (
                                        run_date,
                                        candidate.category,
                                        candidate.entity_matched,
                                        candidate.title,
                                        candidate.channel_title,
                                        candidate.channel_title,
                                        candidate.published_at,
                                        views_value,
                                        likes_value,
                                        comments_value,
                                        duration_value,
                                        score_value,
                                        candidate.url,
                                        candidate.video_id,
                                        candidate.description or "",
                                        candidate.thumbnail_url or ""
                                    ))
                                else:
                                    cursor.execute(f"""
                                        INSERT INTO trending_videos (
                                            run_date, category, entity, title, channel_id,
                                            published_at, views, likes, comments, duration_seconds,
                                            score, url, video_id, description, thumbnail_url
                                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                        ON CONFLICT (video_id) 
                                        DO UPDATE SET {update_clause_retry}
                                    """, (
                                        run_date,
                                        candidate.category,
                                        candidate.entity_matched,
                                        candidate.title,
                                        candidate.channel_title,
                                        candidate.published_at,
                                        views_value,
                                        likes_value,
                                        comments_value,
                                        duration_value,
                                        score_value,
                                        candidate.url,
                                        candidate.video_id,
                                        candidate.description or "",
                                        candidate.thumbnail_url or ""
                                    ))
                                saved_count += 1
                                saved_candidates_list.append(scored)  # Track successfully saved candidate
                                logger.info(f"Successfully saved candidate {candidate.video_id} after auto-fixing column")
                                continue
                            except Exception as retry_error:
                                error_count += 1
                                logger.error(f"Error saving candidate {candidate.video_id} after auto-fix: {retry_error}")
                                conn.rollback()
                                continue
                        except Exception as fix_error:
                            logger.error(f"Failed to auto-add column '{missing_column}': {fix_error}")
                            conn.rollback()
                            error_count += 1
                            continue
                
                # Check if it's a missing UNIQUE constraint error
                elif missing_constraint_match:
                    constraint_key = 'video_id_unique_constraint'
                    if constraint_key not in self._auto_fix_attempted:
                        logger.warning("Missing UNIQUE constraint on video_id detected. Attempting to auto-add...")
                        self._auto_fix_attempted.add(constraint_key)
                        
                        try:
                            # Rollback the failed transaction first
                            conn.rollback()
                            
                            # Check if there are duplicates (can't add UNIQUE if duplicates exist)
                            cursor.execute("""
                                SELECT video_id, COUNT(*) as cnt 
                                FROM trending_videos 
                                GROUP BY video_id 
                                HAVING COUNT(*) > 1 
                                LIMIT 1
                            """)
                            duplicates = cursor.fetchone()
                            
                            if duplicates:
                                logger.error(f"Cannot add UNIQUE constraint: duplicate video_ids exist (e.g., {duplicates[0]}). Please clean up duplicates first.")
                                error_count += 1
                                continue
                            
                            # Add the UNIQUE constraint
                            cursor.execute("""
                                ALTER TABLE trending_videos 
                                ADD CONSTRAINT trending_videos_video_id_key UNIQUE (video_id)
                            """)
                            conn.commit()
                            
                            logger.info("Successfully added UNIQUE constraint on video_id. Retrying save...")
                            
                            # Check current state of columns before retry
                            cursor.execute("""
                                SELECT EXISTS (
                                    SELECT 1 FROM information_schema.columns 
                                    WHERE table_name = 'trending_videos' AND column_name = 'channel_title'
                                )
                            """)
                            has_channel_title_retry = cursor.fetchone()[0]
                            
                            cursor.execute("""
                                SELECT EXISTS (
                                    SELECT 1 FROM information_schema.columns 
                                    WHERE table_name = 'trending_videos' AND column_name = 'updated_at'
                                )
                            """)
                            has_updated_at_retry = cursor.fetchone()[0]
                            
                            # Rebuild update clause
                            update_parts = [
                                "run_date = EXCLUDED.run_date",
                                "score = EXCLUDED.score",
                                "views = EXCLUDED.views",
                                "likes = EXCLUDED.likes",
                                "comments = EXCLUDED.comments"
                            ]
                            
                            if has_channel_title_retry:
                                update_parts.append("channel_title = EXCLUDED.channel_title")
                            
                            if has_updated_at_retry:
                                update_parts.append("updated_at = CURRENT_TIMESTAMP")
                            
                            update_clause_retry = ",\n                                        ".join(update_parts)
                            
                            # Retry saving this candidate
                            try:
                                if hasattr(scored.score, 'item'):
                                    score_value = float(scored.score.item())
                                else:
                                    score_value = float(scored.score) if scored.score is not None else 0.0
                                
                                views_value = int(candidate.views) if candidate.views is not None else 0
                                likes_value = int(candidate.likes) if candidate.likes is not None else 0
                                comments_value = int(candidate.comments) if candidate.comments is not None else 0
                                duration_value = int(candidate.duration_seconds) if candidate.duration_seconds is not None else 0
                                
                                # Use channel_title column if it exists
                                if has_channel_title_retry:
                                    cursor.execute(f"""
                                        INSERT INTO trending_videos (
                                            run_date, category, entity, title, channel_id, channel_title,
                                            published_at, views, likes, comments, duration_seconds,
                                            score, url, video_id, description, thumbnail_url
                                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                        ON CONFLICT (video_id) 
                                        DO UPDATE SET {update_clause_retry}
                                    """, (
                                        run_date,
                                        candidate.category,
                                        candidate.entity_matched,
                                        candidate.title,
                                        candidate.channel_title,
                                        candidate.channel_title,
                                        candidate.published_at,
                                        views_value,
                                        likes_value,
                                        comments_value,
                                        duration_value,
                                        score_value,
                                        candidate.url,
                                        candidate.video_id,
                                        candidate.description or "",
                                        candidate.thumbnail_url or ""
                                    ))
                                else:
                                    cursor.execute(f"""
                                        INSERT INTO trending_videos (
                                            run_date, category, entity, title, channel_id,
                                            published_at, views, likes, comments, duration_seconds,
                                            score, url, video_id, description, thumbnail_url
                                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                        ON CONFLICT (video_id) 
                                        DO UPDATE SET {update_clause}
                                    """, (
                                        run_date,
                                        candidate.category,
                                        candidate.entity_matched,
                                        candidate.title,
                                        candidate.channel_title,
                                        candidate.published_at,
                                        views_value,
                                        likes_value,
                                        comments_value,
                                        duration_value,
                                        score_value,
                                        candidate.url,
                                        candidate.video_id,
                                        candidate.description or "",
                                        candidate.thumbnail_url or ""
                                    ))
                                saved_count += 1
                                saved_candidates_list.append(scored)  # Track successfully saved candidate
                                logger.info(f"Successfully saved candidate {candidate.video_id} after auto-fixing constraint")
                                continue
                            except Exception as retry_error:
                                error_count += 1
                                logger.error(f"Error saving candidate {candidate.video_id} after auto-fix: {retry_error}")
                                conn.rollback()
                                continue
                        except Exception as fix_error:
                            logger.error(f"Failed to auto-add UNIQUE constraint: {fix_error}")
                            conn.rollback()
                            error_count += 1
                            continue
                
                # Not a fixable error, or we've already tried to fix it
                error_count += 1
                logger.error(f"Error saving candidate {candidate.video_id}: {e}")
                # Rollback the failed transaction and continue
                conn.rollback()
                continue
        
        try:
            conn.commit()
            logger.info(f"Saved {saved_count} candidates to database")
            if error_count > 0:
                logger.warning(f"Failed to save {error_count} candidates due to errors")
        except Exception as e:
            logger.error(f"Error committing transaction: {e}")
            conn.rollback()
        finally:
            cursor.close()
            self._return_connection(conn)
        
        return saved_count, error_count, len(invalid_candidates), saved_candidates_list
    
    def export_csv(
        self,
        run_date: date,
        output_dir: str
    ) -> Optional[Path]:
        """
        Export run results to CSV.
        
        Args:
            run_date: Date of the run to export
            output_dir: Directory to save CSV file
            
        Returns:
            Path to created CSV file, or None if no data
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        csv_path = output_path / f"clip_trends_{run_date.isoformat()}.csv"
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                category, entity, title, channel_id as channel, published_at,
                views, likes, comments, duration_seconds, score, url, video_id
            FROM trending_videos
            WHERE run_date = %s
            ORDER BY category, score DESC
        """, (run_date,))
        
        rows = cursor.fetchall()
        cursor.close()
        self._return_connection(conn)
        
        if not rows:
            logger.warning(f"No data found for {run_date}, skipping CSV export")
            return None
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'Category', 'Entity', 'Title', 'Channel', 'Published At',
                'Views', 'Likes', 'Comments', 'Duration (s)', 'Score', 'URL', 'Video ID'
            ])
            writer.writerows(rows)
        
        logger.info(f"Exported {len(rows)} rows to {csv_path}")
        return csv_path
    
    def get_recent_runs(self, limit: int = 10) -> List[date]:
        """
        Get list of recent run dates.
        
        Args:
            limit: Maximum number of dates to return
            
        Returns:
            List of run dates
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT DISTINCT run_date
            FROM trending_videos
            ORDER BY run_date DESC
            LIMIT %s
        """, (limit,))
        
        dates = [row[0] for row in cursor.fetchall()]
        cursor.close()
        self._return_connection(conn)
        
        return dates

