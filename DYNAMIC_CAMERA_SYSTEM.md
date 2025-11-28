# Dynamic Camera Management System

## Overview
The Zone 1 Live Tracking page now features a **dynamic camera system** where users start with one camera and can add/remove cameras as needed using the "Add Camera" button.

## Key Features

### 1. **Single Camera by Default**
- System starts with 1 camera (Camera 1 - Entry type)
- Clean, simple interface for basic use cases
- No overwhelming dual-camera setup unless needed

### 2. **Add Camera Button**
- Located in the top-right of the camera section
- Opens a modal dialog for camera configuration
- Users can add unlimited cameras (though 2-3 is recommended for performance)

### 3. **Camera Configuration Modal**
When clicking "Add Camera", users are prompted to provide:

#### Camera Label
- Custom name for easy identification
- Examples: "Entry Camera", "Exit Camera", "Main Door", "Back Entrance"
- Helps differentiate multiple cameras in the same zone

#### Camera Type
Two options with distinct behaviors:

**Entry Camera (Green indicator)**
- Detects people entering the zone
- Adds recognized persons to `ActivePresence` table
- Records entry timestamp
- Use for: Main entrances, door entries, access points

**Exit Camera (Orange indicator)**
- Detects people leaving the zone
- Checks if person exists in `ActivePresence`
- Calculates stay duration
- Creates `AttendanceLog` record
- Removes from `ActivePresence`
- Use for: Exit doors, checkout points, departure areas

### 4. **Remove Camera**
- X button appears next to each camera header
- Cannot remove the last camera (minimum 1 required)
- Instantly removes camera and cleans up resources
- Confirmation via success message

## User Flow

### Initial Setup
```
1. Page loads with "Camera 1" (Entry type)
2. Grant browser camera permissions
3. Camera feed appears with face detection active
```

### Adding Additional Cameras
```
1. Click "Add Camera" button (top-right)
2. Modal appears with form:
   - Camera Label: [Text input]
   - Camera Type: [Dropdown: Entry/Exit]
   - Info panel explaining camera types
3. Click "Add Camera" button in modal
4. New camera appears in grid layout
5. Success message: "Camera '[Label]' added successfully"
```

### Removing Cameras
```
1. Click X button next to camera name
2. Camera immediately removed from view
3. Success message: "Camera removed successfully"
4. Note: Last camera cannot be removed
```

## Technical Implementation

### State Management
```javascript
// Dynamic camera list
const [cameras, setCameras] = useState([
  { id: 1, label: 'Camera 1', type: 'Entry', enabled: true }
]);

// Camera detection state stored by camera ID
const [cameraDetections, setCameraDetections] = useState({});
const [cameraMatches, setCameraMatches] = useState({});

// Camera refs stored dynamically
const cameraRefs = useRef({});
```

### Camera Processing Loop
```javascript
// Process each enabled camera independently
for (const camera of enabledCameras) {
  const webcam = cameraRefs.current[camera.id]?.video;
  // Detect faces
  // Match against database
  // Process based on camera type (Entry/Exit)
}
```

### Data Structure
Each camera object contains:
- `id`: Unique identifier (number)
- `label`: User-defined name (string)
- `type`: "Entry" or "Exit" (string)
- `enabled`: Active status (boolean)

### Backend Integration
All camera types send `cameraType` parameter:
```javascript
await zone1API.logRecognizedPerson(
  personId,
  personType,
  confidence,
  cameraType  // "Entry" or "Exit"
);
```

## Use Cases

### Scenario 1: Simple Single-Entry Zone
- **Setup**: 1 Entry camera
- **Flow**: People enter → Logged to ActivePresence
- **Use**: Break rooms, study areas, simple tracking

### Scenario 2: Entry/Exit Tracking
- **Setup**: 1 Entry + 1 Exit camera
- **Flow**: 
  - Entry camera → Add to ActivePresence
  - Exit camera → Move to AttendanceLog with duration
- **Use**: Classrooms, labs, meeting rooms

### Scenario 3: Multiple Entry Points
- **Setup**: 2+ Entry cameras
- **Labels**: "Main Door", "Side Door", "Back Entrance"
- **Flow**: All detect entries, each logs separately
- **Use**: Large facilities, multiple access points

### Scenario 4: Complex Zone
- **Setup**: 2 Entry + 1 Exit camera
- **Labels**: "Front Entry", "Side Entry", "Main Exit"
- **Flow**: Multiple entry points feed into single exit
- **Use**: Offices, libraries, secure areas

## UI Elements

### Camera Card Components
```
┌─────────────────────────────────────┐
│ ● Camera Label        [2 faces] [X] │  ← Header with indicator & remove button
├─────────────────────────────────────┤
│                                     │
│         [Camera Feed]               │  ← Live video with face boxes
│                                     │
├─────────────────────────────────────┤
│ ● Camera Label (Entry/Exit) | Info │  ← Footer with type info
└─────────────────────────────────────┘
```

### Add Camera Modal
```
┌─────────────────────────────────────┐
│ Add New Camera                  [X] │
├─────────────────────────────────────┤
│                                     │
│ Camera Label:                       │
│ [Text Input Field                 ] │
│                                     │
│ Camera Type:                        │
│ [Entry (Adds to Active...)      ▼] │
│                                     │
│ ℹ Entry Camera: Detects entering    │
│   Exit Camera: Logs attendance      │
│                                     │
│           [Cancel] [Add Camera]     │
└─────────────────────────────────────┘
```

## Visual Indicators

### Camera Type Colors
- **Entry**: Green pulsing dot (●)
- **Exit**: Orange pulsing dot (●)

### Detection Boxes
- **Green box**: Known person (matched from database)
- **Red box**: Unknown person (not in database)

### Status Messages
- **Success (Green)**: "Camera '[Label]' added successfully"
- **Success (Green)**: "Camera removed successfully"
- **Error (Red)**: "Cannot remove the last camera"
- **Error (Red)**: "Please enter a camera label"

## Responsive Layout

### Desktop (>= 1280px)
- 2 columns grid for cameras
- Side-by-side camera feeds
- Full width modal

### Tablet (768px - 1279px)
- 2 columns grid (may stack based on content)
- Compact camera cards
- Centered modal

### Mobile (< 768px)
- Single column stacked layout
- Full-width camera feeds
- Full-screen modal

## Performance Considerations

### Recommended Limits
- **Optimal**: 1-2 cameras per zone
- **Maximum tested**: 4 cameras
- **Detection interval**: 3 seconds per cycle

### Resource Management
- Each camera uses separate webcam stream
- Detection runs sequentially across cameras
- Previous camera refs cleaned on removal
- Detection state isolated per camera

### Browser Requirements
- Modern browser with MediaDevices API
- Camera permissions granted
- Sufficient CPU for face detection
- Recommended: Chrome/Edge 90+, Firefox 88+

## API Changes

### logRecognizedPerson Endpoint
**POST** `/api/zones/1/recognized`

Request body:
```json
{
  "personId": 123,
  "personType": "Student",
  "confidence": 0.95,
  "cameraType": "Entry"  // User-configured type
}
```

Response varies by camera type:
- **Entry**: Returns ActivePresence record
- **Exit**: Returns duration and exit time

## Error Handling

### Common Errors
1. **"Cannot remove the last camera"**
   - Cause: Attempting to delete only remaining camera
   - Solution: Add another camera before removing

2. **"Please enter a camera label"**
   - Cause: Empty label field in add camera modal
   - Solution: Enter descriptive camera name

3. **Camera not detecting**
   - Cause: Permissions denied or camera in use
   - Solution: Check browser permissions, close other apps using camera

4. **Detection not processing**
   - Cause: Models not loaded
   - Solution: Refresh page, check console for model loading errors

## Migration from Fixed Dual-Camera

### Old System
- 2 fixed cameras (Entry/Exit)
- Hardcoded camera references
- No flexibility

### New System
- Start with 1 camera
- Add cameras dynamically
- User-defined labels and types
- Remove cameras as needed

### Backward Compatibility
- Default camera setup matches old Entry camera
- Add Exit camera manually if needed
- All existing backend APIs compatible

## Future Enhancements

### Potential Features
1. **Camera Settings**
   - Video quality selection
   - Frame rate adjustment
   - Device selection (multiple physical cameras)

2. **Camera Presets**
   - Save camera configurations
   - Quick load common setups
   - Zone templates

3. **Advanced Options**
   - Detection threshold per camera
   - Custom color indicators
   - Camera-specific logs

4. **Analytics**
   - Per-camera statistics
   - Traffic patterns
   - Entry/exit flow analysis

## Troubleshooting

### No camera feeds appearing
1. Check browser camera permissions
2. Ensure no other application using camera
3. Try refreshing the page
4. Check browser console for errors

### Add Camera button not working
1. Check for JavaScript errors in console
2. Verify modal appears (may be behind window)
3. Try closing and reopening

### Detection not working after adding camera
1. Wait for face-api models to load
2. Ensure good lighting conditions
3. Check if camera feed is active (LIVE indicator)
4. Verify person is in face database

### Performance issues with multiple cameras
1. Reduce number of active cameras
2. Increase detection interval (edit code)
3. Use lower resolution camera feeds
4. Close other resource-intensive applications

## Best Practices

### Camera Naming
- Use clear, descriptive labels
- Include location: "North Door Entry", "South Exit"
- Indicate purpose: "Main Checkout", "Emergency Exit"

### Camera Types
- Use Entry for all entrance points
- Use Exit for departure/checkout points
- Avoid mixing types for same physical location

### Layout Organization
- Keep related cameras together
- Entry cameras on left, Exit on right
- Label consistently across zones

### Performance
- Start with 1 camera, add as needed
- Remove unused cameras promptly
- Monitor browser performance
- Test with actual traffic load

## Support

### Documentation
- See `DUAL_CAMERA_SETUP.md` for technical details
- See `TESTING_GUIDE.md` for testing procedures
- See `QUICKSTART.md` for initial setup

### Contact
For issues or questions about the dynamic camera system, check:
1. Browser console for errors
2. Network tab for API issues
3. This documentation for common problems

---

**Version**: 3.0 - Dynamic Camera Management  
**Last Updated**: November 28, 2025  
**Breaking Changes**: None (backward compatible with single-camera setup)
