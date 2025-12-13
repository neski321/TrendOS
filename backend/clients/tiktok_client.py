"""TikTok API client (stub for future implementation)."""
import logging
from typing import List, Optional
from clients.youtube_client import VideoCandidate

logger = logging.getLogger(__name__)


class TikTokClient:
    """Client for interacting with TikTok API (stub)."""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize TikTok client.
        
        Args:
            api_key: TikTok API key (not yet implemented)
        """
        self.api_key = api_key
        logger.info("TikTok client initialized (stub - not yet implemented)")
    
    def search_trending(self, category: str, max_results: int = 50) -> List[VideoCandidate]:
        """
        Search for trending TikTok videos (stub).
        
        Args:
            category: Category to search (hip_hop, nba, celebrity)
            max_results: Maximum number of results
            
        Returns:
            Empty list (not yet implemented)
        """
        logger.warning("TikTok search_trending() is not yet implemented")
        return []
    
    def get_cross_platform_signal(self, video_title: str, entity: str) -> float:
        """
        Get cross-platform trending signal for a video (stub).
        
        Args:
            video_title: Title of the video
            entity: Entity name
            
        Returns:
            0.0 (not yet implemented)
        """
        # Future: Check if similar content is trending on TikTok
        return 0.0

