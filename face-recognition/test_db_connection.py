#!/usr/bin/env python3
"""
Test database connection and basic operations
"""

import psycopg2
from datetime import datetime
import sys

# Database config
DB_CONFIG = {
    'dbname': 'FYP_Intellisight',
    'user': 'postgres',
    'password': 'ozair',
    'host': 'localhost',
    'port': 5000
}

def test_connection():
    """Test basic database connection"""
    print("="*60)
    print("DATABASE CONNECTION TEST")
    print("="*60)
    
    try:
        print("\n1. Testing connection...")
        conn = psycopg2.connect(**DB_CONFIG)
        print("   SUCCESS: Connected to database")
        
        cur = conn.cursor()
        
        # Test query
        print("\n2. Testing query execution...")
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        print(f"   SUCCESS: PostgreSQL version: {version[:50]}...")
        
        # Check tables exist
        print("\n3. Checking required tables...")
        tables = ['ActivePresence', 'AttendanceLog', 'Logs', 'Students', 'Teacher']
        for table in tables:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            print(f"   - {table}: {count} records")
        
        # Check for trained faces
        print("\n4. Checking trained faces...")
        cur.execute('SELECT COUNT(*) FROM "Students" WHERE "Face_Embeddings" IS NOT NULL')
        student_count = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM "Teacher" WHERE "Face_Embeddings" IS NOT NULL')
        teacher_count = cur.fetchone()[0]
        print(f"   - Students with embeddings: {student_count}")
        print(f"   - Teachers with embeddings: {teacher_count}")
        
        if student_count == 0 and teacher_count == 0:
            print("\n   WARNING: No trained faces found!")
            print("   Run: python train_from_database.py")
        
        # Test insert/delete
        print("\n5. Testing INSERT and DELETE operations...")
        cur.execute("""
            INSERT INTO "ActivePresence" 
            ("Zone_id", "Student_ID", "PersonType", "EntryTime")
            VALUES (1, 999, 'Student', %s)
            RETURNING "Presence_ID"
        """, (datetime.now(),))
        
        test_id = cur.fetchone()[0]
        print(f"   SUCCESS: Inserted test record (ID: {test_id})")
        
        cur.execute('DELETE FROM "ActivePresence" WHERE "Presence_ID" = %s', (test_id,))
        print(f"   SUCCESS: Deleted test record")
        
        conn.commit()
        
        print("\n6. Checking ActivePresence state...")
        cur.execute('SELECT COUNT(*) FROM "ActivePresence"')
        active_count = cur.fetchone()[0]
        
        if active_count > 0:
            cur.execute("""
                SELECT "PersonType", 
                       COALESCE("Student_ID", "Teacher_ID") as person_id,
                       "EntryTime"
                FROM "ActivePresence"
                ORDER BY "EntryTime" DESC
            """)
            
            print(f"   Found {active_count} person(s) currently marked as 'in zone':")
            for row in cur.fetchall():
                print(f"   - {row[0]} {row[1]} (Entry: {row[2]})")
            
            print("\n   TIP: If testing, clear this table first:")
            print("   python clear_active_presence.py")
        else:
            print("   No one currently in zone (clean state)")
        
        cur.close()
        conn.close()
        
        print("\n" + "="*60)
        print("ALL TESTS PASSED!")
        print("="*60)
        print("\nDatabase is ready for face recognition system.")
        return True
        
    except psycopg2.Error as e:
        print(f"\n   FAILED: {e}")
        print("\n" + "="*60)
        print("DATABASE CONNECTION FAILED")
        print("="*60)
        print("\nPossible issues:")
        print("1. PostgreSQL is not running")
        print("2. Wrong database credentials")
        print("3. Database 'FYP_Intellisight' doesn't exist")
        print("4. Firewall blocking port 5000")
        return False
    except Exception as e:
        print(f"\n   ERROR: {e}")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
