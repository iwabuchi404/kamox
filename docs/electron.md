# KamoX Electron Adapter

KamoX provide a powerful development and automation server for **Electron applications**. It allows AI agents and developers to live-preview, debug IPC communications, and run automated UI tests across multiple windows.

## Features

- 🚀 **One-command Launch**: Start your Electron app and KamoX server simultaneously.
- 📺 **Multi-Window Support**: Automatically detects and manages all open windows.
- 📡 **IPC Monitoring**: Captures and logs messages between Main and Renderer processes.
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
