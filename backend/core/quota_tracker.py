"""YouTube API quota tracking and management."""
import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

# YouTube API quota costs per operation
QUOTA_COSTS = {
    'search.list': 100,  # 100 units per search request
    'videos.list': 1,    # 1 unit per video details request
}

# Default daily quota (can be increased via Google Cloud Console)
DEFAULT_DAILY_QUOTA = 10000


class QuotaTracker:
    """Track and manage YouTube API quota usage."""
    
    def __init__(self, database_url: str, daily_quota: int = DEFAULT_DAILY_QUOTA):
        """
        Initialize quota tracker.
        
        Args:
            database_url: PostgreSQL connection string
            daily_quota: Daily quota limit (default: 10,000 units)
        """
        self.database_url = database_url
        self.daily_quota = daily_quota
        self._ensure_quota_table()
    
    def _get_connection(self):
        """Get database connection."""
        return psycopg2.connect(self.database_url)
    
    def _ensure_quota_table(self):
        """Ensure quota_tracking table exists with correct schema."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'quota_tracking'
                )
            """)
            table_exists = cursor.fetchone()[0]
            
            if not table_exists:
                # Create table with api_key_hash column for multi-key support
                cursor.execute("""
                    CREATE TABLE quota_tracking (
                        id SERIAL PRIMARY KEY,
                        date DATE NOT NULL,
                        api_key_hash VARCHAR(64) NOT NULL DEFAULT 'default',
                        quota_used INTEGER NOT NULL DEFAULT 0,
                        quota_limit INTEGER NOT NULL DEFAULT %s,
                        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(date, api_key_hash)
                    )
                """, (self.daily_quota,))
                logger.info("Created quota_tracking table")
            else:
                # Table exists, check if api_key_hash column exists
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'quota_tracking' AND column_name = 'api_key_hash'
                    )
                """)
                column_exists = cursor.fetchone()[0]
                
                if not column_exists:
                    # Add api_key_hash column to existing table
                    logger.info("Adding api_key_hash column to existing quota_tracking table")
                    
                    # Check for old UNIQUE constraint on just 'date' column
                    cursor.execute("""
                        SELECT tc.constraint_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu 
                            ON tc.constraint_name = kcu.constraint_name
                        WHERE tc.table_name = 'quota_tracking' 
                        AND tc.constraint_type = 'UNIQUE'
                        GROUP BY tc.constraint_name
                        HAVING COUNT(kcu.column_name) = 1 
                        AND MAX(kcu.column_name) = 'date'
                    """)
                    old_constraints = cursor.fetchall()
                    
                    # Drop old UNIQUE constraint on date if it exists
                    for (constraint_name,) in old_constraints:
                        try:
                            cursor.execute(f"ALTER TABLE quota_tracking DROP CONSTRAINT IF EXISTS {constraint_name}")
                            logger.info(f"Dropped old UNIQUE constraint on date: {constraint_name}")
                        except Exception as e:
                            logger.warning(f"Could not drop constraint {constraint_name}: {e}")
                    
                    # Add api_key_hash column with default value
                    cursor.execute("""
                        ALTER TABLE quota_tracking 
                        ADD COLUMN api_key_hash VARCHAR(64) NOT NULL DEFAULT 'default'
                    """)
                    
                    # Ensure all existing rows have 'default' hash
                    cursor.execute("""
                        UPDATE quota_tracking 
                        SET api_key_hash = 'default' 
                        WHERE api_key_hash IS NULL OR api_key_hash = ''
                    """)
                    
                    # Add UNIQUE constraint on (date, api_key_hash) if it doesn't exist
                    cursor.execute("""
                        SELECT EXISTS (
                            SELECT 1 FROM pg_constraint 
                            WHERE conrelid = 'quota_tracking'::regclass 
                            AND conname = 'quota_tracking_date_api_key_hash_key'
                        )
                    """)
                    constraint_exists = cursor.fetchone()[0]
                    
                    if not constraint_exists:
                        try:
                            cursor.execute("""
                                ALTER TABLE quota_tracking 
                                ADD CONSTRAINT quota_tracking_date_api_key_hash_key 
                                UNIQUE (date, api_key_hash)
                            """)
                            logger.info("Added UNIQUE constraint on (date, api_key_hash)")
                        except Exception as e:
                            # Constraint might fail if duplicates exist
                            logger.warning(f"Could not add UNIQUE constraint (duplicates may exist): {e}")
                            logger.warning("You may need to clean up duplicate rows manually")
                    
                    logger.info("Successfully added api_key_hash column to quota_tracking table")
            
            conn.commit()
            logger.debug("quota_tracking table verified/updated")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error ensuring quota_tracking table: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    def _hash_api_key(self, api_key: Optional[str] = None) -> str:
        """Create a hash identifier for an API key."""
        import hashlib
        if api_key is None:
            return 'default'
        return hashlib.sha256(api_key.encode()).hexdigest()[:16]
    
    def get_quota_usage(self, target_date: Optional[date] = None, api_key: Optional[str] = None) -> Dict[str, int]:
        """
        Get quota usage for a specific date and API key.
        
        Args:
            target_date: Date to check (default: today)
            api_key: API key to check quota for (default: None for aggregate)
            
        Returns:
            Dict with 'used', 'limit', 'remaining', 'percentage'
        """
        if target_date is None:
            target_date = date.today()
        
        api_key_hash = self._hash_api_key(api_key)
        
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute("""
                SELECT quota_used, quota_limit
                FROM quota_tracking
                WHERE date = %s AND api_key_hash = %s
            """, (target_date, api_key_hash))
            
            row = cursor.fetchone()
            if row:
                used = row['quota_used']
                limit = row['quota_limit']
            else:
                # No record for today, initialize
                used = 0
                limit = self.daily_quota
                cursor.execute("""
                    INSERT INTO quota_tracking (date, api_key_hash, quota_used, quota_limit)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (date, api_key_hash) DO NOTHING
                """, (target_date, api_key_hash, used, limit))
                conn.commit()
            
            remaining = limit - used
            percentage = (used / limit * 100) if limit > 0 else 0
            
            return {
                'used': used,
                'limit': limit,
                'remaining': remaining,
                'percentage': round(percentage, 2)
            }
        except Exception as e:
            logger.error(f"Error getting quota usage: {e}")
            return {
                'used': 0,
                'limit': self.daily_quota,
                'remaining': self.daily_quota,
                'percentage': 0.0
            }
        finally:
            cursor.close()
            conn.close()
    
    def record_quota_usage(self, operation: str, units: Optional[int] = None, api_key: Optional[str] = None):
        """
        Record quota usage for an operation.
        
        Args:
            operation: Operation name (e.g., 'search.list', 'videos.list')
            units: Optional explicit units (if None, uses QUOTA_COSTS)
            api_key: API key used for this operation
        """
        if units is None:
            units = QUOTA_COSTS.get(operation, 0)
        
        if units == 0:
            logger.debug(f"No quota cost for operation: {operation}")
            return
        
        today = date.today()
        api_key_hash = self._hash_api_key(api_key)
        
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            # Insert or update quota usage
            cursor.execute("""
                INSERT INTO quota_tracking (date, api_key_hash, quota_used, quota_limit)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (date, api_key_hash) 
                DO UPDATE SET 
                    quota_used = quota_tracking.quota_used + EXCLUDED.quota_used,
                    last_updated = CURRENT_TIMESTAMP
            """, (today, api_key_hash, units, self.daily_quota))
            conn.commit()
            logger.debug(f"Recorded {units} quota units for {operation} (key: {api_key_hash[:8]}...)")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error recording quota usage: {e}")
        finally:
            cursor.close()
            conn.close()
    
    def check_quota_available(self, required_units: int, api_key: Optional[str] = None) -> tuple[bool, Dict[str, int]]:
        """
        Check if enough quota is available.
        
        Args:
            required_units: Units needed for the operation
            api_key: API key to check quota for
            
        Returns:
            Tuple of (is_available, usage_info)
        """
        usage = self.get_quota_usage(api_key=api_key)
        is_available = usage['remaining'] >= required_units
        
        if not is_available:
            logger.warning(
                f"Insufficient quota: need {required_units}, "
                f"but only {usage['remaining']} remaining "
                f"({usage['percentage']}% used)"
            )
        
        return is_available, usage
    
    def reset_daily_quota(self, target_date: Optional[date] = None):
        """
        Reset quota for a specific date (useful for testing or manual resets).
        
        Args:
            target_date: Date to reset (default: today)
        """
        if target_date is None:
            target_date = date.today()
        
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE quota_tracking
                SET quota_used = 0, last_updated = CURRENT_TIMESTAMP
                WHERE date = %s
            """, (target_date,))
            conn.commit()
            logger.info(f"Reset quota for {target_date}")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error resetting quota: {e}")
        finally:
            cursor.close()
            conn.close()






