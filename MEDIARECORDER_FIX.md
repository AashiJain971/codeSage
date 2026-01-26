# MediaRecorder Fix - Resume Interview

## Issue
**Error**: `Failed to execute 'start' on 'MediaRecorder': There was an error starting the MediaRecorder`

### Root Cause
The MediaRecorder was being instantiated multiple times without proper state tracking and cleanup, leading to:
- Attempts to start an already-running recorder
- Multiple recorder instances conflicting
- No cleanup of previous recorder instances
- Inactive or ended media streams being reused

## Solution

### 1. Added MediaRecorder Reference
Created a ref to track the current recorder instance:
```typescript
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
```

### 2. Proper State Checks
Added guard in `startServerVAD()` to prevent starting if already recording:
```typescript
if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
  console.log('⚠️ Recording already in progress, ignoring request');
  return;
}
```

### 3. Cleanup Before Starting
In `recordAndSendAnswer()`, stop any existing recorder before creating a new one:
```typescript
// Stop any existing recorder first
if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
  console.log('⚠️ Stopping previous recorder');
  try {
    mediaRecorderRef.current.stop();
  } catch (e) {
    console.warn('Error stopping previous recorder:', e);
  }
  mediaRecorderRef.current = null;
}
```

### 4. Audio Track Validation
Verify stream has active audio tracks before recording:
```typescript
const audioTracks = stream.getAudioTracks();
if (audioTracks.length === 0 || !audioTracks[0].enabled) {
  console.error('❌ No active audio tracks available');
  addLog('⚠️ Microphone not available - please check permissions');
  setPhaseStatus('');
  return;
}
```

### 5. Enhanced Logging
Added detailed logging for debugging:
```typescript
console.log('🎤 Active audio tracks:', audioTracks.map(t => `${t.label} (${t.readyState})`));
console.log('▶️ Starting MediaRecorder...');
recorder.start();
console.log('✅ MediaRecorder started, state:', recorder.state);
```

### 6. Proper Error Handling
Improved error handling in recorder lifecycle:
```typescript
recorder.onerror = (e) => {
  console.error('❌ MediaRecorder error:', e);
  reject(e);
};

recorder.onstop = () => {
  mediaRecorderRef.current = null; // Clear ref on stop
  resolve(new Blob(chunks, { type: mimeType }));
};
```

### 7. Component Cleanup
Added cleanup on unmount to stop any active recorder:
```typescript
useEffect(() => {
  return () => {
    // ... other cleanup ...
    
    // Cleanup MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping MediaRecorder on cleanup:', e);
      }
    }
  };
}, []);
```

### 8. WebSocket Connection Check
Added proper error message when WebSocket is not connected:
```typescript
if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
  console.warn('⚠️ WebSocket not connected, cannot start recording');
  addLog('⚠️ Connection lost - please wait');
  return;
}
```

## Files Modified
- [frontend/src/app/interview/resume/page.tsx](frontend/src/app/interview/resume/page.tsx)
  - Line ~82: Added `mediaRecorderRef` 
  - Line ~325: Added recording-in-progress check
  - Line ~360: Stop previous recorder before starting new one
  - Line ~375: Validate audio tracks before recording
  - Line ~410: Enhanced logging for MediaRecorder
  - Line ~420: Clear ref in onstop handler
  - Line ~1500: Added MediaRecorder cleanup on unmount

## Expected Behavior After Fix

### Before Recording Starts
1. ✅ Check if already recording → skip if true
2. ✅ Stop any existing recorder instance
3. ✅ Validate media stream has active audio tracks
4. ✅ Verify WebSocket connection is active

### During Recording
1. ✅ MediaRecorder tracks via ref
2. ✅ Detailed logging of state transitions
3. ✅ Proper error handling
4. ✅ Auto-stops after 6 seconds

### After Recording Ends
1. ✅ Ref cleared automatically
2. ✅ Ready for next recording
3. ✅ No lingering recorder instances

### On Component Unmount
1. ✅ Active recorder stopped gracefully
2. ✅ No memory leaks
3. ✅ Clean shutdown

## Testing Checklist

- [ ] Click record button once - should start recording
- [ ] Click record button rapidly - should ignore duplicate clicks
- [ ] Complete one recording - should be able to start another
- [ ] Check browser console - should see detailed logging
- [ ] Verify audio tracks are active before recording
- [ ] Test with/without camera permissions
- [ ] Test WebSocket disconnect during recording
- [ ] Test component unmount while recording

## Debugging Tips

### If Error Still Occurs
1. **Check Browser Console**
   - Look for "MediaRecorder started, state:" log
   - Verify state is "recording" not "inactive"

2. **Verify Audio Tracks**
   - Check "Active audio tracks:" log
   - Ensure tracks show "(live)" status

3. **Check Stream State**
   - Verify `cameraStream` is not null
   - Ensure stream hasn't ended

4. **Test Permissions**
   - Open browser settings
   - Grant microphone access
   - Refresh page

5. **WebSocket Connection**
   - Look for "WebSocket connected successfully" log
   - Ensure connection is "OPEN" state

### Common Issues

**"No active audio tracks"**
- Microphone not granted or blocked
- Stream ended/stopped
- Solution: Restart camera or refresh page

**"Recording already in progress"**
- Previous recording didn't complete
- Solution: Wait for it to finish or refresh page

**"WebSocket not connected"**
- Backend not running
- Connection lost
- Solution: Check backend server, reconnect

## Technical Details

### MediaRecorder States
- `inactive` - Not recording (safe to start)
- `recording` - Currently recording (cannot start)
- `paused` - Recording paused (not used in our code)

### Ref Pattern
Using `useRef` instead of state prevents re-renders and maintains consistent reference to the current recorder instance across function calls.

### Cleanup Strategy
Three-layer cleanup:
1. Before starting - stop previous instance
2. On stop - clear ref
3. On unmount - force stop if still active

## Related Documentation
- [MANUAL_RECORDING_GUIDE.md](./MANUAL_RECORDING_GUIDE.md) - How to use manual recording
- [WEBSOCKET_FIX.md](./WEBSOCKET_FIX.md) - WebSocket authentication

## Support
If issues persist:
1. Clear browser cache
2. Check microphone permissions in browser settings
3. Try different browser (Chrome, Firefox, Safari)
4. Restart backend server
5. Check browser console for detailed error logs
