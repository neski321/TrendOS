#!/usr/bin/env python3
"""
Main entry point for the Automated Trend Finder + Discord Alert System.

This script orchestrates the entire pipeline:
1. Loads configuration
2. Queries YouTube API for video candidates
3. Scores and ranks candidates
4. Stores results in SQLite
5. Sends Discord notifications
"""
import os
import sys
import logging
from pathlib import Path
from datetime import date

# Add the parent directory to path to allow imports
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

from utils.config_loader import load_all_configs
from utils.time_utils import hours_ago
from clients.youtube_client import YouTubeClient
from clients.tiktok_client import TikTokClient
from clients.google_trends_client import GoogleTrendsClient
from core.scorer import filter_candidates, score_candidates, rank_by_category
from core.storage import Storage
from core.quota_tracker import QuotaTracker
from core.api_key_manager import APIKeyManager
from core.scan_status import ScanStatusTracker
from notifiers.discord_notifier import DiscordNotifier

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def main():
    """Main orchestration function."""
    # Load environment variables
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    else:
        load_dotenv()
    
    # Get required environment variables
    # Support multiple YouTube API keys (YOUTUBE_API_KEY_1, YOUTUBE_API_KEY_2, etc.)
    youtube_api_keys = []
    # First check for single key (backward compatibility)
    single_key = os.getenv("YOUTUBE_API_KEY")
    if single_key:
        youtube_api_keys.append(single_key)
    
    # Then check for multiple keys (YOUTUBE_API_KEY_1 through YOUTUBE_API_KEY_5)
    for i in range(1, 6):
        key = os.getenv(f"YOUTUBE_API_KEY_{i}")
        if key and key not in youtube_api_keys:
            youtube_api_keys.append(key)
    
    if not youtube_api_keys:
        logger.error("At least one YouTube API key is required (YOUTUBE_API_KEY or YOUTUBE_API_KEY_1)")
        sys.exit(1)
    
    logger.info(f"Loaded {len(youtube_api_keys)} YouTube API key(s)")
    
    discord_webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
    database_url = os.getenv("DATABASE_URL")
    google_trends_api_key = os.getenv("GOOGLE_TRENDS_API_KEY")  # Optional
    
    if not database_url:
        logger.error("DATABASE_URL environment variable is required")
        logger.error("Get your NeonDB connection string from: https://console.neon.tech")
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
    
    # Load configurations (settings from database, entities from YAML)
    config_dir = Path(__file__).parent / "config"
    entities_config, settings_config = load_all_configs(config_dir, database_url)
    
    logger.info("Configuration loaded successfully")
    
    # Initialize quota tracker
    quota_tracker = QuotaTracker(database_url)
    
    # Initialize API key manager
    api_key_manager = APIKeyManager(youtube_api_keys, quota_tracker)
    
    # Log quota status for all keys
    key_status = api_key_manager.get_key_status()
    for key_id, status in key_status.items():
        quota = status.get('quota', {})
        logger.info(
            f"API Key {key_id}: "
            f"{quota.get('used', 0)}/{quota.get('limit', 10000)} "
            f"({quota.get('percentage', 0)}%) used, "
            f"exhausted: {status.get('exhausted', False)}"
        )
    
    # Initialize clients
    youtube_client = YouTubeClient(
        api_key_manager=api_key_manager,
        rate_limit_delay=settings_config.api.youtube.rate_limit_delay_seconds,
        quota_tracker=quota_tracker
    )
    tiktok_client = TikTokClient()  # Stub for now
    google_trends_client = GoogleTrendsClient(
        rate_limit_delay=settings_config.api.youtube.rate_limit_delay_seconds,
        geo=entities_config.default_region,
        api_key=google_trends_api_key  # Optional - uses pytrends if not provided
    )
    logger.info("Google Trends client initialized")
    
    # Initialize storage (use DATABASE_URL from environment, override config)
    storage = Storage(database_url)
    
    # Initialize scan status tracker
    scan_status_tracker = ScanStatusTracker(database_url)
    scan_id = scan_status_tracker.create_scan()
    logger.info(f"Created scan record: {scan_id}")
    
    # Initialize Discord notifier (if enabled)
    discord_notifier = None
    if settings_config.discord.enabled and discord_webhook_url:
        discord_notifier = DiscordNotifier(discord_webhook_url)
        logger.info("Discord notifications enabled")
    elif settings_config.discord.enabled:
        logger.warning("Discord enabled in config but DISCORD_WEBHOOK_URL not set")
    
    # Calculate time window
    time_window_start = hours_ago(entities_config.time_window_hours)
    run_date = date.today()
    
    logger.info(f"Starting scan for videos published after {time_window_start}")
    logger.info(f"Time window: {entities_config.time_window_hours} hours")
    
    # Wrap entire scan in try/except to track completion/failure
    try:
        # Mark scan as running
        scan_status_tracker.start_scan(scan_id, "Starting candidate collection...")
        
        # Collect candidates from all categories
        all_candidates = []
        
        for category_name, category_config in entities_config.categories.items():
            logger.info(f"Scanning category: {category_name}")
            scan_status_tracker.update_progress(
                scan_id,
                progress_message=f"Scanning category: {category_name}..."
            )
        
            # Search for entities
            for entity in category_config.entities:
                for keyword in entities_config.keywords:
                    try:
                        logger.info(f"  Searching: {entity} + {keyword}")
                        candidates = youtube_client.search_candidates(
                            entity=entity,
                            keyword=keyword,
                            category=category_name,
                            published_after=time_window_start,
                            max_results=settings_config.api.youtube.max_results_per_query
                        )
                        all_candidates.extend(candidates)
                    except Exception as e:
                        logger.error(f"  Error searching {entity} + {keyword}: {e}")
                        continue
            
            # Search for channels
            for channel in category_config.channels:
                for keyword in entities_config.keywords:
                    try:
                        logger.info(f"  Searching channel: {channel} + {keyword}")
                        candidates = youtube_client.search_candidates(
                            entity=channel,
                            keyword=keyword,
                            category=category_name,
                            published_after=time_window_start,
                            max_results=settings_config.api.youtube.max_results_per_query
                        )
                        all_candidates.extend(candidates)
                    except Exception as e:
                        logger.error(f"  Error searching channel {channel} + {keyword}: {e}")
                        continue
            
            # Search for category-wide trending content
            for category_keyword in category_config.category_keywords:
                try:
                    logger.info(f"  Searching category-wide trending: {category_keyword}")
                    # Use viewCount order to get trending content, limit results to avoid too many duplicates
                    candidates = youtube_client.search_by_category_keyword(
                        category_keyword=category_keyword,
                        category=category_name,
                        published_after=time_window_start,
                        max_results=min(settings_config.api.youtube.max_results_per_query, 30),  # Limit category searches
                        order="viewCount"  # Get trending content by view count
                    )
                    all_candidates.extend(candidates)
                except Exception as e:
                    logger.error(f"  Error searching category keyword {category_keyword}: {e}")
                    continue
        
        logger.info(f"Found {len(all_candidates)} total candidates before deduplication")
    
        # Update progress
        scan_status_tracker.update_progress(
            scan_id,
            progress_message=f"Found {len(all_candidates)} candidates, deduplicating...",
            candidates_found=len(all_candidates)
        )
        
        # Deduplicate candidates by video_id (keep first occurrence)
        seen_video_ids = {}
        unique_candidates = []
        for candidate in all_candidates:
            if candidate.video_id not in seen_video_ids:
                seen_video_ids[candidate.video_id] = candidate
                unique_candidates.append(candidate)
            else:
                # If we've seen this video, update entity_matched if needed (for better categorization)
                existing = seen_video_ids[candidate.video_id]
                # Keep the candidate with more specific entity match if available
                if len(candidate.entity_matched) > len(existing.entity_matched):
                    unique_candidates.remove(existing)
                    unique_candidates.append(candidate)
                    seen_video_ids[candidate.video_id] = candidate
        
        logger.info(f"After deduplication: {len(unique_candidates)} unique candidates")
        
        # Update progress
        scan_status_tracker.update_progress(
            scan_id,
            progress_message=f"Filtering {len(unique_candidates)} unique candidates...",
            candidates_found=len(unique_candidates)
        )
        
        # Filter candidates
        logger.info(f"Filtering {len(unique_candidates)} unique candidates...")
        filtered = filter_candidates(
            unique_candidates,
            settings_config,
            entities_config.keywords,
            entities_config
        )
        logger.info(f"After filtering: {len(filtered)} candidates remain")
        
        # Update progress
        scan_status_tracker.update_progress(
            scan_id,
            progress_message=f"Scoring and validating {len(filtered)} candidates...",
            candidates_found=len(filtered)
        )
        
        # Get cross-platform signals (stub for now)
        cross_platform_signals = {}
        # Future: tiktok_client.get_cross_platform_signal() for each candidate
        
        # Get Google Trends signals for validation
        logger.info("Validating candidates with Google Trends...")
        google_trends_signals = {}
        for candidate in filtered[:50]:  # Limit to first 50 to avoid rate limits
            try:
                # Check if entity or category keyword is trending
                trend_keyword = candidate.entity_matched or candidate.category
                trend_score = google_trends_client.get_trending_score(trend_keyword)
                google_trends_signals[candidate.video_id] = trend_score
                if trend_score > 0.3:  # Log if significantly trending
                    logger.debug(f"  {candidate.title[:50]}... - Trends score: {trend_score:.2f}")
            except Exception as e:
                logger.warning(f"  Error checking Google Trends for {candidate.video_id}: {e}")
                google_trends_signals[candidate.video_id] = 0.0
        
        # Score candidates
        logger.info(f"Scoring {len(filtered)} filtered candidates...")
        scored = score_candidates(
            filtered,
            entities_config,
            settings_config,
            cross_platform_signals,
            google_trends_signals
        )
        logger.info(f"Scored {len(scored)} candidates")
        
        # Limit candidates per category
        by_category = {}
        for scored_candidate in scored:
            category = scored_candidate.candidate.category
            if category not in by_category:
                by_category[category] = []
            if len(by_category[category]) < settings_config.limits.max_candidates_per_category:
                by_category[category].append(scored_candidate)
        
        # Flatten back to list for storage
        all_scored = []
        for candidates in by_category.values():
            all_scored.extend(candidates)
        
        # Validate candidates before saving (so we know which ones are valid for Discord)
        from core.validators import validate_candidates
        valid_candidates, invalid_candidates = validate_candidates(all_scored)
        
        if invalid_candidates:
            logger.warning(f"Skipping {len(invalid_candidates)} invalid candidates")
            for candidate, errors in invalid_candidates[:5]:  # Log first 5
                logger.warning(f"  - {candidate.candidate.video_id}: {', '.join(errors)}")
        
        # Update progress
        scan_status_tracker.update_progress(
            scan_id,
            progress_message=f"Saving {len(valid_candidates)} valid candidates to database...",
            candidates_found=len(valid_candidates)
        )
        
        # Save to database (only valid candidates)
        logger.info(f"Saving {len(valid_candidates)} valid candidates to database (out of {len(all_scored)} total)...")
        saved_count, error_count, invalid_count, saved_candidates_list = storage.save_run(run_date, valid_candidates)
        logger.info(f"Successfully saved {saved_count} candidates to database")
        if error_count > 0:
            logger.warning(f"Failed to save {error_count} candidates due to errors")
        if invalid_count > 0:
            logger.warning(f"Skipped {invalid_count} invalid candidates")
        
        # Export CSV if enabled
        if settings_config.storage.export_csv:
            csv_path = storage.export_csv(run_date, settings_config.storage.csv_output_dir)
            if csv_path:
                logger.info(f"CSV exported to {csv_path}")
        
        # Update progress
        scan_status_tracker.update_progress(
            scan_id,
            progress_message="Sending notifications...",
            candidates_found=len(valid_candidates),
            candidates_saved=saved_count
        )
        
        # Rank by category for Discord (use only candidates that were actually saved to database)
        if saved_candidates_list:
            top_by_category = rank_by_category(saved_candidates_list, settings_config)
        else:
            logger.warning("No candidates were saved to database, skipping Discord notification")
            top_by_category = {}
        
        # Send Discord notification
        if discord_notifier:
            top_hiphop = top_by_category.get("hip_hop", [])
            top_nba = top_by_category.get("nba", [])
            top_celebrity = top_by_category.get("celebrity", [])
            
            message = discord_notifier.build_summary_message(
                top_hiphop,
                top_nba,
                top_celebrity,
                run_date
            )
            
            success = discord_notifier.send_summary(message)
            if success:
                logger.info("Discord notification sent")
            else:
                logger.error("Failed to send Discord notification")
        
        # Mark scan as completed
        scan_status_tracker.complete_scan(
            scan_id,
            candidates_found=len(valid_candidates),
            candidates_saved=saved_count
        )
        
        logger.info("Scan complete!")
        logger.info(f"Total candidates processed: {len(all_scored)}")
        logger.info(f"Top picks: {sum(len(v) for v in top_by_category.values())} across categories")
        
    except Exception as e:
        # Mark scan as failed
        error_message = str(e)
        scan_status_tracker.fail_scan(scan_id, error_message)
        logger.exception(f"Scan failed: {e}")
        raise


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        sys.exit(1)

