#!/usr/bin/env python3
"""
Service entry point for Railway/production deployment.

This script:
1. Checks if auto_run_on_startup is enabled and runs a scan if so
2. Starts the scheduler for scheduled runs if enabled
3. Keeps running to allow scheduled scans to execute
"""
import os
import sys
import logging
import signal
from pathlib import Path

# Add the parent directory to path to allow imports
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from utils.config_loader import load_all_configs
from core.scheduler import ScanScheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Global scheduler instance for cleanup
scheduler: ScanScheduler = None


def signal_handler(sig, frame):
    """Handle shutdown signals gracefully."""
    logger.info("Received shutdown signal. Stopping scheduler...")
    if scheduler:
        scheduler.stop_scheduler()
    sys.exit(0)


def main():
    """Main service function."""
    global scheduler
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Load environment variables
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    else:
        load_dotenv()
    
    # Get required environment variables
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        logger.error("DATABASE_URL environment variable is required")
        sys.exit(1)
    
    # Add database logging handler
    try:
        from core.db_log_handler import DatabaseLogHandler
        db_handler = DatabaseLogHandler(database_url, level=logging.INFO)
        db_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(name)s: %(message)s'))
        logging.getLogger().addHandler(db_handler)
        logger.info("Database logging handler added")
    except Exception as e:
        logger.warning(f"Could not add database logging handler: {e}. Logs will only go to console.")
    
    # Load configurations
    config_dir = Path(__file__).parent / "config"
    _, settings_config = load_all_configs(config_dir, database_url)
    
    logger.info("Service starting...")
    logger.info(f"Auto-run on startup: {settings_config.automation.auto_run_on_startup}")
    logger.info(f"Scheduled runs enabled: {settings_config.automation.scheduled_runs_enabled}")
    if settings_config.automation.scheduled_runs_enabled:
        logger.info(f"Scheduled time: {settings_config.automation.scheduled_time}")
    
    # Initialize scheduler
    scheduler = ScanScheduler(database_url, config_dir)
    
    # Check and run startup scan if enabled
    scheduler.check_and_run_startup_scan(settings_config)
    
    # Start scheduler if scheduled runs are enabled
    if settings_config.automation.scheduled_runs_enabled:
        scheduler.start_scheduler(settings_config)
        
        # Keep service running
        logger.info("Service running. Waiting for scheduled scans...")
        try:
            # Keep the main thread alive
            import time
            while True:
                time.sleep(60)  # Sleep and check every minute
                # Reload settings periodically to check for changes
                _, updated_settings = load_all_configs(config_dir, database_url)
                if updated_settings.automation.scheduled_runs_enabled != settings_config.automation.scheduled_runs_enabled:
                    logger.info("Scheduled runs setting changed. Restarting scheduler...")
                    scheduler.stop_scheduler()
                    if updated_settings.automation.scheduled_runs_enabled:
                        scheduler.start_scheduler(updated_settings)
                    settings_config = updated_settings
        except KeyboardInterrupt:
            logger.info("Service interrupted by user")
    else:
        logger.info("Scheduled runs are disabled. Service will exit after startup scan.")
        # If no scheduled runs, we can exit after startup scan completes
        # (The scan runs in a separate process, so we wait a bit)
        import time
        time.sleep(5)  # Give startup scan time to spawn
        logger.info("Service exiting (no scheduled runs configured)")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.exception(f"Fatal error in service: {e}")
        if scheduler:
            scheduler.stop_scheduler()
        sys.exit(1)


