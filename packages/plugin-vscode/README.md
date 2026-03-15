# @kamox/plugin-vscode

VSCode Extension adapter for KamoX using [@vscode/extension-tester](https://github.com/redhat-developer/vscode-extension-tester). This package enables automated testing, live preview, and UI inspection for VSCode extensions within the KamoX ecosystem.

## Installation

This package is usually installed automatically as a dependency of the main `kamox` CLI. If you are building a custom integration:

```bash
npm install @kamox/plugin-vscode
```

## Usage

In your `kamox.config.json`:

```json
{
  "mode": "vscode",
  "projectPath": ".",
  "port": 3000
}
```

Or via CLI:

```bash
kamox vscode --project-path ./my-vscode-extension
```

## Features

- **Automated Launch**: Launches VSCode with your extension loaded in development mode.
- **Screenshot Capture**: Takes full-window screenshots for visual verification via `/check-ui`.
- **Command Execution**: Executes any VSCode command programmatically via `/vscode/command`.
- **Output Channel Logs**: Reads Extension Host output channels via `/vscode/output`.
- **Notifications**: Reads and dismisses notification toasts via `/vscode/notifications`.
- **Status Bar**: Reads status bar item text via `/vscode/statusbar`.
- **Activity Bar**: Switches between views (Explorer, SCM, etc.) via `/vscode/activity-bar`.
- **Tree View**: Lists visible tree view items via `/vscode/tree-view/:viewId`.
- **Problems Panel**: Reads diagnostics (errors/warnings) via `/vscode/problems`.
- **Swappable Driver**: The internal `IVSCodeUIDriver` interface allows replacing extension-tester with a custom implementation.
- **AI Guide**: Run `kamox guide --mode vscode` for a complete API reference.

## VSCode-Specific API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/vscode/command` | Execute a VSCode command by ID |
| GET | `/vscode/output` | Get text from an Output Channel |
| POST | `/vscode/open` | Open a file in the editor |
| GET | `/vscode/notifications` | Get current notification toasts |
| POST | `/vscode/notifications/dismiss` | Dismiss a notification by message |
| GET | `/vscode/statusbar` | Get status bar item text |
| POST | `/vscode/activity-bar` | Click an Activity Bar view |
| GET | `/vscode/tree-view/:viewId` | List visible tree view items |
| POST | `/vscode/quick-pick` | Select an item from a Quick Pick menu |
| GET | `/vscode/problems` | Get all visible Problems panel markers |

## Common Endpoints (Inherited)

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/status` | Server and extension status |
| POST | `/rebuild` | Run the build command |
| POST | `/check-ui` | Take a screenshot |
| GET | `/logs` | Get Extension Host logs |
| POST | `/playwright/keyboard` | Type text |
| POST | `/playwright/element` | Click element by CSS selector |
| POST | `/playwright/wait` | Wait for a duration (ms) |
| POST | `/playwright/reload` | Reload the VSCode window |
| POST | `/playwright/evaluate` | Execute JavaScript in the renderer |

## Configuration Options

| Option | CLI Flag | Description | Default |
| --- | --- | --- | --- |
| `projectPath` | `--project-path` | Path to your extension source | `.` |
| `vscodePath` | `--vscode-path` | Path to VSCode executable | Auto-detect |
| `workspacePath` | `-w, --workspace` | Workspace folder to open | None |
| `buildCommand` | `-b, --build-command` | Build command to run | `npm run build` |
| `port` | `-p, --port` | HTTP server port | `3000` |

## Architecture

This plugin uses `IVSCodeUIDriver` as an abstraction layer over the underlying test driver:

```
VSCodeAdapter (HTTP API logic)
  └── IVSCodeUIDriver (interface)
        └── ExTesterDriver (vscode-extension-tester implementation)
```

To inject a custom driver (e.g., for testing):

```typescript
import { VSCodeAdapter } from '@kamox/plugin-vscode'
import { MyCustomDriver } from './my-driver'

const adapter = new VSCodeAdapter(config, new MyCustomDriver())
```

## Limitations

- **Mouse actions** (`/playwright/mouse`) are not supported. Use `/playwright/element` with a CSS selector instead.
- **Extension Host process** cannot be accessed directly. Commands return after dispatching; return values from `vscode.commands.executeCommand()` are not retrievable.
- **WebView content** inspection is limited (extension-tester iframe restriction).
- **LSP features** (hover info, completion details, raw diagnostics) are not accessible at the protocol level.
