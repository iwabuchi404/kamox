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
```
