"""Discord webhook notifier for sending daily summaries."""
import logging
import httpx
from typing import List, Dict
from datetime import date

from core.scorer import ScoredCandidate
from utils.time_utils import format_duration_seconds

logger = logging.getLogger(__name__)


class DiscordNotifier:
    """Discord webhook notifier."""
    
    def __init__(self, webhook_url: str):
        """
        Initialize Discord notifier.
        
        Args:
            webhook_url: Discord webhook URL
        """
        self.webhook_url = webhook_url
    
    def build_summary_message(
        self,
        top_hiphop: List[ScoredCandidate],
        top_nba: List[ScoredCandidate],
        top_celebrity: List[ScoredCandidate],
        run_date: date
    ) -> str:
        """
        Build a formatted Discord message summarizing top candidates.
        
        Args:
            top_hiphop: Top hip hop candidates
            top_nba: Top NBA candidates
            top_celebrity: Top celebrity candidates
            run_date: Date of the run
            
        Returns:
            Formatted message string
        """
        lines = [
            f"**🚀 Daily Clip Targets – {run_date.isoformat()}**",
            ""
        ]
        
        # Hip Hop section
        if top_hiphop:
            lines.append("**Hip Hop 🔥**")
            for i, scored in enumerate(top_hiphop, 1):
                candidate = scored.candidate
                views_k = candidate.views / 1000 if candidate.views < 1000000 else candidate.views / 1000000
                views_suffix = "k" if candidate.views < 1000000 else "M"
                lines.append(
                    f"{i}) **{candidate.entity_matched}** – {candidate.channel_title} "
                    f"({views_k:.1f}{views_suffix} views, Score: {scored.score:.0f}) {candidate.url}"
                )
            lines.append("")
        
        # NBA section
        if top_nba:
            lines.append("**NBA 🏀**")
            for i, scored in enumerate(top_nba, 1):
                candidate = scored.candidate
                views_k = candidate.views / 1000 if candidate.views < 1000000 else candidate.views / 1000000
                views_suffix = "k" if candidate.views < 1000000 else "M"
                lines.append(
                    f"{i}) **{candidate.entity_matched}** – {candidate.channel_title} "
                    f"({views_k:.1f}{views_suffix} views, Score: {scored.score:.0f}) {candidate.url}"
                )
            lines.append("")
        
        # Celebrity section
        if top_celebrity:
            lines.append("**Celebrities 🌍**")
            for i, scored in enumerate(top_celebrity, 1):
                candidate = scored.candidate
                views_k = candidate.views / 1000 if candidate.views < 1000000 else candidate.views / 1000000
                views_suffix = "k" if candidate.views < 1000000 else "M"
                lines.append(
                    f"{i}) **{candidate.entity_matched}** – {candidate.channel_title} "
                    f"({views_k:.1f}{views_suffix} views, Score: {scored.score:.0f}) {candidate.url}"
                )
            lines.append("")
        
        # Summary stats
        total_candidates = len(top_hiphop) + len(top_nba) + len(top_celebrity)
        if total_candidates == 0:
            lines.append("_No high-scoring candidates found today._")
        else:
            lines.append(f"_Found {total_candidates} high-potential clip targets._")
        
        return "\n".join(lines)
    
    def send_summary(self, content: str) -> bool:
        """
        Send summary message to Discord webhook.
        
        Args:
            content: Message content to send
            
        Returns:
            True if successful, False otherwise
        """
        try:
            response = httpx.post(
                self.webhook_url,
                json={"content": content},
                timeout=10.0
            )
            response.raise_for_status()
            logger.info("Discord notification sent successfully")
            return True
        except httpx.HTTPError as e:
            logger.error(f"Failed to send Discord notification: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending Discord notification: {e}")
            return False

