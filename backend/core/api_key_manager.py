"""API Key Manager for handling multiple YouTube API keys with quota-aware selection."""
import logging
from typing import List, Optional, Dict
from datetime import date

logger = logging.getLogger(__name__)


class APIKeyManager:
    """Manages multiple YouTube API keys with quota-aware selection."""
    
    def __init__(self, api_keys: List[str], quota_tracker=None):
        """
        Initialize API key manager.
        
        Args:
            api_keys: List of YouTube API keys
            quota_tracker: QuotaTracker instance for tracking quota per key
        """
        if not api_keys:
            raise ValueError("At least one API key is required")
        
        self.api_keys = api_keys
        self.quota_tracker = quota_tracker
        self.current_index = 0
        self.exhausted_keys = set()  # Track keys that have exhausted quota
        
        logger.info(f"Initialized API key manager with {len(api_keys)} keys")
    
    def get_available_key(self, required_units: int = 0) -> Optional[str]:
        """
        Get an available API key with sufficient quota.
        
        Args:
            required_units: Quota units needed for the operation
            
        Returns:
            API key string, or None if no keys are available
        """
        # Reset exhausted keys at start of new day
        today = date.today()
        if hasattr(self, '_last_reset_date') and self._last_reset_date != today:
            self.exhausted_keys.clear()
            logger.info("Reset exhausted keys for new day")
        self._last_reset_date = today
        
        # Try all keys starting from current index (round-robin)
        attempts = 0
        while attempts < len(self.api_keys):
            key = self.api_keys[self.current_index]
            
            # Skip if key is exhausted
            if key in self.exhausted_keys:
                self.current_index = (self.current_index + 1) % len(self.api_keys)
                attempts += 1
                continue
            
            # Check quota if tracker is available
            if self.quota_tracker and required_units > 0:
                is_available, usage = self.quota_tracker.check_quota_available(
                    required_units, api_key=key
                )
                if not is_available:
                    logger.warning(
                        f"API key {self._key_id(key)} has insufficient quota: "
                        f"{usage['remaining']} remaining, need {required_units}"
                    )
                    self.exhausted_keys.add(key)
                    self.current_index = (self.current_index + 1) % len(self.api_keys)
                    attempts += 1
                    continue
            
            # Key is available
            logger.debug(f"Selected API key {self._key_id(key)}")
            return key
        
        # No available keys
        logger.error("All API keys are exhausted or unavailable")
        return None
    
    def mark_key_exhausted(self, api_key: str):
        """Mark an API key as exhausted (quota limit reached)."""
        if api_key in self.api_keys:
            self.exhausted_keys.add(api_key)
            logger.warning(f"Marked API key {self._key_id(api_key)} as exhausted")
    
    def get_next_key(self) -> Optional[str]:
        """
        Get next API key in round-robin fashion (for operations that don't need quota check).
        
        Returns:
            API key string
        """
        if not self.api_keys:
            return None
        
        key = self.api_keys[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.api_keys)
        return key
    
    def _key_id(self, api_key: str) -> str:
        """Get a short identifier for an API key (for logging)."""
        if len(api_key) > 8:
            return f"{api_key[:4]}...{api_key[-4:]}"
        return api_key
    
    def get_key_status(self) -> Dict[str, Dict]:
        """
        Get status of all API keys.
        
        Returns:
            Dict mapping key IDs to their status
        """
        status = {}
        for key in self.api_keys:
            key_id = self._key_id(key)
            is_exhausted = key in self.exhausted_keys
            
            quota_info = {}
            if self.quota_tracker:
                usage = self.quota_tracker.get_quota_usage(api_key=key)
                quota_info = usage
            
            status[key_id] = {
                'exhausted': is_exhausted,
                'quota': quota_info
            }
        
        return status




