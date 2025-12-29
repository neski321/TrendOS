"""Scheduler for automated scan runs."""
import logging
import threading
import time
from datetime import datetime, time as dt_time
from typing import Optional
from pathlib import Path
import subprocess
import sys

logger = logging.getLogger(__name__)


class ScanScheduler:
    """Manages scheduled and startup scan runs."""
    
    def __init__(self, database_url: str, config_dir: Optional[Path] = None):
        """
        Initialize the scheduler.
        
        Args:
            database_url: PostgreSQL connection string
            config_dir: Directory containing config files
        """
        self.database_url = database_url
        self.config_dir = config_dir or (Path(__file__).parent.parent / "config")
        self._scheduler_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._last_run_date: Optional[str] = None
        
    def check_and_run_startup_scan(self, settings_config) -> bool:
        """
        Check if auto_run_on_startup is enabled and run a scan if so.
        
        Args:
            settings_config: SettingsConfig object
            
        Returns:
            True if scan was triggered, False otherwise
        """
        if settings_config.automation.auto_run_on_startup:
            logger.info("Auto-run on startup is enabled. Triggering scan...")
            try:
                self._run_scan()
                logger.info("Startup scan triggered successfully")
                return True
            except Exception as e:
                logger.error(f"Failed to trigger startup scan: {e}")
                return False
        else:
            logger.info("Auto-run on startup is disabled. Skipping startup scan.")
            return False
    
    def start_scheduler(self, settings_config):
        """
        Start the scheduler thread to check for scheduled runs.
        
        Args:
            settings_config: SettingsConfig object
        """
        if not settings_config.automation.scheduled_runs_enabled:
            logger.info("Scheduled runs are disabled. Scheduler not started.")
            return
        
        scheduled_time_str = settings_config.automation.scheduled_time
        try:
            # Parse time string (format: "HH:MM")
            hour, minute = map(int, scheduled_time_str.split(":"))
            scheduled_time = dt_time(hour, minute)
            logger.info(f"Scheduled runs enabled. Will run daily at {scheduled_time_str}")
        except (ValueError, AttributeError) as e:
            logger.error(f"Invalid scheduled_time format '{scheduled_time_str}': {e}. Expected format: HH:MM")
            return
        
        # Start scheduler thread
        self._stop_event.clear()
        self._scheduler_thread = threading.Thread(
            target=self._scheduler_loop,
            args=(scheduled_time,),
            daemon=True,
            name="ScanScheduler"
        )
        self._scheduler_thread.start()
        logger.info("Scheduler thread started")
    
    def stop_scheduler(self):
        """Stop the scheduler thread."""
        if self._scheduler_thread and self._scheduler_thread.is_alive():
            logger.info("Stopping scheduler...")
            self._stop_event.set()
            self._scheduler_thread.join(timeout=5.0)
            if self._scheduler_thread.is_alive():
                logger.warning("Scheduler thread did not stop gracefully")
            else:
                logger.info("Scheduler stopped")
    
    def _scheduler_loop(self, scheduled_time: dt_time):
        """Main scheduler loop that checks if it's time to run a scan."""
        logger.info(f"Scheduler loop started. Checking every minute for scheduled time: {scheduled_time}")
        
        while not self._stop_event.is_set():
            try:
                now = datetime.now()
                current_time = now.time()
                today_str = now.strftime("%Y-%m-%d")
                
                # Check if it's time to run (within 1 minute window)
                time_diff = (
                    (current_time.hour * 60 + current_time.minute) -
                    (scheduled_time.hour * 60 + scheduled_time.minute)
                )
                
                # Run if we're at the scheduled time and haven't run today
                if abs(time_diff) <= 1 and self._last_run_date != today_str:
                    logger.info(f"Scheduled time reached ({scheduled_time}). Triggering scan...")
                    try:
                        self._run_scan()
                        self._last_run_date = today_str
                        logger.info(f"Scheduled scan completed for {today_str}")
                    except Exception as e:
                        logger.error(f"Failed to run scheduled scan: {e}")
                
                # Sleep for 60 seconds before checking again
                self._stop_event.wait(60)
                
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                self._stop_event.wait(60)  # Wait before retrying
    
    def _run_scan(self):
        """
        Run the scan by spawning the main.py script.
        This runs in a separate process to avoid blocking.
        """
        backend_dir = Path(__file__).parent.parent
        python_script = backend_dir / "main.py"
        
        # Use the same Python interpreter that's running this script
        python_executable = sys.executable
        
        logger.info(f"Spawning scan process: {python_executable} {python_script}")
        
        # Run in background (detached)
        # Note: stdout/stderr are inherited so logs go to system logs (Railway/console)
        # Database logs via DatabaseLogHandler still work regardless
        subprocess.Popen(
            [python_executable, str(python_script)],
            cwd=str(backend_dir),
            stdout=None,  # Inherit stdout (goes to system logs)
            stderr=None,  # Inherit stderr (goes to system logs, Python logging writes here)
            start_new_session=True
        )


