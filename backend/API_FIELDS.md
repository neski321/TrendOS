# YouTube API Fields & Mapping

## Overview

This document lists all fields available from the YouTube Data API v3 and how they're mapped to our `VideoCandidate` object and database schema.

**Note**: `has_channel_title` is NOT a field from the API - it's a code variable that checks if the database column exists.

---

## YouTube API Response Structure

The YouTube API returns video data in this structure:

```json
{
  "items": [
    {
      "id": "video_id_string",
      "snippet": { ... },
      "statistics": { ... },
      "contentDetails": { ... },
      "status": { ... },        // Not currently requested
      "topicDetails": { ... },  // Not currently requested
      "recordingDetails": { ... } // Not currently requested
    }
  ]
}
```

---

## API Parts Requested

Currently, we request these parts from the API:

```python
videos_response = self.youtube.videos().list(
    part='statistics,contentDetails,snippet',  # ← These parts
    id=','.join(video_ids)
).execute()
```

### Available Parts (Not All Requested)

- ✅ `snippet` - Basic video information (title, description, thumbnails, etc.)
- ✅ `statistics` - View counts, likes, comments
- ✅ `contentDetails` - Duration, definition, caption, etc.
- ❌ `status` - Privacy status, upload status (not requested)
- ❌ `topicDetails` - Topic IDs, relevant topic IDs (not requested)
- ❌ `recordingDetails` - Location, recording date (not requested)
- ❌ `localizations` - Localized metadata (not requested)
- ❌ `player` - Embed HTML (not requested)
- ❌ `liveStreamingDetails` - Live stream info (not requested)

---

## Fields from YouTube API

### 1. `snippet` Part (Basic Video Info)

| API Field | Type | Description | Used? | Mapped To |
|-----------|------|-------------|-------|-----------|
| `id` | string | Video ID | ✅ | `video_id` |
| `snippet.title` | string | Video title | ✅ | `title` |
| `snippet.description` | string | Video description | ✅ | `description` |
| `snippet.channelId` | string | Channel ID (UC...) | ❌ | Not stored (we use channelTitle) |
| `snippet.channelTitle` | string | Channel name | ✅ | `channel_title` |
| `snippet.publishedAt` | datetime | Publication timestamp | ✅ | `published_at` |
| `snippet.thumbnails.default.url` | string | Default thumbnail | ❌ | Not used |
| `snippet.thumbnails.medium.url` | string | Medium thumbnail | ❌ | Not used |
| `snippet.thumbnails.high.url` | string | High-res thumbnail | ✅ | `thumbnail_url` |
| `snippet.thumbnails.standard.url` | string | Standard thumbnail | ❌ | Not used |
| `snippet.thumbnails.maxres.url` | string | Max-res thumbnail | ❌ | Not used |
| `snippet.tags` | array | Video tags | ❌ | Not used |
| `snippet.categoryId` | string | YouTube category ID | ❌ | Not used |
| `snippet.defaultLanguage` | string | Default language | ❌ | Not used |
| `snippet.defaultAudioLanguage` | string | Default audio language | ❌ | Not used |
| `snippet.localized` | object | Localized title/description | ❌ | Not used |
| `snippet.liveBroadcastContent` | string | "none", "upcoming", "live" | ❌ | Not used |

### 2. `statistics` Part (Engagement Metrics)

| API Field | Type | Description | Used? | Mapped To |
|-----------|------|-------------|-------|-----------|
| `statistics.viewCount` | string | Total views | ✅ | `views` (converted to int) |
| `statistics.likeCount` | string | Total likes | ✅ | `likes` (converted to int) |
| `statistics.dislikeCount` | string | Total dislikes | ❌ | Not used (deprecated by YouTube) |
| `statistics.favoriteCount` | string | Times favorited | ❌ | Not used |
| `statistics.commentCount` | string | Total comments | ✅ | `comments` (converted to int) |

### 3. `contentDetails` Part (Video Details)

| API Field | Type | Description | Used? | Mapped To |
|-----------|------|-------------|-------|-----------|
| `contentDetails.duration` | string | ISO 8601 duration (PT1H2M10S) | ✅ | `duration_seconds` (parsed) |
| `contentDetails.dimension` | string | "2d" or "3d" | ❌ | Not used |
| `contentDetails.definition` | string | "hd" or "sd" | ❌ | Not used |
| `contentDetails.caption` | string | "true" or "false" | ❌ | Not used |
| `contentDetails.licensedContent` | boolean | Licensed content flag | ❌ | Not used |
| `contentDetails.contentRating` | object | Content ratings | ❌ | Not used |
| `contentDetails.projection` | string | "rectangular" or "360" | ❌ | Not used |

---

## Current Mapping (API → VideoCandidate)

```python
# From YouTube API response
video_item = {
    'id': 'dQw4w9WgXcQ',
    'snippet': {
        'title': 'Video Title',
        'channelTitle': 'Channel Name',
        'publishedAt': '2024-01-01T12:00:00Z',
        'description': 'Video description...',
        'thumbnails': {
            'high': {'url': 'https://...'}
        }
    },
    'statistics': {
        'viewCount': '1000000',
        'likeCount': '50000',
        'commentCount': '5000'
    },
    'contentDetails': {
        'duration': 'PT10M30S'  # 10 minutes 30 seconds
    }
}

# Mapped to VideoCandidate
VideoCandidate(
    video_id=video_item['id'],                                    # 'dQw4w9WgXcQ'
    title=snippet.get('title', ''),                               # 'Video Title'
    channel_title=snippet.get('channelTitle', ''),                # 'Channel Name'
    published_at=parse_iso_datetime(snippet['publishedAt']),      # datetime object
    views=int(statistics.get('viewCount', 0)),                    # 1000000
    likes=int(statistics.get('likeCount', 0)),                   # 50000
    comments=int(statistics.get('commentCount', 0)),             # 5000
    duration_seconds=_parse_duration(content_details.get('duration', 'PT0S')),  # 630
    url=f"https://www.youtube.com/watch?v={video_id}",           # Generated URL
    category=category,                                            # 'hip_hop' (from search)
    entity_matched=entity,                                        # 'Drake' (from search)
    description=snippet.get('description', ''),                 # 'Video description...'
    thumbnail_url=snippet.get('thumbnails', {}).get('high', {}).get('url', '')  # Thumbnail URL
)
```

---

## Database Schema Mapping

| VideoCandidate Field | Database Column | Type | Notes |
|---------------------|-----------------|------|-------|
| `video_id` | `video_id` | TEXT UNIQUE | Primary identifier |
| `title` | `title` | TEXT | Video title |
| `channel_title` | `channel_title` | TEXT | Channel name (optional column) |
| `channel_title` | `channel_id` | TEXT | Also stored here (temporary) |
| `published_at` | `published_at` | TIMESTAMP WITH TIME ZONE | Publication date |
| `views` | `views` | INTEGER | View count |
| `likes` | `likes` | INTEGER | Like count |
| `comments` | `comments` | INTEGER | Comment count |
| `duration_seconds` | `duration_seconds` | INTEGER | Duration in seconds |
| `url` | `url` | TEXT | YouTube URL |
| `description` | `description` | TEXT | Video description |
| `thumbnail_url` | `thumbnail_url` | TEXT | Thumbnail image URL |
| `category` | `category` | TEXT | 'hip_hop', 'nba', 'celebrity' |
| `entity_matched` | `entity` | TEXT | Entity that matched |
| N/A | `run_date` | DATE | Date of scan (added by app) |
| N/A | `score` | REAL | Calculated score (added by app) |
| N/A | `created_at` | TIMESTAMP | Record creation time |
| N/A | `updated_at` | TIMESTAMP | Last update time |

---

## Fields Available But Not Used

These fields are available from the YouTube API but are **not currently stored or used**:

### From `snippet`:
- `channelId` - Channel ID (we only store channel name)
- `tags` - Video tags array
- `categoryId` - YouTube category ID
- `defaultLanguage` - Language code
- `defaultAudioLanguage` - Audio language code
- `liveBroadcastContent` - Whether it's a live stream
- `thumbnails.standard` - Standard thumbnail
- `thumbnails.maxres` - Maximum resolution thumbnail

### From `statistics`:
- `favoriteCount` - Times favorited
- `dislikeCount` - Dislikes (deprecated by YouTube)

### From `contentDetails`:
- `dimension` - 2D or 3D
- `definition` - HD or SD
- `caption` - Has captions
- `licensedContent` - Licensed content flag
- `contentRating` - Age/content ratings
- `projection` - 360° video flag

### From Other Parts (Not Requested):
- `status.privacyStatus` - Public, private, unlisted
- `status.uploadStatus` - Upload status
- `status.license` - License type
- `status.embeddable` - Can be embedded
- `status.publicStatsViewable` - Stats are public
- `status.madeForKids` - Made for kids flag
- `topicDetails.topicIds` - Topic categories
- `recordingDetails.location` - Recording location
- `recordingDetails.locationDescription` - Location description
- `recordingDetails.recordingDate` - Recording date
- `liveStreamingDetails.actualStartTime` - Live stream start
- `liveStreamingDetails.actualEndTime` - Live stream end
- `liveStreamingDetails.scheduledStartTime` - Scheduled start
- `liveStreamingDetails.concurrentViewers` - Current viewers
- `player.embedHtml` - Embed HTML code

---

## Code Variables vs API Fields

**Important**: Some variable names in the code are NOT API fields:

| Variable Name | What It Is | Notes |
|--------------|------------|-------|
| `has_channel_title` | Code variable | Checks if database column exists |
| `has_updated_at` | Code variable | Checks if database column exists |
| `has_channel_title_retry` | Code variable | Used in retry logic |
| `all_candidates` | Code variable | List of candidates in memory |
| `unique_candidates` | Code variable | After deduplication |
| `filtered` | Code variable | After filtering |
| `scored` | Code variable | After scoring |
| `all_scored` | Code variable | Final list before saving |

---

## Summary

### Currently Used from API:
1. ✅ `id` → `video_id`
2. ✅ `snippet.title` → `title`
3. ✅ `snippet.channelTitle` → `channel_title`
4. ✅ `snippet.publishedAt` → `published_at`
5. ✅ `snippet.description` → `description`
6. ✅ `snippet.thumbnails.high.url` → `thumbnail_url`
7. ✅ `statistics.viewCount` → `views`
8. ✅ `statistics.likeCount` → `likes`
9. ✅ `statistics.commentCount` → `comments`
10. ✅ `contentDetails.duration` → `duration_seconds`

### Added by Application:
- `category` - From search context
- `entity_matched` - From search context
- `url` - Generated from video_id
- `score` - Calculated by scoring algorithm
- `run_date` - Date of scan

### Not Currently Used:
- Channel ID (only channel name)
- Tags
- Category ID
- Language info
- Live stream info
- Content ratings
- Caption availability
- HD/SD flag
- And many more...

---

## How to Add More Fields

To add a new field from the API:

1. **Add to VideoCandidate dataclass** (`backend/clients/youtube_client.py`):
   ```python
   @dataclass
   class VideoCandidate:
       # ... existing fields ...
       new_field: str = ""  # Add new field
   ```

2. **Extract from API response** (`youtube_client.py`):
   ```python
   new_field=snippet.get('newField', '')
   ```

3. **Add to database schema** (create migration):
   ```sql
   ALTER TABLE trending_videos ADD COLUMN new_field TEXT;
   ```

4. **Update storage.save_run()** to include in INSERT statement

5. **Update validators** if needed







