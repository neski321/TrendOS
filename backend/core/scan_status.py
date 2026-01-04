"""Scan status tracking and management."""
import logging
from datetime import datetime
from typing import Optional, Dict, List
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


class ScanStatus:
    """Enum-like class for scan status values."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ScanStatusTracker:
    """Track and manage scan execution status."""
    
    def __init__(self, database_url: str):
        """
        Initialize scan status tracker.
        
        Args:
            database_url: PostgreSQL connection string
        """
        self.database_url = database_url
        self._ensure_scan_status_table()
    
    def _get_connection(self):
        """Get database connection."""
        return psycopg2.connect(self.database_url)
    
    def _ensure_scan_status_table(self):
        """Ensure scan_status table exists."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS scan_status (
                    id SERIAL PRIMARY KEY,
                    scan_id VARCHAR(255) NOT NULL UNIQUE,
                    status VARCHAR(50) NOT NULL DEFAULT 'pending',
                    started_at TIMESTAMP WITH TIME ZONE,
                    completed_at TIMESTAMP WITH TIME ZONE,
                    error_message TEXT,
                    progress_message TEXT,
                    candidates_found INTEGER DEFAULT 0,
                    candidates_saved INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create index for faster lookups
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_scan_status_scan_id 
                ON scan_status(scan_id)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_scan_status_status 
                ON scan_status(status)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_scan_status_started_at 
                ON scan_status(started_at DESC)
            """)
            
            conn.commit()
            logger.debug("scan_status table verified/created")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error creating scan_status table: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    def create_scan(self, scan_id: Optional[str] = None) -> str:
        """
        Create a new scan record.
        
        Args:
            scan_id: Optional custom scan ID (default: auto-generated timestamp-based)
            
        Returns:
            The scan_id (generated or provided)
        """
        if scan_id is None:
            scan_id = f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO scan_status (scan_id, status, started_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (scan_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    started_at = EXCLUDED.started_at,
                    updated_at = CURRENT_TIMESTAMP
            """, (scan_id, ScanStatus.PENDING, datetime.now()))
            conn.commit()
            logger.info(f"Created scan record: {scan_id}")
            return scan_id
        except Exception as e:
            conn.rollback()
            logger.error(f"Error creating scan record: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    def start_scan(self, scan_id: str, progress_message: Optional[str] = None):
        """
        Mark a scan as running.
        
        Args:
            scan_id: Scan ID
            progress_message: Optional progress message
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE scan_status
                SET status = %s,
                    started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
                    progress_message = COALESCE(%s, progress_message),
                    updated_at = CURRENT_TIMESTAMP
                WHERE scan_id = %s
            """, (ScanStatus.RUNNING, progress_message, scan_id))
            conn.commit()
            logger.debug(f"Marked scan {scan_id} as running")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating scan status: {e}")
        finally:
            cursor.close()
            conn.close()
    
    def update_progress(
        self,
        scan_id: str,
        progress_message: Optional[str] = None,
        candidates_found: Optional[int] = None,
        candidates_saved: Optional[int] = None
    ):
        """
        Update scan progress.
        
        Args:
            scan_id: Scan ID
            progress_message: Progress message
            candidates_found: Number of candidates found so far
            candidates_saved: Number of candidates saved so far
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            updates = ["updated_at = CURRENT_TIMESTAMP"]
            params = []
            
            if progress_message is not None:
                updates.append("progress_message = %s")
                params.append(progress_message)
            
            if candidates_found is not None:
                updates.append("candidates_found = %s")
                params.append(candidates_found)
            
            if candidates_saved is not None:
                updates.append("candidates_saved = %s")
                params.append(candidates_saved)
            
            params.append(scan_id)
            
            cursor.execute(f"""
                UPDATE scan_status
                SET {', '.join(updates)}
                WHERE scan_id = %s
            """, params)
            conn.commit()
            logger.debug(f"Updated progress for scan {scan_id}")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating scan progress: {e}")
        finally:
            cursor.close()
            conn.close()
    
    def complete_scan(
        self,
        scan_id: str,
        candidates_found: Optional[int] = None,
        candidates_saved: Optional[int] = None
    ):
        """
        Mark a scan as completed.
        
        Args:
            scan_id: Scan ID
            candidates_found: Total candidates found
            candidates_saved: Total candidates saved
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE scan_status
                SET status = %s,
                    completed_at = CURRENT_TIMESTAMP,
                    candidates_found = COALESCE(%s, candidates_found),
                    candidates_saved = COALESCE(%s, candidates_saved),
                    updated_at = CURRENT_TIMESTAMP
                WHERE scan_id = %s
            """, (ScanStatus.COMPLETED, candidates_found, candidates_saved, scan_id))
            conn.commit()
            logger.info(f"Marked scan {scan_id} as completed")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error completing scan: {e}")
        finally:
            cursor.close()
            conn.close()
    
    def fail_scan(self, scan_id: str, error_message: str):
        """
        Mark a scan as failed.
        
        Args:
            scan_id: Scan ID
            error_message: Error message
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE scan_status
                SET status = %s,
                    completed_at = CURRENT_TIMESTAMP,
                    error_message = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE scan_id = %s
            """, (ScanStatus.FAILED, error_message, scan_id))
            conn.commit()
            logger.error(f"Marked scan {scan_id} as failed: {error_message}")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error failing scan: {e}")
        finally:
            cursor.close()
            conn.close()
    
    def get_scan_status(self, scan_id: str) -> Optional[Dict]:
        """
        Get status of a specific scan.
        
        Args:
            scan_id: Scan ID
            
        Returns:
            Dict with scan status info, or None if not found
        """
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute("""
                SELECT 
                    scan_id,
                    status,
                    started_at,
                    completed_at,
                    error_message,
                    progress_message,
                    candidates_found,
                    candidates_saved,
                    created_at,
                    updated_at
                FROM scan_status
                WHERE scan_id = %s
            """, (scan_id,))
            
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
        except Exception as e:
            logger.error(f"Error getting scan status: {e}")
            return None
        finally:
            cursor.close()
            conn.close()
    
    def get_current_scan(self) -> Optional[Dict]:
        """
        Get the currently running scan (if any).
        
        Returns:
            Dict with scan status info, or None if no scan is running
        """
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute("""
                SELECT 
                    scan_id,
                    status,
                    started_at,
                    completed_at,
                    error_message,
                    progress_message,
                    candidates_found,
                    candidates_saved,
                    created_at,
                    updated_at
                FROM scan_status
                WHERE status = %s
                ORDER BY started_at DESC
                LIMIT 1
            """, (ScanStatus.RUNNING,))
            
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
        except Exception as e:
            logger.error(f"Error getting current scan: {e}")
            return None
        finally:
            cursor.close()
            conn.close()
    
    def get_recent_scans(self, limit: int = 10) -> List[Dict]:
        """
        Get recent scans.
        
        Args:
            limit: Maximum number of scans to return
            
        Returns:
            List of scan status dicts
        """
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute("""
                SELECT 
                    scan_id,
                    status,
                    started_at,
                    completed_at,
                    error_message,
                    progress_message,
                    candidates_found,
                    candidates_saved,
                    created_at,
                    updated_at
                FROM scan_status
                ORDER BY started_at DESC
                LIMIT %s
            """, (limit,))
            
            return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error getting recent scans: {e}")
            return []
        finally:
            cursor.close()
            conn.close()




