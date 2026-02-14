# KamoX Electron Adapter

KamoX provide a powerful development and automation server for **Electron applications**. It allows AI agents and developers to live-preview, debug IPC communications, and run automated UI tests across multiple windows.

## Features

- 🚀 **One-command Launch**: Start your Electron app and KamoX server simultaneously.
- 📺 **Multi-Window Support**: Automatically detects and manages all open windows.
- 📡 **IPC Monitoring**: Captures and logs messages between Main and Renderer processes.
- 🎭 **IPC / Dialog Mocking**: Mock `ipcMain.handle` responses and native dialogs (`showOpenDialog`, etc.) without modifying your app code.
- 🔍 **IPC Spy**: Bidirectional IPC communication capture (Renderer→Main and Main→Renderer) with filtering and incremental retrieval.
- 🖱️ **Playwright Integration**: Full control over windows using Playwright APIs (Click, Type, etc.).
- 🛠️ **Unified Logging**: Consolidates `stdout/stderr` from the Main process and `console` logs from all Renderers.
- 🧪 **Scenario Testing**: Define automated setup flows to test complex application states.

## Setup

### 1. Install KamoX

```bash
npm install -g kamox
```

### 2. Configure Your Project

Create a `kamox.config.json` in your Electron project root:

```json
{
  "mode": "electron",
  "entryPoint": "main.js",
  "port": 3000
}
```

- `mode`: Set to `"electron"`.
- `entryPoint`: Relative path to your Main process entry file (e.g., `main.js`, `dist/main.js`).

### 3. Run KamoX

```bash
kamox electron
```

Or using auto-build if you have a build step:

```bash
kamox electron --buildCommand "npm run build" --auto-build
```

## Usage

### Development Dashboard

Once KamoX is running, visit `http://localhost:3000` to access the dashboard.
- **Restart App**: Instantly kill and relaunch the entire application.
- **Window Selector**: Choose which window to inspect or take screenshots of.
- **IPC Filtering**: Use the "IPC Only" checkbox to focus on inter-process communications.

### Automation API

AI agents can interact with your Electron app via HTTP API.

**Example: Fill a login form**
```bash
curl -X POST http://localhost:3000/playwright/element \
  -H "Content-Type: application/json" \
  -d '{
    "selector": "#username",
    "action": "fill",
    "value": "developer"
  }'
```

**Example: Check UI of a specific window**
```bash
curl -X POST http://localhost:3000/check-ui \
  -H "Content-Type: application/json" \
  -d '{
    "windowIndex": 1
  }'
```

## IPC / Dialog Mocking

KamoX can mock IPC responses and native dialogs without modifying your application code. The mock system uses Electron's `-r` (require) flag to inject hooks into the main process.

### IPC Mock

```bash
# Set a mock response for an IPC channel
curl -X POST http://localhost:3000/mock-ipc \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "get-user-data",
    "response": { "name": "Test User", "id": 1 }
  }'

# Get all active mocks
curl http://localhost:3000/mocks

# Clear a specific IPC mock
curl -X DELETE "http://localhost:3000/mock-ipc?channel=get-user-data"

# Clear all mocks
curl -X DELETE http://localhost:3000/mocks
```

### Dialog Mock

Supported methods: `showOpenDialog`, `showSaveDialog`, `showMessageBox`, `showMessageBoxSync`, `showErrorBox`

```bash
# Mock a file open dialog
curl -X POST http://localhost:3000/mock-dialog \
  -H "Content-Type: application/json" \
  -d '{
    "method": "showOpenDialog",
    "response": { "canceled": false, "filePaths": ["/tmp/test.txt"] }
  }'

# Clear a specific dialog mock
curl -X DELETE "http://localhost:3000/mock-dialog?method=showOpenDialog"
```

## IPC Spy (Communication Monitor)

The IPC Spy captures bidirectional IPC communication in real-time:
- **Renderer → Main**: `ipcMain.handle` (invoke) and `ipcMain.on` (send) calls
- **Main → Renderer**: `webContents.send` calls

### Usage

```bash
# Start capturing IPC messages
curl -X POST http://localhost:3000/ipc-spy/start

# Check spy status
curl http://localhost:3000/ipc-spy/status

# Get all captured logs
curl http://localhost:3000/ipc-spy/logs

# Get only new logs since a specific ID (incremental retrieval)
curl "http://localhost:3000/ipc-spy/logs?since=5"

# Stop capturing
curl -X POST http://localhost:3000/ipc-spy/stop

# Clear captured logs
curl -X DELETE http://localhost:3000/ipc-spy/logs
```

### Log Entry Format

```json
{
  "id": 1,
  "timestamp": 1707800000000,
  "direction": "renderer-to-main",
  "channel": "submit-form",
  "method": "on",
  "args": [{ "username": "test" }],
  "webContentsId": 1
}
```

- `direction`: `"renderer-to-main"` or `"main-to-renderer"`
- `method`: `"invoke"` (handle/invoke pattern), `"on"` (send/on pattern), or `"send"` (webContents.send)
- `webContentsId`: Only present for Main→Renderer messages, identifies the target window
- Logs are stored in a circular buffer (max 1000 entries)

## Scenario Testing

Define scenarios in `.kamox/scenarios/my-scenario.scenario.js`:

```javascript
export default {
  name: 'login-flow',
  setup: async (context, logger) => {
    const [page] = context.pages();
    await page.fill('#user', 'test-user');
    await page.click('#login-btn');
    logger.log('info', 'Login scenario completed', 'scenario');
  }
};
```

Run via API:
```bash
curl -X POST http://localhost:3000/check-ui \
  -H "Content-Type: application/json" \
  -d '{"scenario": "my-scenario"}'
```

## Troubleshooting

### Error: Main entry point not found
Ensure the `entryPoint` in your config correctly points to the JS file that Electron should execute.

### Blank Screenshots
If your app uses `nodeIntegration: false` and `contextIsolation: true` (Electron defaults), KamoX still captures screenshots, but ensure your windows are actually rendered and not hidden.
