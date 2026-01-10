"""Configuration loader for YAML config files and database settings."""
import yaml
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


@dataclass
class CategoryConfig:
    """Configuration for a single category."""
    entities: list[str]
    channels: list[str]
    category_keywords: list[str]
    priority_weights: dict[str, float]
    enabled: bool = True  # Enable/disable entire category
    enable_entities: bool = True  # Enable/disable entity + keyword searches
    enable_entity_trending: bool = True  # Enable/disable entity trending searches (sorted by viewCount)
    enable_channels: bool = True  # Enable/disable channel + keyword searches
    enable_category_keywords: bool = True  # Enable/disable category keyword searches


@dataclass
class EntitiesConfig:
    """Configuration for entities and categories."""
    categories: dict[str, CategoryConfig]
    keywords: list[str]
    time_window_hours: int
    default_region: str


@dataclass
class ScoringConfig:
    """Scoring algorithm configuration."""
    recency_weight: float
    engagement_weight: float
    velocity_weight: float
    cross_platform_weight: float
    entity_priority_weight: float


@dataclass
class LimitsConfig:
    """Limits configuration."""
    max_candidates_per_category: int
    top_n_per_category_for_discord: int
    min_video_duration_seconds: int
    max_video_duration_seconds: int


@dataclass
class DiscordConfig:
    """Discord notification configuration."""
    enabled: bool
    webhook_url: str = ""  # Optional, can be empty if using env var


@dataclass
class AutomationConfig:
    """Automation configuration."""
    auto_run_on_startup: bool
    scheduled_runs_enabled: bool
    scheduled_time: str  # Format: "HH:MM" in 24-hour format (e.g., "14:30")


@dataclass
class StorageConfig:
    """Storage configuration."""
    database_url: str
    export_csv: bool
    csv_output_dir: str


@dataclass
class YouTubeAPIConfig:
    """YouTube API configuration."""
    max_results_per_query: int
    rate_limit_delay_seconds: float


@dataclass
class APIConfig:
    """API configuration."""
    youtube: YouTubeAPIConfig


@dataclass
class SettingsConfig:
    """Application settings configuration."""
    scoring: ScoringConfig
    limits: LimitsConfig
    discord: DiscordConfig
    automation: AutomationConfig
    storage: StorageConfig
    api: APIConfig


def load_yaml(path: Path) -> Dict[str, Any]:
    """Load a YAML file and return its contents."""
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def load_entities_from_database(database_url: str) -> Optional[Dict[str, Any]]:
    """Load entities from database. Returns None if table doesn't exist or no entities found."""
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if app_settings table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'app_settings'
            )
        """)
        table_exists = cursor.fetchone()['exists']
        
        if not table_exists:
            logger.debug("app_settings table does not exist, will use YAML fallback")
            cursor.close()
            conn.close()
            return None
        
        # Load entities from database
        cursor.execute("""
            SELECT setting_value 
            FROM app_settings
            WHERE setting_key = 'entities'
        """)
        row = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if not row:
            logger.debug("No entities found in database, will use YAML fallback")
            return None
        
        logger.info("Entities loaded from database")
        return row['setting_value']
        
    except Exception as e:
        logger.warning(f"Error loading entities from database: {e}. Will use YAML fallback.")
        return None


def save_entities_to_database(database_url: str, entities_data: Dict[str, Any]) -> bool:
    """Save entities configuration to database. Returns True if successful."""
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Check if app_settings table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'app_settings'
            )
        """)
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            logger.warning("app_settings table does not exist, cannot save entities")
            cursor.close()
            conn.close()
            return False
        
        # Save entities to database
        cursor.execute("""
            INSERT INTO app_settings (setting_key, setting_value, description, updated_at)
            VALUES ('entities', %s::jsonb, 'Entity management configuration (categories, entities, channels, keywords)', CURRENT_TIMESTAMP)
            ON CONFLICT (setting_key) 
            DO UPDATE SET 
              setting_value = EXCLUDED.setting_value,
              updated_at = CURRENT_TIMESTAMP
        """, [json.dumps(entities_data)])
        
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info("Entities saved to database")
        return True
        
    except Exception as e:
        logger.warning(f"Error saving entities to database: {e}")
        return False


def load_entities_config(config_dir: Path, database_url: Optional[str] = None) -> EntitiesConfig:
    """
    Load entities configuration from database (preferred) or YAML (fallback).
    If loaded from YAML and database is available, saves to database for future use.
    
    Args:
        config_dir: Directory containing entities.yaml
        database_url: Optional database URL to load entities from
        
    Returns:
        EntitiesConfig object
    """
    # Try to load from database first
    db_entities = None
    if database_url:
        db_entities = load_entities_from_database(database_url)
    
    # Fallback to YAML if database doesn't have entities
    if db_entities is None:
        entities_path = config_dir / "entities.yaml"
        data = load_yaml(entities_path)
        logger.info("Entities loaded from YAML file (database not available or empty)")
        
        # Save to database if database is available (for future use)
        if database_url:
            logger.info("Saving entities from YAML to database for future use...")
            save_entities_to_database(database_url, data)
    else:
        # Use database entities, but structure them like YAML for compatibility
        data = db_entities
        # Fill in missing sections from YAML if needed
        entities_path = config_dir / "entities.yaml"
        if entities_path.exists():
            yaml_fallback = load_yaml(entities_path)
            for key in ["keywords", "time_window_hours", "default_region"]:
                if key not in data or not data[key]:
                    data[key] = yaml_fallback.get(key, yaml_fallback.get(key, 72 if key == "time_window_hours" else "US" if key == "default_region" else []))
    
    categories = {}
    for cat_name, cat_data in data["categories"].items():
        categories[cat_name] = CategoryConfig(
            entities=cat_data.get("entities", []),
            channels=cat_data.get("channels", []),
            category_keywords=cat_data.get("category_keywords", []),
            priority_weights=cat_data.get("priority_weights", {}),
            enabled=cat_data.get("enabled", True),  # Default to True if not specified
            enable_entities=cat_data.get("enable_entities", True),
            enable_entity_trending=cat_data.get("enable_entity_trending", True),
            enable_channels=cat_data.get("enable_channels", True),
            enable_category_keywords=cat_data.get("enable_category_keywords", True)
        )
    
    return EntitiesConfig(
        categories=categories,
        keywords=data.get("keywords", []),
        time_window_hours=data.get("time_window_hours", 72),
        default_region=data.get("default_region", "US")
    )


def load_settings_from_database(database_url: str) -> Optional[Dict[str, Any]]:
    """Load settings from database. Returns None if table doesn't exist or no settings found."""
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if app_settings table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'app_settings'
            )
        """)
        table_exists = cursor.fetchone()['exists']
        
        if not table_exists:
            logger.debug("app_settings table does not exist, will use YAML fallback")
            cursor.close()
            conn.close()
            return None
        
        # Load settings from database
        cursor.execute("""
            SELECT setting_key, setting_value 
            FROM app_settings
            ORDER BY setting_key
        """)
        rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        if not rows:
            logger.debug("No settings found in database, will use YAML fallback")
            return None
        
        # Convert to dict format
        settings_dict = {}
        for row in rows:
            settings_dict[row['setting_key']] = row['setting_value']
        
        logger.info("Settings loaded from database")
        return settings_dict
        
    except Exception as e:
        logger.warning(f"Error loading settings from database: {e}. Will use YAML fallback.")
        return None


def load_settings_config(config_dir: Path, database_url: Optional[str] = None) -> SettingsConfig:
    """
    Load settings configuration from database (preferred) or YAML (fallback).
    
    Args:
        config_dir: Directory containing settings.yaml
        database_url: Optional database URL to load settings from
        
    Returns:
        SettingsConfig object
    """
    # Try to load from database first
    db_settings = None
    if database_url:
        db_settings = load_settings_from_database(database_url)
    
    # Fallback to YAML if database doesn't have settings
    if db_settings is None:
        settings_path = config_dir / "settings.yaml"
        yaml_data = load_yaml(settings_path)
        logger.info("Settings loaded from YAML file (database not available or empty)")
    else:
        # Use database settings, but structure them like YAML for compatibility
        yaml_data = {
            "scoring": db_settings.get("scoring", {}),
            "limits": db_settings.get("limits", {}),
            "discord": db_settings.get("discord", {}),
            "automation": db_settings.get("automation", {}),
            "storage": db_settings.get("storage", {}),
            "api": db_settings.get("api", {}),
        }
        # Fill in missing sections from YAML if needed
        settings_path = config_dir / "settings.yaml"
        if settings_path.exists():
            yaml_fallback = load_yaml(settings_path)
            for key in ["scoring", "limits", "discord", "automation", "storage", "api"]:
                if key not in yaml_data or not yaml_data[key]:
                    yaml_data[key] = yaml_fallback.get(key, {})
    
    scoring_data = yaml_data.get("scoring", {})
    scoring = ScoringConfig(
        recency_weight=scoring_data.get("recency_weight", 0.3),
        engagement_weight=scoring_data.get("engagement_weight", 0.3),
        velocity_weight=scoring_data.get("velocity_weight", 0.2),
        cross_platform_weight=scoring_data.get("cross_platform_weight", 0.1),
        entity_priority_weight=scoring_data.get("entity_priority_weight", 0.1)
    )
    
    # Log scoring weights source for verification
    if db_settings:
        logger.info(f"Scoring algorithm using database settings: recency={scoring.recency_weight}, engagement={scoring.engagement_weight}, velocity={scoring.velocity_weight}")
    else:
        logger.info(f"Scoring algorithm using YAML settings: recency={scoring.recency_weight}, engagement={scoring.engagement_weight}, velocity={scoring.velocity_weight}")
    
    limits_data = yaml_data.get("limits", {})
    limits = LimitsConfig(
        max_candidates_per_category=limits_data.get("max_candidates_per_category", 200),
        top_n_per_category_for_discord=limits_data.get("top_n_per_category_for_discord", 5),
        min_video_duration_seconds=limits_data.get("min_video_duration_seconds", 60),
        max_video_duration_seconds=limits_data.get("max_video_duration_seconds", 10800)
    )
    
    discord_data = yaml_data.get("discord", {})
    discord = DiscordConfig(
        enabled=discord_data.get("enabled", True),
        webhook_url=discord_data.get("webhook_url", "")
    )
    
    automation_data = yaml_data.get("automation", {})
    automation = AutomationConfig(
        auto_run_on_startup=automation_data.get("auto_run_on_startup", False),
        scheduled_runs_enabled=automation_data.get("scheduled_runs_enabled", False),
        scheduled_time=automation_data.get("scheduled_time", "14:00")  # Default 2 PM
    )
    
    storage_data = yaml_data.get("storage", {})
    storage = StorageConfig(
        database_url=storage_data.get("database_url", ""),  # Will be overridden by env var
        export_csv=storage_data.get("export_csv", True),
        csv_output_dir=storage_data.get("csv_output_dir", "exports")
    )
    
    api_data = yaml_data.get("api", {})
    youtube_data = api_data.get("youtube", {})
    api = APIConfig(
        youtube=YouTubeAPIConfig(
            max_results_per_query=youtube_data.get("max_results_per_query", 50),
            rate_limit_delay_seconds=youtube_data.get("rate_limit_delay_seconds", 1.0)
        )
    )
    
    return SettingsConfig(
        scoring=scoring,
        limits=limits,
        discord=discord,
        automation=automation,
        storage=storage,
        api=api
    )


def load_all_configs(config_dir: Optional[Path] = None, database_url: Optional[str] = None) -> tuple[EntitiesConfig, SettingsConfig]:
    """
    Load both entities and settings configurations.
    
    Args:
        config_dir: Directory containing config files
        database_url: Optional database URL to load settings and entities from (preferred over YAML)
    """
    if config_dir is None:
        config_dir = Path(__file__).parent.parent / "config"
    else:
        config_dir = Path(config_dir)
    
    entities_config = load_entities_config(config_dir, database_url)
    settings_config = load_settings_config(config_dir, database_url)
    
    return entities_config, settings_config

