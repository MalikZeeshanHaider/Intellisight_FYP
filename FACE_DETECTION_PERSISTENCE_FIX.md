# Face Detection Database Persistence Fix

## Problem Summary
Face recognition was showing temporary stats (Total Recognized: 1) but not persisting data to the database. The issue occurred because the backend controller was trying to create entries in a non-existent `TimeTable` table.

## Root Cause
The `zone1.controller.js` was using `prisma.timeTable` references which don't exist in the current database schema. The correct tables are:
- `ActivePresence` - For tracking who is currently in a zone
- `AttendanceLog` - For historical entry/exit records

## Changes Made

### 1. Backend Controller Fix (`src/controllers/zone1.controller.js`)

#### Entry Logic (Lines 93-106)
**Before:**
```javascript
// Also create TimeTable entry for tracking
await prisma.timeTable.create({
  data: {
    Zone_id: 1,
    PersonType: normalizedType,
    EntryTime: entryTime,
    ...(normalizedType === 'Teacher' 
      ? { Teacher_ID: parseInt(personId) }
      : { Student_ID: parseInt(personId) }
    )
  }
});
```

**After:**
```javascript
// Also create AttendanceLog entry for tracking (with null ExitTime initially)
await prisma.attendanceLog.create({
  data: {
    Zone_id: 1,
    PersonType: normalizedType,
    EntryTime: entryTime,
    ExitTime: null,
    Duration: null,
    ...(normalizedType === 'Teacher' 
      ? { Teacher_ID: parseInt(personId) }
      : { Student_ID: parseInt(personId) }
    )
  }
});
```

#### Exit Logic (Lines 110-160)
**Before:**
- Created new `AttendanceLog` entry on exit
- Updated `TimeTable` with exit time

**After:**
- Updates existing `AttendanceLog` entry with `ExitTime` and `Duration`
- No duplicate entries created

```javascript
// Update AttendanceLog with exit time and duration
const attendanceEntry = await prisma.attendanceLog.findFirst({
  where: {
    Zone_id: 1,
    PersonType: normalizedType,
    ExitTime: null,
    ...(normalizedType === 'Teacher' 
      ? { Teacher_ID: parseInt(personId) }
      : { Student_ID: parseInt(personId) }
    )
  },
  orderBy: {
    EntryTime: 'desc'
  }
});

if (attendanceEntry) {
  await prisma.attendanceLog.update({
    where: {
      Log_ID: attendanceEntry.Log_ID
    },
    data: {
      ExitTime: exitTime,
      Duration: durationMinutes
    }
  });
}
```

#### Logs Endpoint (Line 742)
**Before:**
- Used `prisma.timeTable.findMany()`
- Returned `TimeTable_ID`

**After:**
- Uses `prisma.attendanceLog.findMany()`
- Returns `Log_ID`
- Uses stored `Duration` field instead of calculating on the fly

### 2. Frontend API Fix (`admin-dashboard/src/api/zone1.js`)

#### logRecognizedPerson Function
**Before:**
```javascript
logRecognizedPerson: async (personId, personType, confidence = 0.95) => {
  const response = await api.post('/recognize', {
    personId,
    personType,
    confidence
  });
  return response.data;
}
```

**After:**
```javascript
logRecognizedPerson: async (personId, personType, confidence = 0.95, cameraType = 'Entry') => {
  const response = await api.post('/recognize', {
    personId,
    personType,
    confidence,
    cameraType
  });
  return response.data;
}
```

**Key Change:** Added `cameraType` parameter to distinguish between Entry and Exit camera detections.

## Database Schema (Correct)

### ActivePresence Table
```prisma
model ActivePresence {
  Presence_ID Int       @id @default(autoincrement())
  Zone_id     Int
  Student_ID  Int?
  Teacher_ID  Int?
  PersonType  String
  EntryTime   DateTime  @default(now())
  
  zone        Zone?     @relation(fields: [Zone_id], references: [Zone_id])
  student     Students? @relation(fields: [Student_ID], references: [Student_ID])
  teacher     Teacher?  @relation(fields: [Teacher_ID], references: [Teacher_ID])
}
```

### AttendanceLog Table
```prisma
model AttendanceLog {
  Log_ID      Int       @id @default(autoincrement())
  Zone_id     Int
  Student_ID  Int?
  Teacher_ID  Int?
  PersonType  String
  EntryTime   DateTime
  ExitTime    DateTime?
  Duration    Int?      // In minutes
  
  zone        Zone?     @relation(fields: [Zone_id], references: [Zone_id])
  student     Students? @relation(fields: [Student_ID], references: [Student_ID])
  teacher     Teacher?  @relation(fields: [Teacher_ID], references: [Teacher_ID])
}
```

## Data Flow

### Entry Camera Detection
1. Face recognized → `handleRecognizedPerson()` called in Zone1.jsx
2. API call to POST `/api/zones/1/recognize` with `cameraType: 'Entry'`
3. Backend creates:
   - `ActivePresence` entry (person currently in zone)
   - `AttendanceLog` entry with `ExitTime: null`
4. Stats increment: `Total Recognized++`, `Known in Zone++`

### Exit Camera Detection
1. Face recognized → `handleRecognizedPerson()` called with `cameraType: 'Exit'`
2. API call to POST `/api/zones/1/recognize` with `cameraType: 'Exit'`
3. Backend:
   - Finds existing `AttendanceLog` entry (where `ExitTime IS NULL`)
   - Updates with `ExitTime` and calculated `Duration`
   - Deletes from `ActivePresence` (person left zone)
4. Stats decrement: `Known in Zone--`

## Zone-Specific Tracking

Each zone maintains separate statistics by filtering on `Zone_id`:
- **Zone 1**: `Zone_id: 1`
- **Zone 2**: `Zone_id: 2`
- etc.

### Stats Calculation
```javascript
// Known in Zone - from ActivePresence
const knownInZone = await prisma.activePresence.count({
  where: { Zone_id: 1 }
});

// Total Recognized - from AttendanceLog
const totalRecognized = await prisma.attendanceLog.count({
  where: { Zone_id: 1 }
});

// Unknown in Zone - from UnknownFaces
const unknownInZone = await prisma.unknownFaces.count({
  where: { Zone_id: 1, Status: 'PENDING' }
});
```

## Testing Verification

### 1. Check ActivePresence Table
```sql
SELECT * FROM "ActivePresence" WHERE "Zone_id" = 1;
```
Should show entries when people are currently in the zone.

### 2. Check AttendanceLog Table
```sql
SELECT * FROM "AttendanceLog" WHERE "Zone_id" = 1 ORDER BY "EntryTime" DESC;
```
Should show all entry/exit records with durations.

### 3. Test Entry Detection
- Stand in front of Entry camera
- Face should be recognized
- Check database: New entry in both `ActivePresence` and `AttendanceLog`

### 4. Test Exit Detection
- Stand in front of Exit camera
- Face should be recognized
- Check database: 
  - Entry removed from `ActivePresence`
  - `AttendanceLog` updated with `ExitTime` and `Duration`

## API Endpoints

### POST /api/zones/1/recognize
Logs recognized person entry or exit.

**Request Body:**
```json
{
  "personId": 1,
  "personType": "Student",
  "confidence": 0.95,
  "cameraType": "Entry"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Person entry logged successfully",
  "data": {
    "Presence_ID": 1,
    "Zone_id": 1,
    "Student_ID": 1,
    "PersonType": "Student",
    "EntryTime": "2025-12-04T17:48:15.000Z"
  }
}
```

### GET /api/zones/1/current
Gets all persons currently in Zone 1.

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "Presence_ID": 1,
      "PersonType": "Student",
      "PersonID": 1,
      "Name": "Abdullah Uzair",
      "EntryTime": "2025-12-04T17:48:15.000Z",
      "Duration": 15
    }
  ]
}
```

### GET /api/zones/1/timetable-logs
Gets attendance log history.

**Response:**
```json
{
  "success": true,
  "count": 10,
  "total": 25,
  "data": [
    {
      "Log_ID": 1,
      "PersonType": "Teacher",
      "PersonID": 1,
      "Name": "Abdullah",
      "EntryTime": "2025-12-04T17:00:00.000Z",
      "ExitTime": "2025-12-04T18:30:00.000Z",
      "Duration": 90,
      "Status": "Completed"
    }
  ]
}
```

## Status
✅ Backend server restarted with fixes
✅ Frontend server running with updated API
✅ Database schema verified
✅ Entry/Exit logic corrected
✅ Zone-specific tracking implemented
✅ Ready for testing

## Next Steps
1. Test face detection with Entry camera
2. Verify database entries in `ActivePresence` and `AttendanceLog`
3. Test Exit camera detection
4. Verify stats update correctly on Zone Live page
5. Check that each zone maintains separate statistics
