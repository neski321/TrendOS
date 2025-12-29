# How the Scoring Algorithm is Applied

## Overview

The scoring algorithm calculates a "Clip Potential" score (0-100) for each video candidate to determine which videos are most likely to be good clips for content creation.

## Flow: When Scoring is Applied

```
1. Collect candidates from YouTube API
   ↓
2. Deduplicate by video_id
   ↓
3. Filter candidates (duration, keywords, entity matching)
   ↓
4. Get cross-platform signals (TikTok, etc.) - currently stub
   ↓
5. Get Google Trends signals (trending validation)
   ↓
6. **SCORE CANDIDATES** ← Scoring happens here
   ↓
7. Sort by score (descending)
   ↓
8. Limit per category (max_candidates_per_category)
   ↓
9. Save to database with score
   ↓
10. Rank by category for Discord (top N per category)
```

## Scoring Function: `calculate_score()`

Located in: `backend/core/scorer.py:14-81`

### Input Parameters

- `candidate`: VideoCandidate object (contains views, likes, comments, published_at, etc.)
- `weights`: Dictionary of scoring weights from config
- `entity_priority_map`: Map of entity names to priority multipliers
- `time_window_hours`: Time window for recency calculation (e.g., 72 hours)
- `cross_platform_signal`: Cross-platform trending signal (0-1) - currently 0.0
- `google_trends_signal`: Google Trends validation signal (0-1)

### Score Components

The final score is calculated as a weighted sum of 5 components:

#### 1. **Recency Score** (Weight: `recency_weight`, default: 0.3 = 30%)

```python
age_hours = age_in_hours(candidate.published_at)
recency = max(0.0, 1.0 - (age_hours / time_window_hours))
```

- **Formula**: `1.0 - (age_hours / time_window_hours)`
- **Range**: 0.0 (old) to 1.0 (brand new)
- **Example**: 
  - Video published 1 hour ago, 72-hour window: `1.0 - (1/72) = 0.986` (98.6%)
  - Video published 36 hours ago: `1.0 - (36/72) = 0.5` (50%)
  - Video published 72+ hours ago: `0.0` (0%)

**Purpose**: Favors newer videos that are more likely to be trending now.

---

#### 2. **Engagement Score** (Weight: `engagement_weight`, default: 0.3 = 30%)

```python
like_ratio = candidate.likes / candidate.views  # e.g., 0.05 = 5%
engagement = min(1.0, like_ratio / 0.05)  # Normalize around 5% like rate
view_score = min(1.0, log10(views) / 7.0)  # Log scale, cap at ~10M views
engagement = (engagement * 0.6) + (view_score * 0.4)
```

- **Like Ratio Component** (60%):
  - Normalizes around 5% like rate (typical for YouTube)
  - 5% like rate = 1.0, 10% = 1.0 (capped), 2.5% = 0.5
- **View Score Component** (40%):
  - Logarithmic scale based on total views
  - ~10M views = 1.0, ~1M views = 0.86, ~100k views = 0.71

**Purpose**: Favors videos with high engagement (likes relative to views) and high view counts.

---

#### 3. **Velocity Score** (Weight: `velocity_weight`, default: 0.2 = 20%)

```python
views_per_hour = candidate.views / age_hours
velocity = min(1.0, log10(views_per_hour + 1) / 5.0)
```

- **Formula**: Logarithmic scale of views per hour
- **Examples**:
  - 100 views/hr: `log10(101) / 5.0 = 0.40` (40%)
  - 1,000 views/hr: `log10(1001) / 5.0 = 0.60` (60%)
  - 10,000 views/hr: `log10(10001) / 5.0 = 0.80` (80%)
  - 100,000 views/hr: `log10(100001) / 5.0 = 1.0` (100%, capped)

**Purpose**: Favors videos that are gaining views quickly (viral potential).

---

#### 4. **Cross-Platform Signal** (Weight: `cross_platform_weight`, default: 0.1 = 10%)

```python
trend_signal = (cross_platform_signal + google_trends_signal) / 2.0
# Or use whichever is available
```

- Currently: **Always 0.0** (stub for future TikTok integration)
- Future: Will check if video is trending on TikTok/other platforms
- Range: 0.0 to 1.0

**Purpose**: Boost videos that are trending across multiple platforms.

---

#### 5. **Entity Priority** (Weight: `entity_priority_weight`, default: 0.1 = 10%)

```python
priority = entity_priority_map.get(candidate.entity_matched, 1.0)
priority_normalized = min(1.0, priority / 2.0)
```

- **Source**: `entities.yaml` → `priority_weights` per category
- **Example**: 
  - Drake: `priority_weight: 1.5` → normalized: `1.5 / 2.0 = 0.75`
  - Default entity: `1.0` → normalized: `1.0 / 2.0 = 0.5`
- **Range**: 0.0 to 1.0 (assuming max priority is 2.0)

**Purpose**: Boost videos from high-priority entities (e.g., top artists, players).

---

### Final Score Calculation

```python
score = (
    weights["recency_weight"] * recency +           # 30% × recency
    weights["engagement_weight"] * engagement +     # 30% × engagement
    weights["velocity_weight"] * velocity +         # 20% × velocity
    weights["cross_platform_weight"] * trend_signal +  # 10% × trend
    weights["entity_priority_weight"] * priority_normalized  # 10% × priority
)

# Scale to 0-100
final_score = max(0.0, min(100.0, score * 100))
```

**Example Calculation**:

Given a video with:
- Published 12 hours ago (72-hour window)
- 50,000 views, 2,500 likes (5% like rate)
- 4,167 views/hour
- Entity: Drake (priority 1.5)
- No cross-platform signal

```
recency = 1.0 - (12/72) = 0.833
engagement = (1.0 * 0.6) + (log10(50000)/7.0 * 0.4) = 0.6 + 0.286 = 0.886
velocity = log10(4167 + 1) / 5.0 = 0.72
trend_signal = 0.0
priority = 1.5 / 2.0 = 0.75

score = (0.3 × 0.833) + (0.3 × 0.886) + (0.2 × 0.72) + (0.1 × 0.0) + (0.1 × 0.75)
      = 0.250 + 0.266 + 0.144 + 0.0 + 0.075
      = 0.735

final_score = 0.735 × 100 = 73.5
```

---

## Where Scoring is Applied

### 1. **In `main.py`** (Line 226)

```python
scored = score_candidates(
    filtered,                    # Filtered candidates
    entities_config,             # Entity config (for priority weights)
    settings_config,             # Settings (for scoring weights)
    cross_platform_signals,      # TikTok signals (currently empty)
    google_trends_signals        # Google Trends signals
)
```

This:
- Loops through each filtered candidate
- Calls `calculate_score()` for each
- Wraps each candidate in a `ScoredCandidate` object
- Sorts all candidates by score (descending)
- Returns sorted list

### 2. **After Scoring** (Line 235-247)

```python
# Limit candidates per category
by_category = {}
for scored_candidate in scored:  # Already sorted by score
    category = scored_candidate.candidate.category
    if category not in by_category:
        by_category[category] = []
    if len(by_category[category]) < settings_config.limits.max_candidates_per_category:
        by_category[category].append(scored_candidate)
```

Takes top candidates per category (already sorted by score).

### 3. **Saved to Database** (Line 251)

```python
saved_count, error_count, invalid_count, saved_candidates_list = storage.save_run(run_date, valid_candidates)
```

The `score` field is saved to the `trending_videos.score` column in the database.

### 4. **Used for Discord Ranking** (Line 265)

```python
top_by_category = rank_by_category(saved_candidates_list, settings_config)
```

Ranks by score and takes top N per category for Discord notifications.

---

## Score Configuration

### Default Weights (from `settings.yaml`)

```yaml
scoring:
  recency_weight: 0.3          # 30% - How new the video is
  engagement_weight: 0.3        # 30% - Likes/views ratio + view count
  velocity_weight: 0.2          # 20% - Views per hour (growth rate)
  cross_platform_weight: 0.1    # 10% - Trending on other platforms
  entity_priority_weight: 0.1   # 10% - Entity priority boost
```

**Total**: 1.0 (100%)

### Entity Priority Weights (from `entities.yaml`)

```yaml
categories:
  hip_hop:
    priority_weights:
      "Drake": 1.5      # 50% boost (1.5 / 2.0 = 0.75 normalized)
      "Kendrick Lamar": 1.3
      # Default: 1.0 (0.5 normalized)
```

---

## Score Range

- **Minimum**: 0.0 (very old, low engagement, no velocity)
- **Maximum**: 100.0 (brand new, high engagement, high velocity, trending, priority entity)
- **Typical Range**: 20-80 for most candidates

---

## How to Adjust Scoring

### To Favor Newer Videos:
```yaml
scoring:
  recency_weight: 0.5  # Increase from 0.3
  engagement_weight: 0.2  # Decrease from 0.3
```

### To Favor High Engagement:
```yaml
scoring:
  engagement_weight: 0.5  # Increase from 0.3
  recency_weight: 0.2  # Decrease from 0.3
```

### To Favor Fast-Growing Videos:
```yaml
scoring:
  velocity_weight: 0.4  # Increase from 0.2
  recency_weight: 0.2  # Decrease from 0.3
```

**Note**: Weights should sum to 1.0 for best results (though the code will still work if they don't).

---

## Summary

1. **Scoring happens after filtering** - Only valid candidates are scored
2. **Each candidate gets a score 0-100** - Based on 5 weighted components
3. **Candidates are sorted by score** - Highest scores first
4. **Top candidates per category are saved** - Limited by `max_candidates_per_category`
5. **Score is stored in database** - Used for ranking and display
6. **Top N per category for Discord** - Based on score ranking

The score represents the "Clip Potential" - how likely a video is to be a good clip for content creation based on recency, engagement, growth rate, cross-platform trends, and entity priority.






