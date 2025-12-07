# KamoX Pomodoro Timer

A simple Pomodoro timer extension for testing KamoX Service Worker features.

## Features

- ⏱️ **25-minute Pomodoro timer** running in the background
- 🔔 **Desktop notifications** when sessions complete
- 🎯 **Badge counter** showing remaining time
- 📊 **Session tracking** to count completed Pomodoros
- 🔄 **Persistent state** across browser restarts

## KamoX Testing Features

This extension is specifically designed to test KamoX's Service Worker capabilities:

1. **Service Worker Logging**: The background script logs extensively to demonstrate KamoX's log collection via CDP
2. **Wake Up Detection**: Responds to KamoX's `KAMOX_WAKE_UP` message to verify the Wake Up button functionality
3. **Alarm API**: Uses `chrome.alarms` to test Service Worker lifecycle (waking up when inactive)
4. **State Persistence**: Uses `chrome.storage` to maintain state across Service Worker restarts

## Usage with KamoX

```bash
# From the kamox root directory
kamox chrome --project-path="./examples/pomodoro-timer"
```

Then open the KamoX dashboard (default: http://localhost:3000) to:
- View Service Worker logs in real-time
- Test the "Wake Up SW" button
- Monitor alarm events and state changes

## Manual Testing

1. Click the extension icon to open the popup
2. Click "Start" to begin a 25-minute Pomodoro session
3. Watch the badge update every minute
4. Check the KamoX dashboard for Service Worker logs
5. Close the popup and verify the timer continues in the background
6. Test the "Wake Up SW" button on the dashboard to wake the Service Worker

## Files

- `manifest.json` - Manifest V3 configuration
- `background.js` - Service Worker with timer logic
- `popup.html` - Timer UI
- `popup.js` - Popup controller
- `icons/` - Extension icons

## License

MIT
