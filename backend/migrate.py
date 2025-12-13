#!/usr/bin/env python3
"""
Standalone migration script to run database migrations manually.

Usage:
    python migrate.py
"""
import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from core.migrations import run_migrations

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def main():
    """Run migrations manually."""
    # Load environment variables
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    else:
        load_dotenv()
    
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        logger.error("DATABASE_URL environment variable is required")
        logger.error("Get your NeonDB connection string from: https://console.neon.tech")
        sys.exit(1)
    
    logger.info("=" * 60)
    logger.info("Running database migrations...")
    logger.info("=" * 60)
    
    try:
        run_migrations(database_url)
        logger.info("=" * 60)
        logger.info("Migrations completed successfully!")
        logger.info("=" * 60)
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"Migrations failed: {e}")
        logger.error("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()

