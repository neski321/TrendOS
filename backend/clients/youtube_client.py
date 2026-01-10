"""YouTube Data API v3 client for searching and fetching video data."""
import time
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from utils.time_utils import parse_iso_datetime, format_iso_datetime

logger = logging.getLogger(__name__)


@dataclass
class VideoCandidate:
    """Represents a video candidate for clipping."""
    video_id: str
    title: str
    channel_title: str
    published_at: datetime
    views: int
    likes: int
    comments: int
    duration_seconds: int
    url: str
    category: str  # hip_hop / nba / celebrity
    entity_matched: str  # which name was matched
    description: str = ""
    thumbnail_url: str = ""


class YouTubeClient:
    """Client for interacting with YouTube Data API v3."""
    
    def __init__(self, api_key_manager, rate_limit_delay: float = 1.0, quota_tracker=None):
        """
        Initialize YouTube client.
        
        Args:
            api_key_manager: APIKeyManager instance for managing multiple API keys
            rate_limit_delay: Delay in seconds between API calls to respect rate limits
            quota_tracker: Optional QuotaTracker instance for quota management
        """
        from core.api_key_manager import APIKeyManager
        
        if isinstance(api_key_manager, APIKeyManager):
            self.api_key_manager = api_key_manager
        else:
            # Backward compatibility: if a string is passed, create a manager with single key
            self.api_key_manager = APIKeyManager([api_key_manager], quota_tracker)
        
        self.rate_limit_delay = rate_limit_delay
        self._last_request_time = 0.0
        self.quota_tracker = quota_tracker
        self._current_api_key = None
        self._youtube_service = None
        self._refresh_youtube_service()
    
    def _refresh_youtube_service(self, api_key: Optional[str] = None):
        """Refresh the YouTube service with a new API key."""
        if api_key is None:
            api_key = self.api_key_manager.get_next_key()
            if api_key is None:
                raise ValueError("No available API keys")
        
        self._current_api_key = api_key
        self._youtube_service = build('youtube', 'v3', developerKey=api_key)
    
    @property
    def youtube(self):
        """Get the YouTube service, refreshing if needed."""
        if self._youtube_service is None:
            self._refresh_youtube_service()
        return self._youtube_service
    
    def _throttle(self):
        """Throttle requests to respect rate limits."""
        current_time = time.time()
        time_since_last = current_time - self._last_request_time
        if time_since_last < self.rate_limit_delay:
            sleep_time = self.rate_limit_delay - time_since_last
            time.sleep(sleep_time)
        self._last_request_time = time.time()
    
    def _parse_duration(self, duration_str: str) -> int:
        """Parse ISO 8601 duration string (PT1H2M10S) to seconds."""
        import re
        pattern = r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?'
        match = re.match(pattern, duration_str)
        if not match:
            return 0
        
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        
        return hours * 3600 + minutes * 60 + seconds
    
    def search_candidates(
        self,
        entity: str,
        keyword: str,
        category: str,
        published_after: datetime,
        max_results: int = 50
    ) -> List[VideoCandidate]:
        """
        Search for video candidates matching entity and keyword.
        
        Args:
            entity: Entity name to search for (e.g., "Drake")
            keyword: Search keyword (e.g., "interview")
            category: Category name (hip_hop, nba, celebrity)
            published_after: Only return videos published after this datetime
            max_results: Maximum number of results to return
            
        Returns:
            List of VideoCandidate objects
        """
        query = f"{entity} {keyword}"
        published_after_iso = format_iso_datetime(published_after)
        
        candidates = []
        next_page_token = None
        
        try:
            while len(candidates) < max_results:
                self._throttle()
                
                # Get available API key with sufficient quota
                required_units = 100  # search.list costs 100 units
                api_key = self.api_key_manager.get_available_key(required_units)
                if api_key is None:
                    logger.error("No API keys available with sufficient quota")
                    break
                
                # Refresh service if key changed
                if api_key != self._current_api_key:
                    self._refresh_youtube_service(api_key)
                
                # Search for videos (English content only)
                search_response = self.youtube.search().list(
                    q=query,
                    part='id,snippet',
                    type='video',
                    order='date',
                    publishedAfter=published_after_iso,
                    maxResults=min(50, max_results - len(candidates)),
                    pageToken=next_page_token,
                    relevanceLanguage='en',  # Filter for English content only
                    regionCode='US'  # Further prioritize US/English content
                ).execute()
                
                # Record quota usage
                if self.quota_tracker:
                    self.quota_tracker.record_quota_usage('search.list')
                
                if not search_response.get('items'):
                    break
                
                # Extract video IDs
                video_ids = [item['id']['videoId'] for item in search_response['items']]
                
                if not video_ids:
                    break
                
                # Get detailed video information
                self._throttle()
                
                # Check quota before making request
                if self.quota_tracker:
                    required_units = len(video_ids)  # videos.list costs 1 unit per video
                    is_available, usage = self.quota_tracker.check_quota_available(required_units)
                    if not is_available:
                        logger.warning(
                            f"Insufficient quota to fetch video details. "
                            f"Used: {usage['used']}/{usage['limit']} ({usage['percentage']}%)"
                        )
                        break
                
                videos_response = self.youtube.videos().list(
                    part='statistics,contentDetails,snippet',
                    id=','.join(video_ids)
                ).execute()
                
                # Record quota usage
                if self.quota_tracker:
                    self.quota_tracker.record_quota_usage('videos.list', units=len(video_ids))
                
                for video_item in videos_response.get('items', []):
                    try:
                        video_id = video_item['id']
                        snippet = video_item['snippet']
                        statistics = video_item.get('statistics', {})
                        content_details = video_item.get('contentDetails', {})
                        
                        # Filter for English content only (stricter check)
                        default_language = snippet.get('defaultLanguage', '').lower()
                        default_audio_language = snippet.get('defaultAudioLanguage', '').lower()
                        
                        # Skip if language is explicitly set and not English
                        if default_language and default_language != 'en':
                            logger.debug(f"Skipping video {video_id}: defaultLanguage is '{default_language}', not 'en'")
                            continue
                        
                        if default_audio_language and default_audio_language != 'en':
                            logger.debug(f"Skipping video {video_id}: defaultAudioLanguage is '{default_audio_language}', not 'en'")
                            continue
                        
                        published_at = parse_iso_datetime(snippet['publishedAt'])
                        duration_seconds = self._parse_duration(content_details.get('duration', 'PT0S'))
                        
                        candidate = VideoCandidate(
                            video_id=video_id,
                            title=snippet.get('title', ''),
                            channel_title=snippet.get('channelTitle', ''),
                            published_at=published_at,
                            views=int(statistics.get('viewCount', 0)),
                            likes=int(statistics.get('likeCount', 0)),
                            comments=int(statistics.get('commentCount', 0)),
                            duration_seconds=duration_seconds,
                            url=f"https://www.youtube.com/watch?v={video_id}",
                            category=category,
                            entity_matched=entity,
                            description=snippet.get('description', ''),
                            thumbnail_url=snippet.get('thumbnails', {}).get('high', {}).get('url', '')
                        )
                        
                        candidates.append(candidate)
                    except (KeyError, ValueError) as e:
                        logger.warning(f"Error parsing video {video_item.get('id', 'unknown')}: {e}")
                        continue
                
                next_page_token = search_response.get('nextPageToken')
                if not next_page_token:
                    break
                    
        except HttpError as e:
            logger.error(f"YouTube API error for query '{query}': {e}")
            if e.resp.status == 403:
                logger.error("Rate limit exceeded or API key invalid")
                # Mark current key as exhausted and try next one
                if self._current_api_key:
                    self.api_key_manager.mark_key_exhausted(self._current_api_key)
                    logger.info("Marked API key as exhausted, will try next key on retry")
            raise
        except Exception as e:
            logger.error(f"Unexpected error searching YouTube: {e}")
            raise
        
        logger.info(f"Found {len(candidates)} candidates for '{entity} {keyword}'")
        return candidates
    
    def search_by_category_keyword(
        self,
        category_keyword: str,
        category: str,
        published_after: datetime,
        max_results: int = 50,
        order: str = "viewCount"  # Use viewCount for trending, or "date" for recent
    ) -> List[VideoCandidate]:
        """
        Search for trending videos by category keyword (e.g., "hip hop", "NBA", "celebrity news").
        
        Args:
            category_keyword: Category keyword to search for (e.g., "hip hop", "NBA")
            category: Category name (hip_hop, nba, celebrity)
            published_after: Only return videos published after this datetime
            max_results: Maximum number of results to return
            order: Sort order - "viewCount" for trending, "date" for recent, "rating" for top rated
            
        Returns:
            List of VideoCandidate objects
        """
        query = category_keyword
        published_after_iso = format_iso_datetime(published_after)
        
        candidates = []
        next_page_token = None
        
        try:
            while len(candidates) < max_results:
                self._throttle()
                
                # Get available API key with sufficient quota
                required_units = 100  # search.list costs 100 units
                api_key = self.api_key_manager.get_available_key(required_units)
                if api_key is None:
                    logger.error("No API keys available with sufficient quota")
                    break
                
                # Refresh service if key changed
                if api_key != self._current_api_key:
                    self._refresh_youtube_service(api_key)
                
                # Search for videos (English content only)
                search_response = self.youtube.search().list(
                    q=query,
                    part='id,snippet',
                    type='video',
                    order=order,  # Use viewCount to get trending content
                    publishedAfter=published_after_iso,
                    maxResults=min(50, max_results - len(candidates)),
                    pageToken=next_page_token,
                    relevanceLanguage='en',  # Filter for English content only
                    regionCode='US'  # Further prioritize US/English content
                ).execute()
                
                # Record quota usage
                if self.quota_tracker:
                    self.quota_tracker.record_quota_usage('search.list', api_key=api_key)
                
                if not search_response.get('items'):
                    break
                
                # Extract video IDs
                video_ids = [item['id']['videoId'] for item in search_response['items']]
                
                if not video_ids:
                    break
                
                # Get detailed video information
                self._throttle()
                
                # Get available API key with sufficient quota
                required_units = len(video_ids)  # videos.list costs 1 unit per video
                api_key = self.api_key_manager.get_available_key(required_units)
                if api_key is None:
                    logger.error("No API keys available with sufficient quota for video details")
                    break
                
                # Refresh service if key changed
                if api_key != self._current_api_key:
                    self._refresh_youtube_service(api_key)
                
                videos_response = self.youtube.videos().list(
                    part='statistics,contentDetails,snippet',
                    id=','.join(video_ids)
                ).execute()
                
                # Record quota usage
                if self.quota_tracker:
                    self.quota_tracker.record_quota_usage('videos.list', units=len(video_ids), api_key=api_key)
                
                for video_item in videos_response.get('items', []):
                    try:
                        video_id = video_item['id']
                        snippet = video_item['snippet']
                        statistics = video_item.get('statistics', {})
                        content_details = video_item.get('contentDetails', {})
                        
                        # Filter for English content only (stricter check)
                        default_language = snippet.get('defaultLanguage', '').lower()
                        default_audio_language = snippet.get('defaultAudioLanguage', '').lower()
                        
                        # Skip if language is explicitly set and not English
                        if default_language and default_language != 'en':
                            logger.debug(f"Skipping video {video_id}: defaultLanguage is '{default_language}', not 'en'")
                            continue
                        
                        if default_audio_language and default_audio_language != 'en':
                            logger.debug(f"Skipping video {video_id}: defaultAudioLanguage is '{default_audio_language}', not 'en'")
                            continue
                        
                        published_at = parse_iso_datetime(snippet['publishedAt'])
                        duration_seconds = self._parse_duration(content_details.get('duration', 'PT0S'))
                        
                        # For category-wide searches, use the category keyword as the entity
                        candidate = VideoCandidate(
                            video_id=video_id,
                            title=snippet.get('title', ''),
                            channel_title=snippet.get('channelTitle', ''),
                            published_at=published_at,
                            views=int(statistics.get('viewCount', 0)),
                            likes=int(statistics.get('likeCount', 0)),
                            comments=int(statistics.get('commentCount', 0)),
                            duration_seconds=duration_seconds,
                            url=f"https://www.youtube.com/watch?v={video_id}",
                            category=category,
                            entity_matched=category_keyword,  # Use category keyword as entity
                            description=snippet.get('description', ''),
                            thumbnail_url=snippet.get('thumbnails', {}).get('high', {}).get('url', '')
                        )
                        
                        candidates.append(candidate)
                    except (KeyError, ValueError) as e:
                        logger.warning(f"Error parsing video {video_item.get('id', 'unknown')}: {e}")
                        continue
                
                next_page_token = search_response.get('nextPageToken')
                if not next_page_token:
                    break
                    
        except HttpError as e:
            logger.error(f"YouTube API error for category keyword '{query}': {e}")
            if e.resp.status == 403:
                logger.error("Rate limit exceeded or API key invalid")
                # Mark current key as exhausted and try next one
                if self._current_api_key:
                    self.api_key_manager.mark_key_exhausted(self._current_api_key)
                    logger.info("Marked API key as exhausted, will try next key on retry")
            raise
        except Exception as e:
            logger.error(f"Unexpected error searching YouTube for category keyword: {e}")
            raise
        
        logger.info(f"Found {len(candidates)} candidates for category keyword '{category_keyword}'")
        return candidates
    
    def search_entity_trending(
        self,
        entity: str,
        category: str,
        published_after: datetime,
        max_results: int = 20
    ) -> List[VideoCandidate]:
        """
        Search for trending videos related to a specific entity, sorted by viewCount.
        This is useful for catching trending topics where a specific keyword might not be known.
        
        For example: "Idris Elba" being knighted - searching just "Idris Elba" sorted by views
        will catch recent trending news without needing specific keywords like "interview" or "podcast".
        
        Args:
            entity: Entity name to search for (e.g., "Idris Elba", "LeBron James")
            category: Category name (hip_hop, nba, celebrity)
            published_after: Only return videos published after this datetime
            max_results: Maximum number of results to return (default: 20 to avoid too many results)
            
        Returns:
            List of VideoCandidate objects
        """
        query = entity  # Search only by entity name, no additional keywords
        published_after_iso = format_iso_datetime(published_after)
        
        candidates = []
        next_page_token = None
        
        try:
            while len(candidates) < max_results:
                self._throttle()
                
                # Get available API key with sufficient quota
                required_units = 100  # search.list costs 100 units
                api_key = self.api_key_manager.get_available_key(required_units)
                if api_key is None:
                    logger.error("No API keys available with sufficient quota for entity trending search")
                    break
                
                # Refresh service if key changed
                if api_key != self._current_api_key:
                    self._refresh_youtube_service(api_key)
                
                # Search for videos (English content only, sorted by viewCount to find trending)
                search_response = self.youtube.search().list(
                    q=query,
                    part='id,snippet',
                    type='video',
                    order='viewCount',  # Sort by viewCount to find trending videos
                    publishedAfter=published_after_iso,
                    maxResults=min(50, max_results - len(candidates)),
                    pageToken=next_page_token,
                    relevanceLanguage='en',
                    regionCode='US'
                ).execute()
                
                # Record quota usage
                if self.quota_tracker:
                    self.quota_tracker.record_quota_usage('search.list', api_key=api_key)
                
                if not search_response.get('items'):
                    break
                
                # Extract video IDs
                video_ids = [item['id']['videoId'] for item in search_response['items']]
                if not video_ids:
                    break
                
                # Fetch video details (statistics, duration, etc.)
                self._throttle()
                
                required_units = len(video_ids)  # videos.list costs 1 unit per video
                api_key = self.api_key_manager.get_available_key(required_units)
                if api_key is None:
                    logger.error("No API keys available with sufficient quota for video details (entity trending)")
                    break
                
                # Refresh service if key changed
                if api_key != self._current_api_key:
                    self._refresh_youtube_service(api_key)
                
                videos_response = self.youtube.videos().list(
                    part='statistics,contentDetails,snippet',
                    id=','.join(video_ids)
                ).execute()
                
                # Record quota usage
                if self.quota_tracker:
                    self.quota_tracker.record_quota_usage('videos.list', units=len(video_ids), api_key=api_key)
                
                # Process each video
                for video_item in videos_response.get('items', []):
                    try:
                        video_id = video_item['id']
                        snippet = video_item['snippet']
                        statistics = video_item.get('statistics', {})
                        content_details = video_item.get('contentDetails', {})
                        
                        # Stricter English-only filtering (check defaultLanguage and defaultAudioLanguage)
                        default_language = snippet.get('defaultLanguage', '').lower()
                        default_audio_language = snippet.get('defaultAudioLanguage', '').lower()
                        
                        # Skip if video is in a language other than English
                        if (default_language and default_language != 'en') or \
                           (default_audio_language and default_audio_language != 'en'):
                            logger.debug(f"Skipping non-English video {video_id} (Default Lang: {default_language}, Audio Lang: {default_audio_language})")
                            continue
                        
                        # Parse video data
                        published_at = parse_iso_datetime(snippet['publishedAt'])
                        duration_seconds = self._parse_duration(content_details.get('duration', 'PT0S'))
                        
                        candidate = VideoCandidate(
                            video_id=video_id,
                            title=snippet.get('title', ''),
                            channel_title=snippet.get('channelTitle', ''),
                            published_at=published_at,
                            views=int(statistics.get('viewCount', 0)),
                            likes=int(statistics.get('likeCount', 0)),
                            comments=int(statistics.get('commentCount', 0)),
                            duration_seconds=duration_seconds,
                            url=f"https://www.youtube.com/watch?v={video_id}",
                            category=category,
                            entity_matched=entity,  # Matched by the entity itself (no keyword)
                            description=snippet.get('description', ''),
                            thumbnail_url=snippet.get('thumbnails', {}).get('high', {}).get('url', '')
                        )
                        candidates.append(candidate)
                    except (KeyError, ValueError) as e:
                        logger.warning(f"Error parsing video {video_item.get('id', 'unknown')}: {e}")
                        continue
                
                # Check for next page
                next_page_token = search_response.get('nextPageToken')
                if not next_page_token:
                    break
        
        except HttpError as e:
            logger.error(f"YouTube API error for entity trending '{query}': {e}")
            if e.resp.status == 403:
                logger.error("Rate limit exceeded or API key invalid")
                if self._current_api_key:
                    self.api_key_manager.mark_key_exhausted(self._current_api_key)
                    logger.info("Marked API key as exhausted, will try next key on retry")
            raise
        except Exception as e:
            logger.error(f"Unexpected error searching YouTube for entity trending: {e}")
            raise
        
        logger.info(f"Found {len(candidates)} trending candidates for entity '{entity}'")
        return candidates
    
    def get_trending(self, region: str = "US", max_results: int = 50) -> List[VideoCandidate]:
        """
        Get trending videos for a region (stub for future implementation).
        
        Note: This requires OAuth2 authentication and is not implemented yet.
        """
        logger.warning("get_trending() is not yet implemented (requires OAuth2)")
        return []

