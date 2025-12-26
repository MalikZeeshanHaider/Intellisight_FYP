# Daily Reset System

## Overview
The daily reset system automatically clears active presence records at midnight while preserving attendance history. This ensures fresh daily statistics while maintaining complete historical data.

## Features

### 1. Automatic Daily Reset (Midnight)
- ✅ Runs automatically at 00:00 (midnight) every day
- ✅ Moves active users to attendance log
- ✅ Clears active presence table
- ✅ Preserves all attendance history
- ✅ Cleans up old unknown faces (keeps 7 days)

### 2. What Gets Reset
- **Active Presence**: All current zone occupancy is cleared
- **Daily Statistics**: Fresh counters for new day
- **Unknown Faces**: Records older than 7 days are removed

### 3. What Gets Preserved
- **Attendance Logs**: Complete history maintained
- **Student/Teacher Records**: All user data intact
- **Zone Configuration**: Settings unchanged
- **Camera Settings**: Configuration preserved

## API Endpoints

### Get Daily Statistics
```http
GET /api/daily-reset/statistics
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "today": 15,
    "last7Days": 127,
    "currentActive": 4
  }
}
```

### Manual Reset (Admin Only)
```http
POST /api/daily-reset/manual
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recordsCleared": 4,
    "recordsLogged": 4
  }
}
```

### Clear Active Presence Only
```http
POST /api/daily-reset/clear-active
Authorization: Bearer <token>
```

## Scheduled Jobs

### Daily Reset Job
```javascript
// Runs at midnight (00:00) every day
cron.schedule('0 0 * * *', async () => {
  await resetDailyActivePresence();
  await cleanupOldUnknownFaces(7);
});
```

## How It Works

### Step 1: Auto-Exit Active Users
```
For each person in ActivePresence:
  1. Check if attendance log exists for today
  2. If not, create log entry with:
     - EntryTime: Original entry time
     - ExitTime: Current time (auto-exit)
     - Duration: Calculated in minutes
  3. Mark as logged
```

### Step 2: Clear Active Presence
```
DELETE FROM ActivePresence
WHERE 1=1  -- All records
```

### Step 3: Cleanup Old Data
```
DELETE FROM UnknownFaces
WHERE DetectedTime < (NOW() - INTERVAL '7 days')
```

## Dashboard Integration

### Active Presence Widget
```javascript
// Shows current real-time presence
const activePresence = await fetch('/api/daily-reset/statistics');
// Updates every 10 seconds
```

### Graph/Chart Data
```javascript
// Daily attendance counts
const stats = {
  today: todayCount,           // Resets at midnight
  last7Days: weekCount,        // Rolling 7-day window
  currentActive: liveCount     // Real-time count
};
```

## Testing

### Test Daily Reset
```bash
# Manual trigger (for testing)
curl -X POST http://localhost:3000/api/daily-reset/manual \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Statistics
```bash
curl http://localhost:3000/api/daily-reset/statistics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Database Schema

### ActivePresence (Gets Reset)
```sql
CREATE TABLE "ActivePresence" (
  "Presence_ID" SERIAL PRIMARY KEY,
  "PersonType" TEXT NOT NULL,
  "Student_ID" INTEGER,
  "Teacher_ID" INTEGER,
  "Zone_id" INTEGER NOT NULL,
  "EntryTime" TIMESTAMP DEFAULT NOW()
);
```

### AttendanceLog (Preserved Forever)
```sql
CREATE TABLE "AttendanceLog" (
  "Log_ID" SERIAL PRIMARY KEY,
  "PersonType" TEXT NOT NULL,
  "Student_ID" INTEGER,
  "Teacher_ID" INTEGER,
  "Zone_id" INTEGER NOT NULL,
  "EntryTime" TIMESTAMP NOT NULL,
  "ExitTime" TIMESTAMP,
  "Duration" INTEGER
);
```

## Configuration

### Change Reset Time
Edit `src/services/dailyReset.service.js`:
```javascript
// Change from midnight to 2 AM
cron.schedule('0 2 * * *', async () => {
  // Reset logic
});
```

### Change Cleanup Period
```javascript
// Keep 30 days instead of 7
await cleanupOldUnknownFaces(30);
```

## Monitoring

### Check Scheduler Status
```javascript
// In server logs
[2025-12-26T00:00:00.000Z] [INFO] ⏰ Triggered scheduled daily reset
[2025-12-26T00:00:01.234Z] [INFO] ✓ Cleared 12 active presence records
[2025-12-26T00:00:01.567Z] [INFO] ✅ Daily reset completed successfully
```

### View Logs
```bash
# Check if scheduler is running
tail -f logs/app.log | grep "daily reset"

# Manual check
curl http://localhost:3000/api/daily-reset/statistics
```

## Troubleshooting

### Reset Not Running
1. Check if node-cron is installed: `npm list node-cron`
2. Verify server is running continuously
3. Check server logs for errors

### Data Not Clearing
1. Check database connection
2. Verify Prisma schema is up to date
3. Run manual reset to test: `POST /api/daily-reset/manual`

### Missing Attendance Logs
1. Verify auto-exit logic is working
2. Check AttendanceLog table
3. Ensure ExitTime is being set

## Benefits

✅ **Fresh Daily Statistics**: Accurate daily counts
✅ **Complete History**: All attendance records preserved
✅ **Auto-Exit Handling**: Users left overnight are logged
✅ **Clean Data**: Old unknown faces removed
✅ **Reliable**: Automatic execution every day
✅ **Flexible**: Manual trigger available for testing

## Migration Notes

If upgrading from a system without daily reset:
1. Existing ActivePresence records will be preserved until first reset
2. First reset will log all active users
3. Subsequent resets will work normally
4. No data loss - all records go to AttendanceLog
