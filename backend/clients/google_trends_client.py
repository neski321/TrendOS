"""Google Trends API client for validating trending topics."""
import time
import logging
import warnings
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from pytrends.request import TrendReq

# Suppress pandas FutureWarning from pytrends library
warnings.filterwarnings('ignore', category=FutureWarning, module='pytrends')

logger = logging.getLogger(__name__)


class GoogleTrendsClient:
    """
    Client for interacting with Google Trends API.
    
    Supports two modes:
    1. Official Google Trends API (if API key provided) - more reliable, requires alpha access
    2. pytrends library (fallback) - no API key needed, but may be rate-limited
    """
    
    def __init__(
        self, 
        rate_limit_delay: float = 1.0, 
        geo: str = "US", 
        hl: str = "en-US",
        api_key: Optional[str] = None
    ):
        """
        Initialize Google Trends client.
        
        Args:
            rate_limit_delay: Delay in seconds between API calls to respect rate limits
            geo: Geographic location code (default: "US")
            hl: Language code (default: "en-US")
            api_key: Optional Google Trends API key (if using official API)
        """
        self.rate_limit_delay = rate_limit_delay
        self.geo = geo
        self.hl = hl
        self.api_key = api_key
        self.use_official_api = api_key is not None
        
        if self.use_official_api:
            logger.info("Using official Google Trends API (alpha)")
            # TODO: Implement official API client when API details are available
            # For now, fall back to pytrends but log that API key was provided
            logger.warning("Official Google Trends API integration not yet implemented. Using pytrends fallback.")
            logger.warning("Note: Official API requires alpha access. See: https://developers.google.com/search/apis/trends")
            self.use_official_api = False  # Fall back until official API is implemented
        
        # Use pytrends (works without API key)
        self.pytrends = TrendReq(hl=hl, tz=360)  # tz=360 is UTC-6 (US Central)
        self._last_request_time = 0.0
        self._trend_cache: Dict[str, Dict] = {}
        self._cache_duration = timedelta(hours=1)  # Cache results for 1 hour
        
        if not self.use_official_api:
            logger.info("Using pytrends library (no API key required)")
    
    def _throttle(self):
        """Throttle requests to respect rate limits."""
        current_time = time.time()
        time_since_last = current_time - self._last_request_time
        if time_since_last < self.rate_limit_delay:
            sleep_time = self.rate_limit_delay - time_since_last
            time.sleep(sleep_time)
        self._last_request_time = time.time()
    
    def get_trending_score(
        self,
        keyword: str,
        timeframe: str = "today 3-m"  # Last 3 months
    ) -> float:
        """
        Get trending score (0-100) for a keyword.
        
        Args:
            keyword: Search term to check
            timeframe: Time range for trends (default: "today 3-m")
            
        Returns:
            Trending score between 0 and 100, or 0 if unavailable
        """
        # Check cache first
        cache_key = f"{keyword}:{timeframe}"
        if cache_key in self._trend_cache:
            cached_data = self._trend_cache[cache_key]
            if datetime.now() - cached_data["timestamp"] < self._cache_duration:
                return cached_data["score"]
        
        try:
            self._throttle()
            
            # Build payload
            self.pytrends.build_payload(
                kw_list=[keyword],
                geo=self.geo,
                timeframe=timeframe
            )
            
            # Get interest over time
            interest_data = self.pytrends.interest_over_time()
            
            if interest_data.empty or keyword not in interest_data.columns:
                logger.warning(f"No trend data available for '{keyword}'")
                return 0.0
            
            # Calculate average interest (0-100 scale from Google Trends)
            avg_interest = interest_data[keyword].mean()
            
            # Get recent trend (last 7 days if available)
            recent_data = interest_data.tail(7)
            if not recent_data.empty:
                recent_avg = recent_data[keyword].mean()
                # Weight recent trend more heavily (70% recent, 30% overall)
                trend_score = (recent_avg * 0.7) + (avg_interest * 0.3)
            else:
                trend_score = avg_interest
            
            # Normalize to 0-1 range (Google Trends already gives 0-100)
            normalized_score = min(100.0, max(0.0, trend_score)) / 100.0
            
            # Cache the result
            self._trend_cache[cache_key] = {
                "score": normalized_score,
                "timestamp": datetime.now()
            }
            
            logger.debug(f"Trend score for '{keyword}': {normalized_score:.2f}")
            return normalized_score
            
        except Exception as e:
            logger.warning(f"Error fetching Google Trends for '{keyword}': {e}")
            return 0.0
    
    def get_related_queries(self, keyword: str, timeframe: str = "today 3-m") -> List[str]:
        """
        Get related trending queries for a keyword.
        
        Args:
            keyword: Search term to check
            timeframe: Time range for trends
            
        Returns:
            List of related trending query terms
        """
        try:
            self._throttle()
            
            self.pytrends.build_payload(
                kw_list=[keyword],
                geo=self.geo,
                timeframe=timeframe
            )
            
            # Get related queries
            related_queries = self.pytrends.related_queries()
            
            if keyword in related_queries and related_queries[keyword]["top"] is not None:
                top_queries = related_queries[keyword]["top"]
                return top_queries["query"].head(10).tolist()
            
            return []
            
        except Exception as e:
            logger.warning(f"Error fetching related queries for '{keyword}': {e}")
            return []
    
    def is_trending(
        self,
        keyword: str,
        min_score: float = 0.3,
        timeframe: str = "today 3-m"
    ) -> bool:
        """
        Check if a keyword is currently trending.
        
        Args:
            keyword: Search term to check
            min_score: Minimum normalized score (0-1) to be considered trending
            timeframe: Time range for trends
            
        Returns:
            True if keyword is trending above threshold
        """
        score = self.get_trending_score(keyword, timeframe)
        return score >= min_score
    
    def get_trending_topics(self, category: Optional[str] = None) -> List[str]:
        """
        Get currently trending topics (requires category or returns general trends).
        
        Note: pytrends doesn't have a direct "trending now" endpoint, so this
        uses daily trending searches or category-specific searches.
        
        Args:
            category: Optional category filter (e.g., "entertainment", "sports")
            
        Returns:
            List of trending topic keywords
        """
        try:
            self._throttle()
            
            # Use daily trending searches
            # Note: This is a simplified approach - real implementation might
            # need to use Google Trends' "trending now" feature or RSS feeds
            if category:
                # Search for category-specific trending terms
                self.pytrends.build_payload(
                    kw_list=[category],
                    geo=self.geo,
                    timeframe="today 1-m"
                )
                related = self.pytrends.related_queries()
                if category in related and related[category]["rising"] is not None:
                    rising = related[category]["rising"]
                    return rising["query"].head(10).tolist()
            
            return []
            
        except Exception as e:
            logger.warning(f"Error fetching trending topics: {e}")
            return []

