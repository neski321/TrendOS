# Database Columns Verification

This document verifies that all columns used in the code are properly defined in the database schema.

## Required Columns (Always Present)

These columns are created in Migration 1 and are **always required**:

| Column | Type | Required? | Used In |
|--------|------|-----------|---------|
| `id` | SERIAL PRIMARY KEY | ✅ Always | Auto-increment |
| `run_date` | DATE NOT NULL | ✅ Always | INSERT, UPDATE |
| `category` | TEXT NOT NULL | ✅ Always | INSERT, UPDATE |
| `entity` | TEXT NOT NULL | ✅ Always | INSERT, UPDATE |
| `title` | TEXT NOT NULL | ✅ Always | INSERT, UPDATE |
| `channel_id` | TEXT NOT NULL | ✅ Always | INSERT, UPDATE |
| `published_at` | TIMESTAMP WITH TIME ZONE NOT NULL | ✅ Always | INSERT, UPDATE |
| `views` | INTEGER NOT NULL | ✅ Always | INSERT, UPDATE |
| `likes` | INTEGER NOT NULL | ✅ Always | INSERT, UPDATE |
| `comments` | INTEGER NOT NULL | ✅ Always | INSERT, UPDATE |
| `duration_seconds` | INTEGER NOT NULL | ✅ Always | INSERT, UPDATE |
| `score` | REAL NOT NULL | ✅ Always | INSERT, UPDATE |
| `url` | TEXT NOT NULL | ✅ Always | INSERT, UPDATE |
| `video_id` | TEXT NOT NULL UNIQUE | ✅ Always | INSERT, UPDATE, ON CONFLICT |
| `description` | TEXT | ✅ Always | INSERT, UPDATE |
| `thumbnail_url` | TEXT | ✅ Always | INSERT, UPDATE |

## Optional Columns (Added by Migrations)

These columns are added by later migrations and are **conditionally checked**:

| Column | Migration | Type | Checked? | Auto-Fix? |
|--------|-----------|------|----------|-----------|
| `created_at` | Migration 1 (initial) | TIMESTAMP WITH TIME ZONE | ❌ Not checked | ✅ Yes (in SCHEMA_COLUMNS) |
| `updated_at` | Migration 1 (initial) | TIMESTAMP WITH TIME ZONE | ✅ Yes (line 194-201) | ✅ Yes (in SCHEMA_COLUMNS) |
| `channel_title` | Migration 4 | TEXT | ✅ Yes (line 203-209) | ❌ No (should add) |

## Current Code Checks

### Columns Checked for Existence:

1. **`updated_at`** (line 194-201):
   ```python
   cursor.execute("""
       SELECT EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'trending_videos' AND column_name = 'updated_at'
       )
   """)
   has_updated_at = cursor.fetchone()[0]
   ```

2. **`channel_title`** (line 203-209):
   ```python
   cursor.execute("""
       SELECT EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'trending_videos' AND column_name = 'channel_title'
       )
   """)
   has_channel_title = cursor.fetchone()[0]
   ```

### Auto-Fix System (SCHEMA_COLUMNS):

Currently only covers:
```python
SCHEMA_COLUMNS = {
    'created_at': 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
    'updated_at': 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
    # channel_title is NOT here but should be!
}
```

## Issues Found

### ❌ Issue 1: `channel_title` Not in Auto-Fix

**Problem**: `channel_title` is checked for existence but NOT in `SCHEMA_COLUMNS`, so auto-fix won't add it if missing.

**Impact**: If `channel_title` column is missing and auto-fix is triggered, it won't be added automatically.

**Fix Needed**: Add `channel_title` to `SCHEMA_COLUMNS`.

### ✅ Issue 2: `created_at` Not Checked

**Problem**: `created_at` is in `SCHEMA_COLUMNS` for auto-fix, but it's not checked for existence before use.

**Impact**: Low - `created_at` is created in Migration 1, so it should always exist. But if it's missing, we won't know until an error occurs.

**Status**: Acceptable (created in initial migration).

### ✅ Issue 3: UNIQUE Constraint Checked

**Problem**: UNIQUE constraint on `video_id` is required for `ON CONFLICT` to work.

**Status**: ✅ Properly handled - Migration 2 ensures it exists, and auto-fix logic handles it.

## INSERT Statement Columns

### When `channel_title` EXISTS (line 256-260):
```sql
INSERT INTO trending_videos (
    run_date, category, entity, title, channel_id, channel_title,  -- 16 columns
    published_at, views, likes, comments, duration_seconds,
    score, url, video_id, description, thumbnail_url
) VALUES (...)
```

### When `channel_title` DOES NOT EXIST (line 284-288):
```sql
INSERT INTO trending_videos (
    run_date, category, entity, title, channel_id,  -- 15 columns
    published_at, views, likes, comments, duration_seconds,
    score, url, video_id, description, thumbnail_url
) VALUES (...)
```

**All columns in INSERT are covered by migrations!** ✅

## UPDATE Statement Columns

### Always Updated (line 217-223):
- `run_date = EXCLUDED.run_date`
- `score = EXCLUDED.score`
- `views = EXCLUDED.views`
- `likes = EXCLUDED.likes`
- `comments = EXCLUDED.comments`

### Conditionally Updated:
- `channel_title = EXCLUDED.channel_title` (if `has_channel_title` is True)
- `updated_at = CURRENT_TIMESTAMP` (if `has_updated_at` is True)

**All UPDATE columns are properly checked!** ✅

## Recommendations

### 1. Add `channel_title` to Auto-Fix

```python
SCHEMA_COLUMNS = {
    'created_at': 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
    'updated_at': 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
    'channel_title': 'TEXT',  # ← ADD THIS
}
```

### 2. Verify All Migrations Are Applied

The code assumes migrations have run. To verify:
```sql
SELECT version, description, applied_at 
FROM schema_version 
ORDER BY version;
```

Should show versions 1-7.

### 3. Add Verification on Startup

Consider adding a startup check that verifies all required columns exist:
```python
def verify_schema(self):
    """Verify all required columns exist."""
    required_columns = {
        'id', 'run_date', 'category', 'entity', 'title', 'channel_id',
        'published_at', 'views', 'likes', 'comments', 'duration_seconds',
        'score', 'url', 'video_id', 'description', 'thumbnail_url'
    }
    # Check and raise error if any missing
```

## Summary

### ✅ What's Properly Defined:
- All required columns in Migration 1
- `updated_at` checked and auto-fixable
- `channel_title` checked (but not auto-fixable)
- UNIQUE constraint on `video_id` handled
- All INSERT columns covered by migrations
- All UPDATE columns conditionally handled

### ⚠️ Potential Issues:
1. `channel_title` not in auto-fix (should add)
2. `created_at` not checked (low risk, created in Migration 1)

### ✅ Conclusion:
**Almost everything is properly defined!** The only gap is `channel_title` not being in the auto-fix system, but it's checked for existence and handled conditionally, so it won't cause "not defined" errors.

The code is defensive and handles missing optional columns gracefully.






