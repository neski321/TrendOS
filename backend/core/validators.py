"""Data validation utilities for video candidates."""
import logging
from datetime import datetime, timezone
from typing import List, Tuple
from clients.youtube_client import VideoCandidate
from core.scorer import ScoredCandidate

logger = logging.getLogger(__name__)

# Validation limits
MAX_TITLE_LENGTH = 500
MAX_DESCRIPTION_LENGTH = 5000
MAX_VIEWS = 10_000_000_000  # 10 billion (reasonable max for YouTube)
MAX_LIKES = 100_000_000  # 100 million
MAX_COMMENTS = 50_000_000  # 50 million
MAX_DURATION_SECONDS = 86400  # 24 hours (reasonable max)
MIN_DURATION_SECONDS = 0


def validate_candidate(candidate: VideoCandidate) -> Tuple[bool, List[str]]:
    """
    Validate a video candidate before saving.
    
    Args:
        candidate: VideoCandidate to validate
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    # Validate video_id
    if not candidate.video_id or len(candidate.video_id) == 0:
        errors.append("video_id is required")
    elif len(candidate.video_id) > 50:  # YouTube video IDs are typically 11 chars
        errors.append(f"video_id too long: {len(candidate.video_id)} chars")
    
    # Validate title
    if not candidate.title or len(candidate.title.strip()) == 0:
        errors.append("title is required")
    elif len(candidate.title) > MAX_TITLE_LENGTH:
        errors.append(f"title too long: {len(candidate.title)} chars (max: {MAX_TITLE_LENGTH})")
    
    # Validate channel_title
    if not candidate.channel_title or len(candidate.channel_title.strip()) == 0:
        errors.append("channel_title is required")
    elif len(candidate.channel_title) > 200:
        errors.append(f"channel_title too long: {len(candidate.channel_title)} chars")
    
    # Validate published_at
    if not candidate.published_at:
        errors.append("published_at is required")
    else:
        # Check if date is in the future (more than 1 hour tolerance for timezone issues)
        now = datetime.now(timezone.utc)
        if candidate.published_at > now:
            # Allow 1 hour tolerance for timezone differences
            time_diff = (candidate.published_at - now).total_seconds()
            if time_diff > 3600:  # More than 1 hour in future
                errors.append(f"published_at is in the future: {candidate.published_at}")
        
        # Check if date is too old (more than 10 years)
        ten_years_ago = datetime(2014, 1, 1, tzinfo=timezone.utc)
        if candidate.published_at < ten_years_ago:
            errors.append(f"published_at is too old: {candidate.published_at}")
    
    # Validate views
    if candidate.views is None:
        errors.append("views is required")
    elif candidate.views < 0:
        errors.append(f"views cannot be negative: {candidate.views}")
    elif candidate.views > MAX_VIEWS:
        errors.append(f"views too large: {candidate.views} (max: {MAX_VIEWS})")
    
    # Validate likes
    if candidate.likes is None:
        errors.append("likes is required")
    elif candidate.likes < 0:
        errors.append(f"likes cannot be negative: {candidate.likes}")
    elif candidate.likes > MAX_LIKES:
        errors.append(f"likes too large: {candidate.likes} (max: {MAX_LIKES})")
    
    # Validate comments
    if candidate.comments is None:
        errors.append("comments is required")
    elif candidate.comments < 0:
        errors.append(f"comments cannot be negative: {candidate.comments}")
    elif candidate.comments > MAX_COMMENTS:
        errors.append(f"comments too large: {candidate.comments} (max: {MAX_COMMENTS})")
    
    # Validate duration
    if candidate.duration_seconds is None:
        errors.append("duration_seconds is required")
    elif candidate.duration_seconds < MIN_DURATION_SECONDS:
        errors.append(f"duration_seconds cannot be negative: {candidate.duration_seconds}")
    elif candidate.duration_seconds > MAX_DURATION_SECONDS:
        errors.append(f"duration_seconds too large: {candidate.duration_seconds} (max: {MAX_DURATION_SECONDS})")
    
    # Validate URL
    if not candidate.url or len(candidate.url.strip()) == 0:
        errors.append("url is required")
    elif not candidate.url.startswith(('http://', 'https://')):
        errors.append(f"url must start with http:// or https://: {candidate.url[:50]}")
    elif 'youtube.com/watch' not in candidate.url and 'youtu.be' not in candidate.url:
        errors.append(f"url does not appear to be a YouTube URL: {candidate.url[:50]}")
    
    # Validate category
    valid_categories = ['hip_hop', 'nba', 'celebrity']
    if not candidate.category:
        errors.append("category is required")
    elif candidate.category not in valid_categories:
        errors.append(f"invalid category: {candidate.category} (must be one of: {valid_categories})")
    
    # Validate entity_matched
    if not candidate.entity_matched or len(candidate.entity_matched.strip()) == 0:
        errors.append("entity_matched is required")
    elif len(candidate.entity_matched) > 200:
        errors.append(f"entity_matched too long: {len(candidate.entity_matched)} chars")
    
    # Validate description (optional but if present, check length)
    if candidate.description and len(candidate.description) > MAX_DESCRIPTION_LENGTH:
        errors.append(f"description too long: {len(candidate.description)} chars (max: {MAX_DESCRIPTION_LENGTH})")
    
    # Validate thumbnail_url (optional but if present, check format)
    if candidate.thumbnail_url and not candidate.thumbnail_url.startswith(('http://', 'https://')):
        errors.append(f"thumbnail_url must start with http:// or https://: {candidate.thumbnail_url[:50]}")
    
    is_valid = len(errors) == 0
    return is_valid, errors


def validate_scored_candidate(scored: ScoredCandidate) -> Tuple[bool, List[str]]:
    """
    Validate a scored candidate (includes score validation).
    
    Args:
        scored: ScoredCandidate to validate
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    is_valid, errors = validate_candidate(scored.candidate)
    
    # Validate score
    if scored.score is None:
        errors.append("score is required")
    elif not isinstance(scored.score, (int, float)):
        errors.append(f"score must be a number: {type(scored.score)}")
    elif scored.score < 0:
        errors.append(f"score cannot be negative: {scored.score}")
    elif scored.score > 1000:  # Reasonable max score
        errors.append(f"score too large: {scored.score} (max: 1000)")
    
    is_valid = len(errors) == 0
    return is_valid, errors


def validate_candidates(candidates: List[ScoredCandidate]) -> Tuple[List[ScoredCandidate], List[Tuple[ScoredCandidate, List[str]]]]:
    """
    Validate a list of candidates, returning valid ones and invalid ones with errors.
    
    Args:
        candidates: List of ScoredCandidates to validate
        
    Returns:
        Tuple of (valid_candidates, invalid_candidates_with_errors)
    """
    valid = []
    invalid = []
    
    # Track error types for summary
    error_counts = {}
    
    for candidate in candidates:
        is_valid, errors = validate_scored_candidate(candidate)
        if is_valid:
            valid.append(candidate)
        else:
            invalid.append((candidate, errors))
            # Count error types
            for error in errors:
                error_type = error.split(':')[0] if ':' in error else error.split(' ')[0]
                error_counts[error_type] = error_counts.get(error_type, 0) + 1
            
            # Log first 5 invalid candidates with details
            if len(invalid) <= 5:
                logger.warning(
                    f"Invalid candidate {candidate.candidate.video_id}: {', '.join(errors)}"
                )
    
    if invalid:
        logger.warning(f"Filtered out {len(invalid)} invalid candidates out of {len(candidates)} total")
        if error_counts:
            logger.info(f"  Most common validation errors:")
            for error_type, count in sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
                logger.info(f"    - {error_type}: {count} occurrences")
    
    return valid, invalid





