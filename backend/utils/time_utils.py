"""Time and datetime utility functions."""
from datetime import datetime, timedelta, timezone
from typing import Optional


def now() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


def hours_ago(hours: int) -> datetime:
    """Get datetime N hours ago from now (UTC)."""
    return now() - timedelta(hours=hours)


def days_ago(days: int) -> datetime:
    """Get datetime N days ago from now (UTC)."""
    return now() - timedelta(days=days)


def parse_iso_datetime(iso_string: str) -> datetime:
    """Parse ISO 8601 datetime string to datetime object."""
    # Handle various ISO formats
    try:
        # Try parsing with timezone
        return datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
    except ValueError:
        # Try parsing without timezone (assume UTC)
        dt = datetime.fromisoformat(iso_string.replace('Z', ''))
        return dt.replace(tzinfo=timezone.utc)


def format_iso_datetime(dt: datetime) -> str:
    """Format datetime to ISO 8601 string."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace('+00:00', 'Z')


def age_in_hours(published_at: datetime, reference: Optional[datetime] = None) -> float:
    """Calculate age of a datetime in hours."""
    if reference is None:
        reference = now()
    
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=timezone.utc)
    
    delta = reference - published_at
    return max(0.0, delta.total_seconds() / 3600.0)


def format_duration_seconds(seconds: int) -> str:
    """Format duration in seconds to human-readable string (e.g., '1h 23m')."""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    if secs > 0 and hours == 0:  # Only show seconds if less than an hour
        parts.append(f"{secs}s")
    
    return " ".join(parts) if parts else "0s"

