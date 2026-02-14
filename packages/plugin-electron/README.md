# @kamox/plugin-electron

Electron adapter for KamoX using Playwright. This package enables automated testing, live preview, and IPC monitoring for Electron applications within the KamoX ecosystem.

## Installation

This package is usually installed automatically as a dependency of the main `kamox` CLI. If you are building a custom integration:

```bash
npm install @kamox/plugin-electron
```

## Usage

In your `kamox.config.json`:

```json
{
  "mode": "electron",
  "entryPoint": "main.js",
  "port": 3000
}
```

## Features

- **Automated Launch**: Handles Electron process management via Playwright.
- **IPC Insights**: Captures logs from Main and Renderer processes, including IPC communication.
- **IPC / Dialog Mocking**: Mock `ipcMain.handle` responses and native dialogs without modifying app code.
- **IPC Spy**: Bidirectional IPC communication capture (Renderer→Main via `ipcMain.handle`/`on`, Main→Renderer via `webContents.send`).
- **Multi-Window Management**: Seamlessly switch between different app windows for inspection.
- **Element Read Actions**: Read element text, HTML, visibility, and attributes via `/playwright/element`.
- **Window Targeting**: All Playwright endpoints support `windowIndex` / `windowTitle` for multi-window apps.
- **Unified API**: Compatible with standard KamoX Playwright action endpoints.
- **AI Guide**: Run `kamox guide --mode electron` for a complete API reference.

## Mock API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mock-ipc` | Set IPC mock response |
| DELETE | `/mock-ipc?channel=<name>` | Clear IPC mock |
| POST | `/mock-dialog` | Set dialog mock response |
| DELETE | `/mock-dialog?method=<name>` | Clear dialog mock |
| GET | `/mocks` | Get all active mocks |
| DELETE | `/mocks` | Clear all mocks |

## IPC Spy API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ipc-spy/start` | Start capturing IPC messages |
| POST | `/ipc-spy/stop` | Stop capturing |
| GET | `/ipc-spy/status` | Get spy status |
| GET | `/ipc-spy/logs?since=<id>` | Get captured logs (incremental) |
| DELETE | `/ipc-spy/logs` | Clear captured logs |

## Playwright Element Actions

| Action         | Type  | Description          | Extra Params           |
| -------------- | ----- | -------------------- | ---------------------- |
| `click`        | Write | Click element        | -                      |
| `fill`         | Write | Fill input           | `value` (required)     |
| `select`       | Write | Select option        | `value` (required)     |
| `check`        | Write | Check checkbox       | -                      |
| `uncheck`      | Write | Uncheck checkbox     | -                      |
| `textContent`  | Read  | Get element text     | -                      |
| `innerHTML`    | Read  | Get inner HTML       | -                      |
| `isVisible`    | Read  | Check visibility     | -                      |
| `getAttribute` | Read  | Get attribute value  | `attribute` (required) |

For detailed documentation, see the [official Electron guide](https://github.com/iwabuchi404/kamox/blob/main/docs/electron.md).
