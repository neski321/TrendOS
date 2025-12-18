#!/usr/bin/env python3
"""
Schema verification script to check if all required database columns exist.

Run this to verify your database schema is complete:
    python3 verify_schema.py
"""
import os
import sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

database_url = os.getenv("DATABASE_URL")

if not database_url:
    print("❌ ERROR: DATABASE_URL environment variable not set")
    sys.exit(1)

# Required columns (from Migration 1)
REQUIRED_COLUMNS = {
    'id', 'run_date', 'category', 'entity', 'title', 'channel_id',
    'published_at', 'views', 'likes', 'comments', 'duration_seconds',
    'score', 'url', 'video_id', 'description', 'thumbnail_url'
}

# Optional columns (added by later migrations)
OPTIONAL_COLUMNS = {
    'created_at': 'Migration 1',
    'updated_at': 'Migration 2',
    'channel_title': 'Migration 4'
}

# Required constraints
REQUIRED_CONSTRAINTS = {
    'video_id': 'UNIQUE'  # Required for ON CONFLICT
}

def verify_schema():
    """Verify database schema is complete."""
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    issues = []
    warnings = []
    
    try:
        # Check if table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'trending_videos'
            )
        """)
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            print("❌ ERROR: trending_videos table does not exist!")
            print("   Run migrations: python3 migrate.py")
            return False
        
        # Get all columns
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'trending_videos'
            ORDER BY column_name
        """)
        existing_columns = {row[0]: {'type': row[1], 'nullable': row[2]} for row in cursor.fetchall()}
        
        # Check required columns
        print("\n📋 Checking Required Columns:")
        missing_required = []
        for col in REQUIRED_COLUMNS:
            if col in existing_columns:
                print(f"  ✅ {col} ({existing_columns[col]['type']})")
            else:
                print(f"  ❌ {col} - MISSING!")
                missing_required.append(col)
        
        if missing_required:
            issues.append(f"Missing required columns: {', '.join(missing_required)}")
        
        # Check optional columns
        print("\n📋 Checking Optional Columns:")
        for col, migration in OPTIONAL_COLUMNS.items():
            if col in existing_columns:
                print(f"  ✅ {col} ({existing_columns[col]['type']}) - Added in {migration}")
            else:
                print(f"  ⚠️  {col} - Missing (added in {migration})")
                warnings.append(f"Optional column '{col}' missing (from {migration})")
        
        # Check UNIQUE constraint on video_id
        print("\n📋 Checking Constraints:")
        cursor.execute("""
            SELECT conname, contype
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.conrelid = 'trending_videos'::regclass
            AND c.contype = 'u'
            AND a.attname = 'video_id'
            LIMIT 1
        """)
        unique_constraint = cursor.fetchone()
        
        if unique_constraint:
            print(f"  ✅ UNIQUE constraint on video_id: {unique_constraint[0]}")
        else:
            print("  ❌ UNIQUE constraint on video_id - MISSING!")
            issues.append("Missing UNIQUE constraint on video_id (required for ON CONFLICT)")
        
        # Check indexes
        print("\n📋 Checking Indexes:")
        cursor.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'trending_videos'
            ORDER BY indexname
        """)
        indexes = [row[0] for row in cursor.fetchall()]
        expected_indexes = [
            'idx_run_date',
            'idx_category',
            'idx_score',
            'idx_video_id',
            'idx_published_at'
        ]
        
        for idx in expected_indexes:
            if idx in indexes:
                print(f"  ✅ {idx}")
            else:
                print(f"  ⚠️  {idx} - Missing")
                warnings.append(f"Index '{idx}' missing")
        
        # Check migration status
        print("\n📋 Checking Migration Status:")
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'schema_version'
            )
        """)
        schema_version_exists = cursor.fetchone()[0]
        
        if schema_version_exists:
            cursor.execute("""
                SELECT version, description, applied_at
                FROM schema_version
                ORDER BY version
            """)
            migrations = cursor.fetchall()
            
            if migrations:
                print(f"  ✅ Found {len(migrations)} applied migrations:")
                for row in migrations:
                    version = row[0]
                    description = row[1] if len(row) > 1 else f"Migration {version}"
                    applied_at = row[2] if len(row) > 2 else None
                    desc_short = description[:50] if description else f"Migration {version}"
                    print(f"     - Migration {version}: {desc_short}...")
            else:
                print("  ⚠️  schema_version table exists but no migrations recorded")
                warnings.append("No migrations recorded in schema_version")
        else:
            print("  ⚠️  schema_version table does not exist")
            warnings.append("schema_version table missing")
        
        # Summary
        print("\n" + "="*60)
        if issues:
            print("❌ ISSUES FOUND:")
            for issue in issues:
                print(f"   - {issue}")
            print("\n⚠️  These issues will cause errors. Please run migrations:")
            print("   python3 migrate.py")
            return False
        elif warnings:
            print("⚠️  WARNINGS (non-critical):")
            for warning in warnings:
                print(f"   - {warning}")
            print("\n✅ All required columns and constraints exist!")
            print("   Optional columns missing but won't cause errors.")
            return True
        else:
            print("✅ SCHEMA VERIFICATION PASSED!")
            print("   All required columns, constraints, and indexes exist.")
            return True
            
    except Exception as e:
        print(f"\n❌ ERROR during verification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    success = verify_schema()
    sys.exit(0 if success else 1)

