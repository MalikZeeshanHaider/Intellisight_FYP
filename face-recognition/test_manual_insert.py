#!/usr/bin/env python3
"""
Manual test: Simulate camera detection and test database insertion
"""

import psycopg2
from datetime import datetime
from config import DB_CONFIG

print("="*60)
print("MANUAL CAMERA DETECTION TEST")
print("="*60)

# Test 1: Database connection
print("\n1. Testing database connection...")
try:
    conn = psycopg2.connect(**DB_CONFIG)
    print("   ✅ Connected to database")
except Exception as e:
    print(f"   ❌ Connection failed: {e}")
    exit(1)

# Test 2: Check if Teacher exists
print("\n2. Checking for teacher...")
cur = conn.cursor()
cur.execute('SELECT "Teacher_ID", "Name" FROM "Teacher" LIMIT 1')
teacher = cur.fetchone()

if not teacher:
    print("   ❌ No teacher found in database")
    exit(1)

teacher_id, teacher_name = teacher
print(f"   ✅ Found teacher: {teacher_name} (ID: {teacher_id})")

# Test 3: Check if already in zone
print("\n3. Checking if teacher already in zone...")
cur.execute("""
    SELECT "Presence_ID" FROM "ActivePresence" 
    WHERE "Teacher_ID" = %s AND "Zone_id" = 1
""", (teacher_id,))

existing = cur.fetchone()
if existing:
    print(f"   ⚠️ Teacher already in zone (Presence_ID: {existing[0]})")
    print("   Clearing ActivePresence for fresh test...")
    cur.execute('DELETE FROM "ActivePresence" WHERE "Presence_ID" = %s', (existing[0],))
    conn.commit()
    print("   ✅ Cleared")
else:
    print("   ✅ Teacher not in zone (good for testing)")

# Test 4: Simulate Entry Detection - Insert into 3 tables
print("\n4. Simulating entry camera detection...")
entry_time = datetime.now()

try:
    # Insert into ActivePresence
    print("   - Inserting into ActivePresence...")
    cur.execute("""
        INSERT INTO "ActivePresence" 
        ("Zone_id", "Teacher_ID", "PersonType", "EntryTime")
        VALUES (1, %s, 'Teacher', %s)
        RETURNING "Presence_ID"
    """, (teacher_id, entry_time))
    presence_id = cur.fetchone()[0]
    print(f"     ✅ ActivePresence ID: {presence_id}")
    
    # Insert into AttendanceLog
    print("   - Inserting into AttendanceLog...")
    cur.execute("""
        INSERT INTO "AttendanceLog" 
        ("Zone_id", "Teacher_ID", "PersonType", "EntryTime", "ExitTime", "Duration")
        VALUES (1, %s, 'Teacher', %s, NULL, NULL)
        RETURNING "Log_ID"
    """, (teacher_id, entry_time))
    log_id = cur.fetchone()[0]
    print(f"     ✅ AttendanceLog ID: {log_id}")
    
    # Insert into Logs
    print("   - Inserting into Logs...")
    cur.execute("""
        INSERT INTO "Logs" 
        ("EntryTime", "PersonType", "Teacher_ID", "Zone_id")
        VALUES (%s, 'Teacher', %s, 1)
        RETURNING "Logs_ID"
    """, (entry_time, teacher_id))
    logs_id = cur.fetchone()[0]
    print(f"     ✅ Logs ID: {logs_id}")
    
    # Commit
    conn.commit()
    print("\n   ✅ COMMIT: All records inserted successfully!")
    
except Exception as e:
    print(f"\n   ❌ INSERT FAILED: {e}")
    conn.rollback()
    exit(1)

# Test 5: Verify records exist
print("\n5. Verifying records in database...")
cur.execute('SELECT COUNT(*) FROM "ActivePresence"')
print(f"   - ActivePresence: {cur.fetchone()[0]} records")

cur.execute('SELECT COUNT(*) FROM "AttendanceLog"')
print(f"   - AttendanceLog: {cur.fetchone()[0]} records")

cur.execute('SELECT COUNT(*) FROM "Logs"')
print(f"   - Logs: {cur.fetchone()[0]} records")

# Test 6: Show latest entries
print("\n6. Latest entry details:")
cur.execute("""
    SELECT ap."Presence_ID", t."Name", ap."EntryTime"
    FROM "ActivePresence" ap
    JOIN "Teacher" t ON ap."Teacher_ID" = t."Teacher_ID"
    ORDER BY ap."EntryTime" DESC
    LIMIT 1
""")
latest = cur.fetchone()
if latest:
    print(f"   Person: {latest[1]}")
    print(f"   Entry Time: {latest[2]}")
    print(f"   Presence ID: {latest[0]}")

cur.close()
conn.close()

print("\n" + "="*60)
print("✅ TEST COMPLETE - Database insertion works!")
print("="*60)
print("\nIf this test passes but camera_detection_system.py doesn't insert,")
print("the issue is in the camera detection code logic.")
