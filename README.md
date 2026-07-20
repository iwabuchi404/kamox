

[![npm version](https://badge.fury.io/js/kamox.svg)](https://badge.fury.io/js/kamox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# KamoX

**Give your AI coding agent eyes and hands for Chrome Extensions, Electron apps, and VSCode extensions.**

[badges: npm / MIT]  **English** | [日本語](README_ja.md)

## ![KamoX Logo](https://raw.githubusercontent.com/iwabuchi404/kamox/main/images/logo_20251127.png) KamoX - Web Extension Dev Server

## Why KamoX?

AI coding agents (Claude Code, Cursor, Windsurf, Devin) are great at writing
extension code — but they can't easily *see* the result. Plain Playwright
doesn't cover the hard parts:

- **Chrome Extensions (MV3)**: popup/service-worker contexts, extension
  loading, content-script injection — none of it is one command away
- **Electron**: launching the app with the right entry point and reading
  main/renderer logs requires custom glue every time
- **VSCode Extensions**: the Extension Host is effectively a black box

KamoX wraps all of this in a single HTTP API. Your agent starts a server,
then builds, screenshots, clicks, and reads logs — without you copy-pasting
errors into chat.

## Built for agents, not just humans

Run `kamox guide --mode chrome` to print an LLM-optimized API reference
your agent can consume directly. Point your CLAUDE.md / .cursorrules at it
and the agent self-serves.

> **Why HTTP instead of MCP?** Any agent that can run `curl` already has
> everything it needs — no client setup, no config files, works with every
> coding agent today. For a dev server, plain HTTP is the simplest
> integration surface, so KamoX deliberately stays MCP-free.

## Quick Start

```bash
# Start KamoX server (with auto-build enabled)
kamox chrome --auto-build
```

### For Electron Projects

```bash
# Go to your Electron project directory
cd /path/to/electron-app

# Start KamoX server for Electron
kamox electron --entryPoint main.js
```

See [docs/electron.md](docs/electron.md) for details.

### For VSCode Extensions

```bash
# Go to your VSCode extension project directory
cd /path/to/vscode-extension

# Start KamoX server for VSCode
kamox vscode --project-path .
```

See [packages/plugin-vscode/README.md](packages/plugin-vscode/README.md) for details.

> **Note**: If you want to run from source code as a contributor, please refer to [CONTRIBUTING.md](CONTRIBUTING.md).

## Usage

### Basic Commands

```bash
# Show help
kamox --help

# Start Chrome Extension development server
kamox chrome [options]

# Start Electron app development server
kamox electron [options]

# Start VSCode Extension development server
kamox vscode [options]

# Show AI agent API guide
kamox guide --mode chrome|electron|vscode|all
```

### Options

#### Common Options

| Option | Description | Default |
| --- | --- | --- |
| `-p, --port <number>` | Server port number | `3000` |
| `-b, --build-command <cmd>` | Build command | `npm run build` |
| `-c, --config <path>` | Config file path | `kamox.config.json` |
| `--verbose` | Show detailed logs and config | `false` |

#### Chrome-specific Options

| Option | Description | Default |
| --- | --- | --- |
| `-o, --output <path>` | Build output directory | `dist` |
| `--auto-build` | Automatically build if output directory is missing | `false` |

#### Electron-specific Options

| Option | Description | Default |
| --- | --- | --- |
| `--entryPoint <file>` | Electron main script | `main.js` |

#### VSCode-specific Options

| Option | Description | Default |
| --- | --- | --- |
| `--project-path <path>` | Extension project path | `.` |
| `--vscode-path <path>` | Path to VSCode executable | Auto-detect |
| `-w, --workspace <path>` | Workspace folder to open | None |

### Configuration File (kamox.config.json)

Creating a `kamox.config.json` in your project root saves you from specifying options every time.

```json
{
  "mode": "chrome",
  "output": "./dist",
  "buildCommand": "npm run build",
  "port": 3000
}
```

For VSCode extensions:

```json
{
  "mode": "vscode",
  "projectPath": ".",
  "buildCommand": "npm run compile",
  "port": 3000
}
```

## API Endpoints

### Common (All Modes)

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/status` | Check server status |
| POST | `/rebuild` | Rebuild project |
| GET | `/scenarios` | List available test scenarios |
| POST | `/check-ui` | Verify UI / take screenshot |
| POST | `/check-script` | Verify Content Script injection |
| GET | `/logs` | Get logs |
| POST | `/playwright/mouse` | Mouse Action (click, move, drag) |
| POST | `/playwright/keyboard` | Keyboard Action (type, press) |
| POST | `/playwright/element` | Element Action (click, fill, check) |
| POST | `/playwright/wait` | Wait Action (timeout) |
| POST | `/playwright/reload` | Reload Page/Window |
| GET | `/` | Development Dashboard |

### VSCode-specific

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/vscode/command` | Execute a VSCode command by ID |
| GET | `/vscode/output` | Read an Output Channel |
| POST | `/vscode/open` | Open a file in the editor |
| GET | `/vscode/notifications` | Get notification toasts |
| POST | `/vscode/notifications/dismiss` | Dismiss a notification |
| GET | `/vscode/statusbar` | Read a status bar item |
| POST | `/vscode/activity-bar` | Switch Activity Bar view |
| GET | `/vscode/tree-view/:viewId` | List tree view items |
| POST | `/vscode/quick-pick` | Select from a Quick Pick |
| GET | `/vscode/problems` | Get Problems panel markers |

For the full LLM-friendly API reference, run:

```bash
kamox guide --mode vscode
```

### Interactive Testing (Playwright API)

KamoX allows AI agents to interact with the extension using Playwright-compatible APIs.

#### Example: Click a button

```bash
curl -X POST http://localhost:3000/playwright/element \
  -H "Content-Type: application/json" \
  -d '{"selector": "#submit-btn", "action": "click"}'
```

#### Example: Type text

```bash
curl -X POST http://localhost:3000/playwright/keyboard \
  -H "Content-Type: application/json" \
  -d '{"action": "type", "text": "Hello World"}'
```

### Scenario Testing

You can define reusable test scenarios in `.kamox/scenarios/*.scenario.js` to automate complex setup (e.g., opening specific tabs, setting storage) before verifying the UI.

**List Scenarios:**

```bash
curl http://localhost:3000/scenarios
```

**Run Scenario & Check UI:**

```bash
curl -X POST http://localhost:3000/check-ui \
  -H "Content-Type: application/json" \
  -d '{"scenario": "basic-test"}'
```

For full reference on scenario file structure and API, see [**docs/scenarios.md**](docs/scenarios.md).

## Troubleshooting

### "Output directory not found" Error

Occurs when the build output directory (default `dist`) is not found.

**Solution:**

1. Build your project: `npm run build`
2. Or use `--auto-build` option
3. Specify output directory with `--output` option if different

### Extension not loaded

**Solution:**

1. Check if `manifest.json` is included in the output directory
2. Check error logs on the dashboard (`http://localhost:3000`)
3. Run with `--verbose` option to see detailed logs

## License

MIT
