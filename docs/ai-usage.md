# KamoX AI Agent Usage Guide

This document describes how AI agents can effectively use the KamoX Dev Server to build, test, and debug Chrome extensions.

## Overview

KamoX provides a RESTful API designed for programmatic interaction. As an AI agent, you can use these endpoints to:
Use this to confirm the server is running and check the current environment.

**Response:**
```json
{
  "success": true,
  "data": {
    "serverRunning": true,
    "environment": "chrome",
    "isRebuilding": false,
    "projectName": "my-extension",
    "features": { ... }
  }
}
```

### 2. Rebuild & Reload
**POST** `/rebuild`

Call this after you have modified the source code. It triggers the build command (e.g., `npm run build`) and reloads the extension in the browser.

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "logs": [ ... ] // Build logs
  }
}
```
*Check `data.success` to see if the build passed.*

### 3. Verify Popup UI
**POST** `/check-ui`

Use this to verify that the popup renders correctly.

**Body:**
```json
{
  "url": "https://example.com" // Optional: Open this page before opening popup
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "loaded": true,
    "screenshot": "/path/to/screenshot.png", // Absolute path
    "dom": {
      "title": "Popup Title",
      "bodyText": "...",
      "elementCounts": { ... }
    },
    "errors": [] // Array of console errors found in popup
  }
}
```
*Action: Read the `screenshot` file to visually verify the UI. Check `errors` for any runtime issues.*

### 4. Verify Content Script
**POST** `/check-script`

Use this to verify that your content script is injected into a target page.

**Body:**
```json
{
  "url": "https://example.com" // Target URL to test
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "injected": true, // Heuristic check (e.g., DOM modification)
    "screenshot": "/path/to/screenshot.png",
    "logs": [ ... ] // Console logs from the page
  }
}
```

### 5. Get Logs
**GET** `/logs`

Retrieve system logs, build logs, and runtime logs from the browser.

**Response:**
```json
{
  "success": true,
  "data": {
    "build": [ ... ],
    "runtime": [ ... ], // System & Browser runtime logs
    "pages": { ... } // Logs grouped by page ID
  }
}
```

### 6. Playwright API (Interactive Testing)

Use these endpoints to perform interactive actions like clicking, typing, and waiting.

#### Mouse Action
**POST** `/playwright/mouse`

```json
{
  "action": "click", // click, move, down, up, drag
  "x": 100,
  "y": 200,
  "button": "left", // optional
  "clickCount": 1   // optional
}
```

#### Keyboard Action
**POST** `/playwright/keyboard`

```json
{
  "action": "type", // type, press
  "text": "Hello",  // for type
  "key": "Enter"    // for press
}
```

#### Element Action
**POST** `/playwright/element`

```json
{
  "selector": "#submit-btn",
  "action": "click", // click, fill, select, check, uncheck
  "value": "text"    // for fill/select
}
```

#### Wait Action
**POST** `/playwright/wait`

```json
{
  "success": false,
  "error": "Build failed"
}
```

### 7. Scenario Testing

KamoX supports "Scenarios" to verify extensions in specific states. This is useful for testing features that require complex setup (e.g., specific tabs open, storage values set).

#### List Available Scenarios
**GET** `/scenarios`

**Response:**
```json
{
  "success": true,
  "data": {
    "scenarios": [
      {
        "name": "basic-test",
        "description": "Opens example.com",
        "version": "1.0.0",
        "requiresPersistentContext": true
      }
    ]
  }
}
```

#### Execute Scenario & Check UI
**POST** `/check-ui`

Execute a scenario before taking the screenshot.

**Body:**
```json
{
  "scenario": "basic-test"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "loaded": true,
    "screenshot": "...",
    "scenario": {
      "name": "basic-test",
      "logs": [
        { "timestamp": 1234567890, "type": "info", "content": "Scenario setup started", "source": "scenario" }
      ],
      "executionTime": 1234
    }
  }
}
```
*Action: Check `data.scenario.logs` to verify the setup process.*

#### Creating a Scenario
Create a file in `.kamox/scenarios/your-scenario.scenario.js`:

```javascript
export default {
  name: "my-scenario",
  description: "Sets up 3 tabs",
  
  async setup(context, logger) {
    logger.log('info', 'Setting up...', 'scenario');
    
    const page = await context.newPage();
    await page.goto('https://example.com');
    
    logger.log('info', 'Setup complete', 'scenario');
  }
};
```

#### Further Reading
For a comprehensive reference on all available options, API methods, and advanced examples, please refer to the [**Scenario Feature Reference**](../docs/scenarios.md).

---

## VSCode Extension Mode

Start the server:

```bash
kamox vscode --project-path ./my-vscode-extension
```

### VSCode Workflow for AI Agents

```
1. GET  /status                    — Confirm extension is running
2. POST /check-ui                  — Take screenshot of VSCode window
3. POST /vscode/command            — Execute a VSCode command
4. GET  /vscode/output             — Read Extension Host output
5. GET  /vscode/notifications      — Check for error/info toasts
6. GET  /vscode/problems           — Check Problems panel (errors/warnings)
7. POST /rebuild                   — Rebuild extension source
8. POST /playwright/reload         — Reload VSCode window after rebuild
```

### VSCode-specific Endpoints

#### Execute a VSCode Command
**POST** `/vscode/command`

Execute any registered VSCode command by its ID. Equivalent to running a command from the Command Palette.

**Body:**
```json
{ "id": "workbench.action.files.save" }
```

**Response:**
```json
{
  "success": true,
  "timestamp": "...",
  "environment": "vscode",
  "data": {}
}
```

*Note: Command return values are not retrievable. Use `/check-ui` or `/vscode/notifications` to verify the result visually.*

#### Read Output Channel
**GET** `/vscode/output?channel=<name>`

Reads the full text of a named Output Channel (e.g., your extension's log channel).

**Response:**
```json
{
  "success": true,
  "data": { "channel": "My Extension", "text": "[INFO] Extension activated\n..." }
}
```

*Action: Search the `text` field for errors or activation confirmation.*

#### Get Notifications
**GET** `/vscode/notifications`

Returns current notification toasts (info, warning, error banners).

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      { "message": "Extension activated successfully", "type": "info", "actions": [] },
      { "message": "Failed to connect", "type": "error", "actions": ["Retry", "Cancel"] }
    ]
  }
}
```

#### Dismiss a Notification
**POST** `/vscode/notifications/dismiss`

**Body:**
```json
{ "message": "Failed to connect" }
```

#### Get Status Bar Item
**GET** `/vscode/statusbar?pattern=<label>`

Returns the text of a status bar item matching the label pattern.

**Response:**
```json
{
  "success": true,
  "data": { "text": "⚡ My Extension: Ready" }
}
```

#### Switch Activity Bar View
**POST** `/vscode/activity-bar`

**Body:**
```json
{ "label": "Explorer" }
```

Valid labels: `"Explorer"`, `"Search"`, `"Source Control"`, `"Run and Debug"`, `"Extensions"`, or any custom view your extension contributes.

#### List Tree View Items
**GET** `/vscode/tree-view/:viewId`

Lists the visible items in a side panel tree view section.

**Response:**
```json
{
  "success": true,
  "data": { "viewId": "myExtension.treeView", "items": ["Item A", "Item B", "Item C"] }
}
```

#### Quick Pick Selection
**POST** `/vscode/quick-pick`

**Body:**
```json
{ "label": "My Extension: Run Task" }
```

#### Get Problems Panel
**GET** `/vscode/problems`

Returns all visible diagnostics from the Problems panel.

**Response:**
```json
{
  "success": true,
  "data": {
    "markers": [
      { "message": "Cannot find module './missing'", "type": "error", "label": "src/index.ts" }
    ]
  }
}
```

### Take a Screenshot
**POST** `/check-ui`

Takes a full screenshot of the VSCode window. Use this to visually confirm UI state after any operation.

**Response:**
```json
{
  "success": true,
  "data": {
    "loaded": true,
    "screenshot": "/absolute/path/to/screenshot.png",
    "logs": [],
    "errors": []
  }
}
```

*Action: Read the `screenshot` file to visually inspect the VSCode window.*

### Known Limitations

- **`/playwright/mouse`** is not supported in VSCode mode. Use `/playwright/element` with a CSS selector.
- **Command return values** cannot be retrieved. Verify results via screenshot or notifications.
- **Extension Host logs** are accessible via `/vscode/output` (Output Channel), not via `/logs` directly.
- **WebView panel content** inspection is limited due to iframe isolation.
