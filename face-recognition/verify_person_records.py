"""
IntelliSight - Person Records Verification Script
Displays all person detection records from database tables

This script shows:
1. Active Presence (who is currently in zones)
2. Attendance Logs (entry/exit history)
3. Person Logs (all detection events)
4. Unknown Faces (unrecognized detections)
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from config import DB_CONFIG
from tabulate import tabulate
import sys

def connect_database():
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("✅ Database connected successfully\n")
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)

def get_active_presence(conn):
    """Get all active presence records"""
    print("=" * 80)
    print("📍 ACTIVE PRESENCE (Currently in Zones)")
    print("=" * 80)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                ap."Presence_ID",
                ap."Zone_id",
                z."Zone_Name",
                ap."PersonType",
                CASE 
                    WHEN ap."PersonType" = 'Student' THEN s."Name"
                    WHEN ap."PersonType" = 'Teacher' THEN t."Name"
                END as "Person_Name",
                CASE 
                    WHEN ap."PersonType" = 'Student' THEN ap."Student_ID"
                    WHEN ap."PersonType" = 'Teacher' THEN ap."Teacher_ID"
                END as "Person_ID",
                ap."EntryTime",
                EXTRACT(EPOCH FROM (NOW() - ap."EntryTime"))/60 as "Minutes_In_Zone"
            FROM "ActivePresence" ap
            LEFT JOIN "Zone" z ON ap."Zone_id" = z."Zone_id"
            LEFT JOIN "Students" s ON ap."Student_ID" = s."Student_ID"
            LEFT JOIN "Teacher" t ON ap."Teacher_ID" = t."Teacher_ID"
            ORDER BY ap."EntryTime" DESC
        """)
        
        records = cur.fetchall()
        
        if records:
            table_data = []
            for rec in records:
                table_data.append([
                    rec['Presence_ID'],
                    rec['Zone_Name'] or f"Zone {rec['Zone_id']}",
                    rec['PersonType'],
                    rec['Person_Name'],
                    rec['Person_ID'],
                    rec['EntryTime'].strftime("%Y-%m-%d %H:%M:%S"),
                    f"{int(rec['Minutes_In_Zone'])} min"
                ])
            
            headers = ["Presence ID", "Zone", "Type", "Name", "Person ID", "Entry Time", "Duration"]
            print(tabulate(table_data, headers=headers, tablefmt="grid"))
            print(f"\n📊 Total Active: {len(records)} person(s)\n")
        else:
            print("ℹ️  No one currently in any zone\n")

def get_attendance_logs(conn, limit=20):
    """Get attendance log records"""
    print("=" * 80)
    print("📋 ATTENDANCE LOGS (Entry/Exit History)")
    print("=" * 80)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                al."Log_ID",
                al."Zone_id",
                z."Zone_Name",
                al."PersonType",
                CASE 
                    WHEN al."PersonType" = 'Student' THEN s."Name"
                    WHEN al."PersonType" = 'Teacher' THEN t."Name"
                END as "Person_Name",
                CASE 
                    WHEN al."PersonType" = 'Student' THEN al."Student_ID"
                    WHEN al."PersonType" = 'Teacher' THEN al."Teacher_ID"
                END as "Person_ID",
                al."EntryTime",
                al."ExitTime",
                al."Duration",
                CASE 
                    WHEN al."ExitTime" IS NULL THEN 'Active'
                    ELSE 'Completed'
                END as "Status"
            FROM "AttendanceLog" al
            LEFT JOIN "Zone" z ON al."Zone_id" = z."Zone_id"
            LEFT JOIN "Students" s ON al."Student_ID" = s."Student_ID"
            LEFT JOIN "Teacher" t ON al."Teacher_ID" = t."Teacher_ID"
            ORDER BY al."EntryTime" DESC
            LIMIT %s
        """, (limit,))
        
        records = cur.fetchall()
        
        if records:
            table_data = []
            for rec in records:
                exit_time = rec['ExitTime'].strftime("%H:%M:%S") if rec['ExitTime'] else "---"
                duration = f"{rec['Duration']} min" if rec['Duration'] else "---"
                
                table_data.append([
                    rec['Log_ID'],
                    rec['Zone_Name'] or f"Zone {rec['Zone_id']}",
                    rec['PersonType'],
                    rec['Person_Name'],
                    rec['Person_ID'],
                    rec['EntryTime'].strftime("%Y-%m-%d %H:%M:%S"),
                    exit_time,
                    duration,
                    rec['Status']
                ])
            
            headers = ["Log ID", "Zone", "Type", "Name", "Person ID", "Entry Time", "Exit Time", "Duration", "Status"]
            print(tabulate(table_data, headers=headers, tablefmt="grid"))
            print(f"\n📊 Showing {len(records)} most recent log(s)\n")
        else:
            print("ℹ️  No attendance logs found\n")

def get_person_logs(conn, limit=20):
    """Get person logs (Logs table)"""
    print("=" * 80)
    print("📝 PERSON LOGS (All Detection Events)")
    print("=" * 80)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                l."Logs_ID",
                l."Zone_id",
                z."Zone_Name",
                l."PersonType",
                CASE 
                    WHEN l."PersonType" = 'Student' THEN s."Name"
                    WHEN l."PersonType" = 'Teacher' THEN t."Name"
                    WHEN l."PersonType" = 'Admin' THEN a."Name"
                END as "Person_Name",
                CASE 
                    WHEN l."PersonType" = 'Student' THEN l."Student_ID"
                    WHEN l."PersonType" = 'Teacher' THEN l."Teacher_ID"
                    WHEN l."PersonType" = 'Admin' THEN l."Admin_ID"
                END as "Person_ID",
                l."EntryTime",
                l."ExitTime"
            FROM "Logs" l
            LEFT JOIN "Zone" z ON l."Zone_id" = z."Zone_id"
            LEFT JOIN "Students" s ON l."Student_ID" = s."Student_ID"
            LEFT JOIN "Teacher" t ON l."Teacher_ID" = t."Teacher_ID"
            LEFT JOIN "Admin" a ON l."Admin_ID" = a."Admin_ID"
            ORDER BY l."EntryTime" DESC
            LIMIT %s
        """, (limit,))
        
        records = cur.fetchall()
        
        if records:
            table_data = []
            for rec in records:
                entry_time = rec['EntryTime'].strftime("%Y-%m-%d %H:%M:%S") if rec['EntryTime'] else "---"
                exit_time = rec['ExitTime'].strftime("%H:%M:%S") if rec['ExitTime'] else "---"
                
                table_data.append([
                    rec['Logs_ID'],
                    rec['Zone_Name'] or f"Zone {rec['Zone_id']}" if rec['Zone_id'] else "---",
                    rec['PersonType'] or "---",
                    rec['Person_Name'] or "Unknown",
                    rec['Person_ID'] or "---",
                    entry_time,
                    exit_time
                ])
            
            headers = ["Log ID", "Zone", "Type", "Name", "Person ID", "Entry Time", "Exit Time"]
            print(tabulate(table_data, headers=headers, tablefmt="grid"))
            print(f"\n📊 Showing {len(records)} most recent log(s)\n")
        else:
            print("ℹ️  No person logs found\n")

def get_unknown_faces(conn, limit=10):
    """Get unknown face records"""
    print("=" * 80)
    print("❓ UNKNOWN FACES (Unrecognized Detections)")
    print("=" * 80)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                "Unknown_ID",
                "Zone_id",
                "DetectedTime",
                "Confidence",
                "Status",
                "Notes"
            FROM "UnknownFaces"
            ORDER BY "DetectedTime" DESC
            LIMIT %s
        """, (limit,))
        
        records = cur.fetchall()
        
        if records:
            table_data = []
            for rec in records:
                table_data.append([
                    rec['Unknown_ID'],
                    f"Zone {rec['Zone_id']}" if rec['Zone_id'] else "---",
                    rec['DetectedTime'].strftime("%Y-%m-%d %H:%M:%S"),
                    f"{rec['Confidence']:.2f}" if rec['Confidence'] else "0.00",
                    rec['Status'] or "PENDING",
                    rec['Notes'] or "---"
                ])
            
            headers = ["Unknown ID", "Zone", "Detected Time", "Confidence", "Status", "Notes"]
            print(tabulate(table_data, headers=headers, tablefmt="grid"))
            print(f"\n📊 Total Unknown: {len(records)} detection(s)\n")
        else:
            print("ℹ️  No unknown faces detected\n")

def get_statistics(conn):
    """Get overall statistics"""
    print("=" * 80)
    print("📊 OVERALL STATISTICS")
    print("=" * 80)
    
    stats = {}
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Total students and teachers
        cur.execute('SELECT COUNT(*) as count FROM "Students"')
        stats['total_students'] = cur.fetchone()['count']
        
        cur.execute('SELECT COUNT(*) as count FROM "Teacher"')
        stats['total_teachers'] = cur.fetchone()['count']
        
        # Active presence
        cur.execute('SELECT COUNT(*) as count FROM "ActivePresence"')
        stats['active_now'] = cur.fetchone()['count']
        
        # Total attendance logs
        cur.execute('SELECT COUNT(*) as count FROM "AttendanceLog"')
        stats['total_attendance'] = cur.fetchone()['count']
        
        # Total person logs
        cur.execute('SELECT COUNT(*) as count FROM "Logs"')
        stats['total_logs'] = cur.fetchone()['count']
        
        # Unknown faces
        cur.execute('SELECT COUNT(*) as count FROM "UnknownFaces"')
        stats['unknown_faces'] = cur.fetchone()['count']
        
        # Today's detections
        cur.execute("""
            SELECT COUNT(*) as count 
            FROM "Logs" 
            WHERE DATE("EntryTime") = CURRENT_DATE
        """)
        stats['today_detections'] = cur.fetchone()['count']
    
    print(f"👥 Total Students: {stats['total_students']}")
    print(f"👨‍🏫 Total Teachers: {stats['total_teachers']}")
    print(f"📍 Currently Active: {stats['active_now']} person(s)")
    print(f"📋 Total Attendance Records: {stats['total_attendance']}")
    print(f"📝 Total Person Logs: {stats['total_logs']}")
    print(f"❓ Unknown Faces: {stats['unknown_faces']}")
    print(f"📅 Today's Detections: {stats['today_detections']}")
    print()

def get_person_history(conn, person_type, person_id):
    """Get complete history for a specific person"""
    print("=" * 80)
    print(f"📜 PERSON HISTORY: {person_type} ID {person_id}")
    print("=" * 80)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Get person details
        if person_type.lower() == 'student':
            cur.execute("""
                SELECT "Name", "RollNumber", "Email", "Department"
                FROM "Students"
                WHERE "Student_ID" = %s
            """, (person_id,))
        else:
            cur.execute("""
                SELECT "Name", "Email", "Department", "Faculty_Type"
                FROM "Teacher"
                WHERE "Teacher_ID" = %s
            """, (person_id,))
        
        person = cur.fetchone()
        
        if not person:
            print(f"❌ {person_type} ID {person_id} not found\n")
            return
        
        print(f"\n👤 Name: {person['Name']}")
        if 'RollNumber' in person:
            print(f"🎓 Roll Number: {person['RollNumber']}")
        if 'Faculty_Type' in person:
            print(f"👨‍🏫 Faculty Type: {person['Faculty_Type']}")
        print(f"📧 Email: {person['Email']}")
        print(f"🏢 Department: {person['Department']}")
        print()
        
        # Get all logs
        id_field = '"Student_ID"' if person_type.lower() == 'student' else '"Teacher_ID"'
        
        cur.execute(f"""
            SELECT 
                l."Logs_ID",
                l."Zone_id",
                z."Zone_Name",
                l."EntryTime",
                l."ExitTime"
            FROM "Logs" l
            LEFT JOIN "Zone" z ON l."Zone_id" = z."Zone_id"
            WHERE {id_field} = %s
            ORDER BY l."EntryTime" DESC
        """, (person_id,))
        
        logs = cur.fetchall()
        
        if logs:
            print(f"📝 Total Detections: {len(logs)}\n")
            
            table_data = []
            for log in logs:
                entry_time = log['EntryTime'].strftime("%Y-%m-%d %H:%M:%S") if log['EntryTime'] else "---"
                exit_time = log['ExitTime'].strftime("%H:%M:%S") if log['ExitTime'] else "---"
                
                table_data.append([
                    log['Logs_ID'],
                    log['Zone_Name'] or f"Zone {log['Zone_id']}" if log['Zone_id'] else "---",
                    entry_time,
                    exit_time
                ])
            
            headers = ["Log ID", "Zone", "Entry Time", "Exit Time"]
            print(tabulate(table_data, headers=headers, tablefmt="grid"))
        else:
            print("ℹ️  No detection history found")
        
        print()

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='IntelliSight Person Records Verification')
    parser.add_argument('--limit', type=int, default=20, help='Number of records to show')
    parser.add_argument('--person-type', choices=['student', 'teacher'], help='Person type for history')
    parser.add_argument('--person-id', type=int, help='Person ID for history')
    parser.add_argument('--active-only', action='store_true', help='Show only active presence')
    parser.add_argument('--logs-only', action='store_true', help='Show only person logs')
    parser.add_argument('--attendance-only', action='store_true', help='Show only attendance logs')
    
    args = parser.parse_args()
    
    # Connect to database
    conn = connect_database()
    
    try:
        # Show statistics first
        get_statistics(conn)
        
        # Show specific person history
        if args.person_type and args.person_id:
            get_person_history(conn, args.person_type, args.person_id)
        
        # Show all records or specific view
        elif args.active_only:
            get_active_presence(conn)
        elif args.logs_only:
            get_person_logs(conn, args.limit)
        elif args.attendance_only:
            get_attendance_logs(conn, args.limit)
        else:
            # Show everything
            get_active_presence(conn)
            get_attendance_logs(conn, args.limit)
            get_person_logs(conn, args.limit)
            get_unknown_faces(conn, 10)
        
        print("=" * 80)
        print("✅ Verification Complete")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
    
    finally:
        conn.close()
        print("\n📊 Database connection closed")

if __name__ == "__main__":
    main()
