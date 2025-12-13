"""Database logging handler for PostgreSQL."""
import logging
import psycopg2
from datetime import datetime, timedelta
from typing import Optional


class DatabaseLogHandler(logging.Handler):
    """Custom logging handler that writes logs to PostgreSQL database."""
    
    def __init__(self, database_url: str, level=logging.NOTSET, retention_days: int = 2):
        super().__init__(level)
        self.database_url = database_url
        self._connection = None
        self.retention_days = retention_days
        self._last_cleanup = None
        self._cleanup_interval = timedelta(hours=1)  # Run cleanup check every hour
    
    def _get_connection(self):
        """Get or create database connection."""
        if self._connection is None or self._connection.closed:
            self._connection = psycopg2.connect(self.database_url)
        return self._connection
    
    def _cleanup_old_logs(self, cursor):
        """Delete logs older than retention_days."""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.retention_days)
            cursor.execute("""
                DELETE FROM system_logs
                WHERE timestamp < %s
            """, (cutoff_date,))
            deleted_count = cursor.rowcount
            if deleted_count > 0:
                logger.debug(f"Cleaned up {deleted_count} old log entries (older than {self.retention_days} days)")
        except Exception as e:
            # Don't let cleanup errors break logging
            logger.warning(f"Error cleaning up old logs: {e}")
    
    def emit(self, record: logging.LogRecord):
        """Emit a log record to the database."""
        try:
            # Check if we should run cleanup (once per hour)
            now = datetime.utcnow()
            should_cleanup = (
                self._last_cleanup is None or 
                (now - self._last_cleanup) >= self._cleanup_interval
            )
            # Map Python logging levels to our system log levels
            level_map = {
                logging.DEBUG: 'debug',
                logging.INFO: 'info',
                logging.WARNING: 'warn',
                logging.ERROR: 'error',
                logging.CRITICAL: 'error',
            }
            
            log_level = level_map.get(record.levelno, 'info')
            
            # Extract module name from logger name
            module = record.name if record.name != 'root' else None
            if module and '.' in module:
                # Get the last part (e.g., 'core.storage' -> 'storage')
                module = module.split('.')[-1]
            
            # Format the message
            message = self.format(record)
            
            # Truncate message if too long (PostgreSQL TEXT can be very long, but let's limit to 10k chars)
            if len(message) > 10000:
                message = message[:10000] + "... [truncated]"
            
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Check if system_logs table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'system_logs'
                )
            """)
            
            if cursor.fetchone()[0]:
                # Run cleanup if needed (before inserting new log)
                if should_cleanup:
                    self._cleanup_old_logs(cursor)
                    self._last_cleanup = now
                
                # Insert log entry
                cursor.execute("""
                    INSERT INTO system_logs (timestamp, level, message, module)
                    VALUES (%s, %s, %s, %s)
                """, (
                    datetime.utcnow(),
                    log_level,
                    message,
                    module
                ))
                conn.commit()
            
            cursor.close()
            
        except Exception as e:
            # Don't let logging errors break the application
            # Just print to stderr as fallback
            print(f"Error writing log to database: {e}", file=__import__('sys').stderr)
            # Try to reset connection on error
            try:
                if self._connection and not self._connection.closed:
                    self._connection.rollback()
            except Exception:
                self._connection = None
    
    def close(self):
        """Close the database connection."""
        if self._connection and not self._connection.closed:
            self._connection.close()
        self._connection = None
        super().close()

