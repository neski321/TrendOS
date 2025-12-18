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
        """Ensure quota_tracking table exists."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS quota_tracking (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL UNIQUE,
                    quota_used INTEGER NOT NULL DEFAULT 0,
                    quota_limit INTEGER NOT NULL DEFAULT %s,
                    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """, (self.daily_quota,))
            conn.commit()
            logger.debug("quota_tracking table verified/created")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error creating quota_tracking table: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    def get_quota_usage(self, target_date: Optional[date] = None) -> Dict[str, int]:
        """
        Get quota usage for a specific date.
        
        Args:
            target_date: Date to check (default: today)
            
        Returns:
            Dict with 'used', 'limit', 'remaining', 'percentage'
        """
        if target_date is None:
            target_date = date.today()
        
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute("""
                SELECT quota_used, quota_limit
                FROM quota_tracking
                WHERE date = %s
            """, (target_date,))
            
            row = cursor.fetchone()
            if row:
                used = row['quota_used']
                limit = row['quota_limit']
            else:
                # No record for today, initialize
                used = 0
                limit = self.daily_quota
                cursor.execute("""
                    INSERT INTO quota_tracking (date, quota_used, quota_limit)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (date) DO NOTHING
                """, (target_date, used, limit))
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
    
    def record_quota_usage(self, operation: str, units: Optional[int] = None):
        """
        Record quota usage for an operation.
        
        Args:
            operation: Operation name (e.g., 'search.list', 'videos.list')
            units: Optional explicit units (if None, uses QUOTA_COSTS)
        """
        if units is None:
            units = QUOTA_COSTS.get(operation, 0)
        
        if units == 0:
            logger.debug(f"No quota cost for operation: {operation}")
            return
        
        today = date.today()
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            # Insert or update quota usage
            cursor.execute("""
                INSERT INTO quota_tracking (date, quota_used, quota_limit)
                VALUES (%s, %s, %s)
                ON CONFLICT (date) 
                DO UPDATE SET 
                    quota_used = quota_tracking.quota_used + EXCLUDED.quota_used,
                    last_updated = CURRENT_TIMESTAMP
            """, (today, units, self.daily_quota))
            conn.commit()
            logger.debug(f"Recorded {units} quota units for {operation}")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error recording quota usage: {e}")
        finally:
            cursor.close()
            conn.close()
    
    def check_quota_available(self, required_units: int) -> tuple[bool, Dict[str, int]]:
        """
        Check if enough quota is available.
        
        Args:
            required_units: Units needed for the operation
            
        Returns:
            Tuple of (is_available, usage_info)
        """
        usage = self.get_quota_usage()
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





