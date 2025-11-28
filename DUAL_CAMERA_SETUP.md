# Dual Camera System - Zone 1 Live Tracking

## Overview
The Zone 1 page now supports **2 cameras** (Entry and Exit) side by side for complete entry/exit tracking.

## Features

### 1. Dual Camera Layout
- **Entry Camera** (Left/Top): Green indicator, detects people entering the zone
- **Exit Camera** (Right/Bottom): Orange indicator, detects people leaving the zone
- Both cameras run simultaneously with independent detection
- Responsive grid layout: 2 columns on large screens, stacked on smaller screens

### 2. Camera-Specific Logic

#### Entry Camera
- Detects faces and matches against database
- Adds recognized persons to `ActivePresence` table
- Tracks entry time automatically
- Only logs new entries (prevents duplicates)

#### Exit Camera
- Detects when a person leaves
- Checks if person exists in `ActivePresence`
- Calculates stay duration (in minutes)
- Creates record in `AttendanceLog` table
- Removes person from `ActivePresence`

### 3. Visual Indicators
- **Green boxes**: Known persons (matched from database)
- **Red boxes**: Unknown persons
- **Green dot**: Entry camera label
- **Orange dot**: Exit camera label
- Real-time face count displayed above each camera

### 4. Backend Processing
- `logRecognizedPerson()` now accepts `cameraType` parameter
- Entry camera: Creates ActivePresence record
- Exit camera: Moves to AttendanceLog, calculates duration
- Automatic duplicate prevention

## How It Works

### Flow Diagram
```
Entry Camera Detects → Match Face → Add to ActivePresence
                                    ↓
                                Entry Time Recorded
                                    ↓
                            Person in Zone (Active)
                                    ↓
Exit Camera Detects → Match Face → Calculate Duration → Create AttendanceLog → Remove from ActivePresence
```

### Database Tables

#### ActivePresence (Temporary)
- Tracks people currently in the zone
- Created on Entry camera detection
- Deleted on Exit camera detection

#### AttendanceLog (Permanent)
- Historical record of all entries/exits
- Includes EntryTime, ExitTime, Duration
- Created when person exits via Exit camera

## API Changes

### POST /api/zones/1/recognized
Now accepts `cameraType` in request body:

```json
{
  "personId": 123,
  "personType": "Student",
  "confidence": 0.95,
  "cameraType": "Entry"  // or "Exit"
}
```

#### Response for Entry Camera:
```json
{
  "success": true,
  "message": "Person entry logged successfully",
  "data": {
    "Presence_ID": 1,
    "Zone_id": 1,
    "Student_ID": 123,
    "PersonType": "Student",
    "EntryTime": "2025-11-28T10:30:00.000Z"
  }
}
```

#### Response for Exit Camera:
```json
{
  "success": true,
  "message": "Person exit logged successfully",
  "data": {
    "duration": 45,  // minutes
    "exitTime": "2025-11-28T11:15:00.000Z"
  }
}
```

## Component Updates

### Zone1.jsx
- Added separate state for entry/exit cameras:
  - `entryWebcamRef`, `exitWebcamRef`
  - `entryDetections`, `exitDetections`
  - `entryMatches`, `exitMatches`
- Updated `startFaceDetection()` to process both cameras
- Added `processDetections()` helper for camera-specific logic
- Updated `handleRecognizedPerson()` to include camera type

### LiveCameraFeed.jsx
- Added props: `cameraLabel`, `cameraType`
- Color-coded camera info bar based on type
- Displays camera type and indicator color

### zone1.controller.js
- `logRecognizedPerson()` handles both entry and exit logic
- Entry: Creates ActivePresence record
- Exit: Creates AttendanceLog, removes from ActivePresence
- Automatic duration calculation

## Usage

### 1. Access the Page
Navigate to: `http://localhost:3001/zone1`

### 2. Camera Setup
- Grant camera permissions when prompted
- Two camera feeds will appear side by side
- Entry camera (left) with green indicator
- Exit camera (right) with orange indicator

### 3. Testing Entry/Exit Flow

**Entry Test:**
1. Stand in front of Entry camera
2. System detects face and matches against database
3. Green box appears around face with name
4. Person added to ActivePresence
5. Check "Current Persons" panel to see active entry

**Exit Test:**
1. Same person stands in front of Exit camera
2. System detects and matches face
3. Calculates time spent in zone
4. Creates AttendanceLog record
5. Removes from ActivePresence
6. Check "Zone Logs" to see completed entry/exit record

### 4. Statistics Dashboard
- **Known in Zone**: Current number of recognized people (from both cameras)
- **Unknown in Zone**: Current number of unknown faces
- **Total Recognized**: Cumulative recognized detections
- **Total Unknown**: Cumulative unknown detections

## Technical Details

### Camera Detection Interval
- Both cameras checked every **3 seconds**
- Independent processing for each camera
- Prevents duplicate processing with `processingRef`

### Face Recognition Settings
- Tolerance: **0.6** (matching threshold)
- Detection options: landmarks + descriptors enabled
- Real-time canvas overlay with bounding boxes

### Duplicate Prevention
- Person key format: `{type}-{id}-{cameraType}`
- 5-minute cooldown before re-detection
- Exit requires existing ActivePresence entry

### Unknown Face Handling
- 10-second cooldown between unknown captures
- Prevents spam logging
- Captures image and stores in UnknownFaces table

## Troubleshooting

### Both cameras not appearing
- Check browser camera permissions
- Ensure 2 cameras connected to system
- Try refreshing page

### Detection not working
- Verify face-api.js models loaded (check browser console)
- Ensure face database populated (enroll students/teachers first)
- Check lighting conditions

### Entry/Exit not syncing
- Verify backend server running on port 3000
- Check database connection
- Ensure person was detected by Entry camera first

### API errors
- Check network tab in browser DevTools
- Verify person exists in database
- Ensure correct personType (Student/Teacher)

## Files Modified

1. **admin-dashboard/src/pages/Zone1.jsx**
   - Dual camera state management
   - Side-by-side camera layout
   - Camera-specific detection processing

2. **admin-dashboard/src/components/Zone1/LiveCameraFeed.jsx**
   - Camera label and type props
   - Color-coded indicators
   - Camera info display

3. **src/controllers/zone1.controller.js**
   - Entry/Exit logic in `logRecognizedPerson()`
   - Duration calculation
   - ActivePresence ↔ AttendanceLog handling

## Next Steps

1. **Test with real cameras**: Connect 2 physical cameras
2. **Configure camera indices**: May need to set specific device IDs
3. **Add camera settings**: Allow users to select which camera is Entry/Exit
4. **Enhance UI**: Add camera switching, recording options
5. **Performance optimization**: Adjust detection interval based on performance

## Camera Configuration

To use specific cameras instead of default:

```javascript
// In LiveCameraFeed.jsx
const videoConstraints = {
  width: 640,
  height: 480,
  deviceId: cameraType === 'Entry' 
    ? { exact: 'camera-device-id-1' }  // Replace with actual device ID
    : { exact: 'camera-device-id-2' }
};
```

Get camera device IDs:
```javascript
navigator.mediaDevices.enumerateDevices()
  .then(devices => {
    const cameras = devices.filter(d => d.kind === 'videoinput');
    console.log('Available cameras:', cameras);
  });
```

## Support

For issues or questions:
1. Check browser console for errors
2. Verify database tables exist (ActivePresence, AttendanceLog)
3. Ensure backend API endpoints responding
4. Review this documentation

---

**Last Updated**: November 28, 2025  
**Version**: 2.0 - Dual Camera System
