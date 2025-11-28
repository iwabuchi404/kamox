# KamoX AI Agent Usage Guide

This document describes how AI agents can effectively use the KamoX Dev Server to build, test, and debug Chrome extensions.

## Overview

KamoX provides a RESTful API designed for programmatic interaction. As an AI agent, you can use these endpoints to:
1.  **Check Server Status**: Verify the environment and server health.
2.  **Trigger Rebuilds**: Apply code changes and reload the extension.
3.  **Verify UI**: Take screenshots and inspect the DOM of extension pages (Popup, Options, etc.).
4.  **Verify Scripts**: Check if Content Scripts are correctly injected and functioning.
5.  **Debug**: Retrieve logs and error messages.

## API Endpoints

Base URL: `http://localhost:3000`

### 1. Check Status
**GET** `/status`

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

## Recommended Workflow for AI Agents

1.  **Modify Code**: Edit the extension source files.
2.  **Rebuild**: Call `POST /rebuild`.
    *   If `success: false`, analyze `logs` and fix build errors.
3.  **Verify**:
    *   For Popups: Call `POST /check-ui`. Check `errors` and view `screenshot`.
    *   For Content Scripts: Call `POST /check-script`. Check `injected` status and `logs`.
4.  **Debug**: If issues persist, call `GET /logs` to see detailed browser console output.

## Error Handling

If an API call fails (HTTP 500), the response will contain an `error` field with the message.

```json
{
  "success": false,
  "error": "Build failed"
}
```
