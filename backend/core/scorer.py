"""Scoring and ranking logic for video candidates."""
import math
import logging
from typing import List, Dict
from collections import defaultdict

from clients.youtube_client import VideoCandidate
from utils.time_utils import age_in_hours, now
from utils.config_loader import SettingsConfig, EntitiesConfig

logger = logging.getLogger(__name__)


def calculate_score(
    candidate: VideoCandidate,
    weights: Dict[str, float],
    entity_priority_map: Dict[str, float],
    time_window_hours: int,
    cross_platform_signal: float = 0.0
) -> float:
    """
    Calculate clip potential score (0-100) for a video candidate.
    
    Args:
        candidate: Video candidate to score
        weights: Scoring weights from config
        entity_priority_map: Map of entity names to priority multipliers
        time_window_hours: Time window for recency calculation
        cross_platform_signal: Cross-platform trending signal (0-1)
        
    Returns:
        Score between 0 and 100
    """
    age_hours = max(1.0, age_in_hours(candidate.published_at))
    
    # Recency score: 1.0 for brand new, fading to 0 at time_window_hours
    recency = max(0.0, 1.0 - (age_hours / time_window_hours))
    
    # Engagement score: based on like/view ratio
    like_ratio = candidate.likes / candidate.views if candidate.views > 0 else 0.0
    # Normalize around 5% like rate (typical for YouTube)
    engagement = min(1.0, like_ratio / 0.05)
    # Also factor in absolute engagement (views)
    view_score = min(1.0, math.log10(max(1, candidate.views)) / 7.0)  # log scale, cap at ~10M views
    engagement = (engagement * 0.6) + (view_score * 0.4)
    
    # Velocity score: views per hour (log-scaled)
    views_per_hour = candidate.views / age_hours if age_hours > 0 else 0
    # Log scale: 100 views/hr = ~0.2, 10k views/hr = ~0.6, 100k views/hr = ~0.8
    velocity = min(1.0, math.log10(max(1.0, views_per_hour + 1)) / 5.0)
    
    # Entity priority: look up from config, default 1.0
    priority = entity_priority_map.get(candidate.entity_matched, 1.0)
    # Normalize priority to 0-1 range (assuming max priority is ~2.0)
    priority_normalized = min(1.0, priority / 2.0)
    
    # Use cross-platform signal if available
    trend_signal = cross_platform_signal if cross_platform_signal > 0 else 0.0
    
    # Calculate weighted score
    score = (
        weights["recency_weight"] * recency +
        weights["engagement_weight"] * engagement +
        weights["velocity_weight"] * velocity +
        weights["cross_platform_weight"] * trend_signal +
        weights["entity_priority_weight"] * priority_normalized
    )
    
    # Scale to 0-100
    final_score = max(0.0, min(100.0, score * 100))
    
    return final_score


def filter_candidates(
    candidates: List[VideoCandidate],
    config: SettingsConfig,
    keywords: List[str],
    entities_config: EntitiesConfig = None
) -> List[VideoCandidate]:
    """
    Filter candidates based on criteria.
    
    Args:
        candidates: List of video candidates
        config: Settings configuration
        keywords: List of required keywords
        
    Returns:
        Filtered list of candidates
    """
    filtered = []
    
    # Track rejection reasons for logging
    rejected_duration_min = 0
    rejected_duration_max = 0
    rejected_keyword = 0
    rejected_entity = 0
    passed = 0
    
    for candidate in candidates:
        # Check duration limits
        if candidate.duration_seconds < config.limits.min_video_duration_seconds:
            rejected_duration_min += 1
            continue
        if candidate.duration_seconds > config.limits.max_video_duration_seconds:
            rejected_duration_max += 1
            continue
        
        # Check if title or description contains at least one keyword
        title_lower = candidate.title.lower() if candidate.title else ""
        desc_lower = (candidate.description.lower() if candidate.description else "")
        text_to_search = f"{title_lower} {desc_lower}"
        
        has_keyword = any(keyword.lower() in text_to_search for keyword in keywords)
        
        if not has_keyword:
            rejected_keyword += 1
            if rejected_keyword <= 3:  # Log first 3 examples
                logger.debug(f"  Rejected (no keyword): {candidate.title[:60] if candidate.title else 'No title'}... (keywords: {keywords[:3]}...)")
            continue
        
        # Check if entity name appears in title or description
        # For category-wide searches (like "hip hop"), entity_matched is the category keyword,
        # so we don't need to check for entity match (it's already in the search query)
        entity_lower = (candidate.entity_matched.lower() if candidate.entity_matched else "")
        
        # Check if this is a category keyword search (entity_matched is a category keyword)
        # If so, we only need keyword match, not entity match
        is_category_keyword = False
        if entities_config:
            is_category_keyword = any(
                entity_lower == cat_kw.lower() 
                for cat_config in entities_config.categories.values() 
                for cat_kw in cat_config.category_keywords
            )
        
        if not is_category_keyword:
            # For entity-specific searches, require entity name in title/description
            has_entity = entity_lower in text_to_search if entity_lower else False
            if not has_entity:
                rejected_entity += 1
                if rejected_entity <= 3:  # Log first 3 examples
                    logger.debug(f"  Rejected (no entity match): {candidate.title[:60] if candidate.title else 'No title'}... (entity: {candidate.entity_matched})")
                continue
        
        passed += 1
        filtered.append(candidate)
    
    # Log detailed filtering statistics
    logger.info(f"Filtered {len(candidates)} candidates to {len(filtered)}")
    if len(candidates) > 0:
        logger.info(f"  Rejection reasons:")
        logger.info(f"    - Duration too short (<{config.limits.min_video_duration_seconds}s): {rejected_duration_min}")
        logger.info(f"    - Duration too long (>{config.limits.max_video_duration_seconds}s): {rejected_duration_max}")
        logger.info(f"    - No keyword match: {rejected_keyword}")
        logger.info(f"    - No entity match: {rejected_entity}")
        logger.info(f"    - Passed all filters: {passed}")
        logger.info(f"  Required keywords: {keywords}")
    
    return filtered


def score_candidates(
    candidates: List[VideoCandidate],
    entities_config: EntitiesConfig,
    settings_config: SettingsConfig,
    cross_platform_signals: Dict[str, float] = None
) -> List[VideoCandidate]:
    """
    Score all candidates.
    
    Args:
        candidates: List of video candidates
        entities_config: Entities configuration
        settings_config: Settings configuration
        cross_platform_signals: Optional dict mapping video_id to cross-platform signal
        
    Returns:
        List of candidates with scores (as a new attribute, but we'll use a tuple for now)
    """
    if cross_platform_signals is None:
        cross_platform_signals = {}
    
    # Build entity priority map from all categories
    entity_priority_map = {}
    for category_config in entities_config.categories.values():
        entity_priority_map.update(category_config.priority_weights)
    
    # Build weights dict
    weights = {
        "recency_weight": settings_config.scoring.recency_weight,
        "engagement_weight": settings_config.scoring.engagement_weight,
        "velocity_weight": settings_config.scoring.velocity_weight,
        "cross_platform_weight": settings_config.scoring.cross_platform_weight,
        "entity_priority_weight": settings_config.scoring.entity_priority_weight,
    }
    
    scored_candidates = []
    for candidate in candidates:
        cross_signal = cross_platform_signals.get(candidate.video_id, 0.0)
        score = calculate_score(
            candidate,
            weights,
            entity_priority_map,
            entities_config.time_window_hours,
            cross_signal
        )
        
        # Add score as attribute (we'll create a scored version)
        scored_candidate = ScoredCandidate(candidate, score)
        scored_candidates.append(scored_candidate)
    
    # Sort by score descending
    scored_candidates.sort(key=lambda x: x.score, reverse=True)
    
    logger.info(f"Scored {len(scored_candidates)} candidates")
    return scored_candidates


class ScoredCandidate:
    """Wrapper for VideoCandidate with score."""
    def __init__(self, candidate: VideoCandidate, score: float):
        self.candidate = candidate
        self.score = score
    
    def __getattr__(self, name):
        # Delegate attribute access to candidate
        return getattr(self.candidate, name)


def rank_by_category(
    scored_candidates: List[ScoredCandidate],
    settings_config: SettingsConfig
) -> Dict[str, List[ScoredCandidate]]:
    """
    Rank candidates by category and return top N per category.
    
    Args:
        scored_candidates: List of scored candidates
        settings_config: Settings configuration
        
    Returns:
        Dict mapping category names to top candidates
    """
    # Group by category
    by_category = defaultdict(list)
    for scored in scored_candidates:
        by_category[scored.candidate.category].append(scored)
    
    # Sort each category by score and take top N
    top_by_category = {}
    for category, candidates in by_category.items():
        # Deduplicate: keep highest scoring video per (entity, channel) pair
        seen = {}
        for candidate in candidates:
            key = (candidate.candidate.entity_matched, candidate.candidate.channel_title)
            if key not in seen or candidate.score > seen[key].score:
                seen[key] = candidate
        
        # Sort by score and take top N
        unique_candidates = list(seen.values())
        unique_candidates.sort(key=lambda x: x.score, reverse=True)
        top_n = unique_candidates[:settings_config.limits.top_n_per_category_for_discord]
        
        top_by_category[category] = top_n
    
    logger.info(f"Ranked candidates: {sum(len(v) for v in top_by_category.values())} top picks across categories")
    return top_by_category

