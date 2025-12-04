#!/usr/bin/env python3
"""
Clear Active Presence Table
Useful when testing to reset the "currently in zone" status
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

# Database connection
DB_CONFIG = {
    'dbname': 'FYP_Intellisight',
    'user': 'postgres',
    'password': 'ozair',
    'host': 'localhost',
    'port': 5000
}

def clear_active_presence():
    """Clear all active presence records"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get current count
        cur.execute('SELECT COUNT(*) as count FROM "ActivePresence"')
        before = cur.fetchone()['count']
        
        print(f"📊 Active Presence Records: {before}")
        
        if before == 0:
            print("✅ No active presence records to clear")
            return
        
        # Show what will be deleted
        cur.execute("""
            SELECT "Presence_ID", "PersonType", 
                   COALESCE("Student_ID", "Teacher_ID") as person_id,
                   "EntryTime"
            FROM "ActivePresence"
            ORDER BY "EntryTime" DESC
        """)
        
        records = cur.fetchall()
        print(f"\n🗑️  Will clear {len(records)} records:")
        for rec in records:
            entry_time = rec['EntryTime'].strftime('%Y-%m-%d %H:%M:%S')
            print(f"   - {rec['PersonType']} {rec['person_id']} (Entry: {entry_time})")
        
        # Confirm
        response = input("\n⚠️  Proceed with clearing? (yes/no): ")
        
        if response.lower() in ['yes', 'y']:
            cur.execute('DELETE FROM "ActivePresence"')
            conn.commit()
            print(f"✅ Cleared {before} active presence records")
        else:
            print("❌ Cancelled")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

def show_summary():
    """Show current database summary"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get counts
        cur.execute('SELECT COUNT(*) as count FROM "ActivePresence"')
        active = cur.fetchone()['count']
        
        cur.execute('SELECT COUNT(*) as count FROM "AttendanceLog"')
        attendance = cur.fetchone()['count']
        
        cur.execute('SELECT COUNT(*) as count FROM "Logs"')
        logs = cur.fetchone()['count']
        
        cur.execute('SELECT COUNT(*) as count FROM "AttendanceLog" WHERE "ExitTime" IS NULL')
        pending = cur.fetchone()['count']
        
        print("\n" + "="*60)
        print("📊 DATABASE SUMMARY")
        print("="*60)
        print(f"  Active in Zone:        {active}")
        print(f"  Attendance Logs:       {attendance}")
        print(f"  Pending Exits:         {pending}")
        print(f"  Total Logs:            {logs}")
        print("="*60)
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("="*60)
    print("🧹 CLEAR ACTIVE PRESENCE")
    print("="*60)
    
    show_summary()
    print()
    clear_active_presence()
    print()
    show_summary()
