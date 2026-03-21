# @kamox/plugin-vscode

VSCode Extension adapter for KamoX using [Playwright](https://playwright.dev/). This package enables automated testing, live preview, and UI inspection for VSCode extensions within the KamoX ecosystem.

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

## How It Works

KamoX launches VSCode as an Electron app using Playwright's `_electron.launch()` API with `--extensionDevelopmentPath` pointing to your extension source. This approach:

- **Does not require ChromeDriver** — avoids remote debugging port issues
- **Isolated user profile** — each session uses a unique `--user-data-dir` to prevent mutex conflicts with any running VSCode instance
- **Extension loaded immediately** — `--extensionDevelopmentPath` is a native VSCode feature; no manual installation or junction setup needed

## Features

- **Automated Launch**: Launches VSCode with your extension loaded in development mode (`[Extension Development Host]` title bar).
- **Screenshot Capture**: Takes full-window screenshots for visual verification via `/check-ui`.
- **Command Execution**: Executes any VSCode command programmatically via `/vscode/command`.
- **File Open**: Opens files in the editor via `/vscode/open`.
- **Keyboard & Element Control**: Type text, press keys, and click elements via `/playwright/keyboard` and `/playwright/element`.
- **Output Channel Logs**: Reads Extension Host output channels via `/vscode/output`.
- **Notifications**: Reads and dismisses notification toasts via `/vscode/notifications`.
- **Status Bar**: Reads status bar item text via `/vscode/statusbar`.
- **Activity Bar**: Switches between views (Explorer, SCM, etc.) via `/vscode/activity-bar`.
- **Tree View**: Lists visible tree view items via `/vscode/tree-view/:viewId`.
- **Problems Panel**: Reads diagnostics (errors/warnings) via `/vscode/problems`.
- **Swappable Driver**: The internal `IVSCodeUIDriver` interface allows replacing the Playwright driver with a custom implementation.

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
| POST | `/playwright/keyboard` | Type text or press a key |
| POST | `/playwright/element` | Click element by CSS selector |
| POST | `/playwright/wait` | Wait for a duration (ms) |
| POST | `/playwright/reload` | Reload the VSCode window |
| POST | `/playwright/evaluate` | Execute JavaScript in the renderer |

### `/playwright/keyboard` — Request Body

```json
{ "action": "type", "text": "hello" }
{ "action": "press", "key": "Enter" }
{ "action": "press", "key": "Control+Shift+P" }
{ "action": "press", "key": "ArrowDown" }
```

## Configuration Options

| Option | CLI Flag | Description | Default |
| --- | --- | --- | --- |
| `projectPath` | `--project-path` | Path to your extension source | `.` |
| `vscodePath` | `--vscode-path` | Path to VSCode executable | Auto-detect |
| `workspacePath` | `-w, --workspace` | Workspace folder to open | None |
| `buildCommand` | `-b, --build-command` | Build command to run | `npm run build` |
| `port` | `-p, --port` | HTTP server port | `3000` |

### VSCode Binary Detection Order

1. `--vscode-path` CLI flag / `vscodePath` config option
2. ExTester cached VSCode at `%TEMP%/test-resources/VSCode-win32-x64-archive/Code.exe`
3. User's installed VSCode at `%LOCALAPPDATA%/Programs/Microsoft VS Code/Code.exe`

## Architecture

This plugin uses `IVSCodeUIDriver` as an abstraction layer over the underlying driver:

```
VSCodeAdapter (HTTP API logic)
  └── IVSCodeUIDriver (interface)
        └── PlaywrightVSCodeDriver (Playwright _electron.launch() implementation)
              └── ExTesterDriver (legacy, kept for reference)
```

To inject a custom driver (e.g., for testing):

```typescript
import { VSCodeAdapter } from '@kamox/plugin-vscode'
import { MyCustomDriver } from './my-driver'

const adapter = new VSCodeAdapter(config, new MyCustomDriver())
```

## Extension Loading Notes

### activationEvents

VSCode 1.74+ changed the meaning of `"activationEvents": []`:

- `[]` — VSCode infers activation from `contributes` (e.g., activates only when a contributed command is invoked)
- `["*"]` — Eager activation at startup (not recommended for production but useful for testing)

For extensions with `onLanguage:xxx` activation events, the extension activates only when a file of that language type is opened. If VSCode assigns a different language (e.g., `.wire.md` shown as `Markdown`), use the language picker to manually set the language and trigger activation.

### Language File Associations

Extensions that contribute custom languages (e.g., `"extensions": [".wire.md"]`) register their associations automatically when loaded via `--extensionDevelopmentPath`. However, VSCode's built-in language detection may assign `.md` files to Markdown first. To change the language mode:

```
POST /vscode/command {"id":"workbench.action.editor.changeLanguageMode"}
POST /playwright/keyboard {"action":"type","text":"YourLanguageName"}
POST /playwright/keyboard {"action":"press","key":"ArrowDown"}
POST /playwright/keyboard {"action":"press","key":"Enter"}
```

## Limitations

- **Mouse actions** (`/playwright/mouse`) are not supported. Use `/playwright/element` with a CSS selector instead.
- **Extension Host process** cannot be accessed directly. Commands return after dispatching; return values from `vscode.commands.executeCommand()` are not retrievable via the API.
- **WebView content** inspection is limited (Playwright iframe restrictions in Electron).
- **LSP features** (hover info, completion details, raw diagnostics) are not accessible at the protocol level.
