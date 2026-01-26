# Manual Recording Guide - Resume Interview

## Overview
The resume interview now uses **manual recording** instead of automatic voice detection to ensure accurate user responses and prevent false transcriptions.

## Why Manual Recording?

### Previous Issues (Automatic VAD)
- ❌ Recording started automatically 800ms after AI speech ended
- ❌ Picked up ambient noise, echo, or background sounds
- ❌ Transcribed gibberish as user responses (e.g., "Teksting av Nicolai Winther", "hings")
- ❌ Interview continued without real user input
- ❌ Created unusable interview experience

### Current Solution (Manual Button)
- ✅ User explicitly clicks microphone button when ready to speak
- ✅ No false positives from ambient noise
- ✅ User controls when recording starts
- ✅ Natural interview conversation flow
- ✅ AI waits for real user input before proceeding

## How to Use

### Interview Flow
1. **AI asks a question** - The AI speaks the question aloud via text-to-speech
2. **"Your turn" message appears** - Phase status shows: "Your turn - click the microphone button to respond"
3. **Click the blue microphone button** - Located in the bottom control bar
4. **Button turns red and pulses** - Indicates recording is active
5. **Speak your answer** - The system transcribes your speech in real-time
6. **Recording automatically stops** - When you finish speaking (silence detected)
7. **AI processes and responds** - Evaluates your answer and asks the next question
8. **Repeat** - Process continues for all interview questions

### UI Elements

#### Bottom Control Bar
```
[Camera Toggle] [🎤 Record Button] [End Interview]
```

#### Record Button States
- **Blue with shadow** - Ready to record (click to start)
- **Red pulsing** - Currently recording your answer
- **Gray/disabled** - AI is speaking (wait for AI to finish)

#### Phase Status Messages
- **"AI is speaking..."** - Wait for AI to finish the question
- **"Your turn - click the microphone button to respond"** - Ready for your input
- **"Listening..."** - Recording your answer
- **"Processing..."** - Transcribing and analyzing your response

## Code Changes Made

### Files Modified
- `frontend/src/app/interview/resume/page.tsx`

### Key Changes
1. **Removed automatic VAD triggers**
   - `utterance.onend` - No longer auto-starts recording after speech
   - `utterance.onerror` - No longer triggers recording on speech error
   - Failsafe timeout - Changed to show ready message instead of forcing VAD

2. **Added manual record button**
   - Location: Bottom control bar (line ~2100)
   - Function: Calls `startServerVAD()` when clicked
   - States: Ready (blue), Recording (red pulse), Disabled (gray)

3. **Updated phase status messages**
   - Clear guidance: "Your turn - click the microphone button to respond"
   - Visible feedback for all interview states

## Technical Details

### Voice Recording Function
```typescript
const startServerVAD = () => {
  // Only starts when user explicitly clicks the button
  // Sets phase to "Listening..."
  // Initiates WebSocket-based voice transcription
  // Automatically stops on silence detection
};
```

### Button Implementation
```tsx
<motion.button
  onClick={() => {
    if (phase !== 'Listening...') {
      startServerVAD();
    }
  }}
  disabled={phase === 'Listening...' || isSpeaking}
  className={/* Dynamic styling based on state */}
>
  <Mic className="w-6 h-6" />
</motion.button>
```

## Best Practices

### For Users
1. **Wait for AI to finish speaking** - Don't click record while AI is talking
2. **Click the button when ready** - Take your time to think before answering
3. **Speak clearly** - Once recording starts (red button), speak your answer
4. **Don't interrupt** - Let the recording auto-stop when you're done
5. **Watch the phase status** - It tells you exactly what to do next

### For Developers
1. **Never auto-start recording** - Always require explicit user action
2. **Clear visual feedback** - Show recording state prominently
3. **Disable during conflicts** - Prevent recording while AI is speaking
4. **Informative status messages** - Guide users through the process
5. **Test with real audio** - Verify recording doesn't pick up AI's speech or echo

## Troubleshooting

### Button is Disabled/Gray
- **Cause**: AI is currently speaking
- **Solution**: Wait for AI to finish, then button will turn blue

### Recording Doesn't Stop
- **Cause**: Continuous background noise preventing silence detection
- **Solution**: Find a quieter environment or speak in a quiet room

### Transcription is Garbled
- **Cause**: Poor microphone quality or background noise
- **Solution**: Use a better microphone or reduce background noise

### Button Click Does Nothing
- **Cause**: WebSocket connection lost
- **Solution**: Check browser console for errors, refresh page if needed

## Future Enhancements

Potential improvements:
- [ ] Push-to-talk mode (hold button to record, release to stop)
- [ ] Waveform visualization during recording
- [ ] Manual stop button (currently auto-stops on silence)
- [ ] Audio level meter to confirm microphone is working
- [ ] Keyboard shortcut for recording (e.g., Space bar)

## Migration Notes

### From Automatic to Manual
If you were using an older version with automatic voice detection:

**Before** (Automatic):
```typescript
utterance.onend = () => {
  setTimeout(() => startServerVAD(), 800); // Auto-trigger
};
```

**After** (Manual):
```typescript
utterance.onend = () => {
  setPhaseStatus('Your turn - click the microphone button to respond');
  // User must click button to record
};
```

## Related Documentation
- [WEBSOCKET_FIX.md](./WEBSOCKET_FIX.md) - WebSocket authentication setup
- [AUTHENTICATION.md](./AUTHENTICATION.md) - Supabase Auth integration

## Support
If you encounter issues with manual recording:
1. Check browser console for errors
2. Verify microphone permissions are granted
3. Test microphone in browser settings
4. Ensure WebSocket connection is active (check network tab)
5. Try refreshing the page to reset state
