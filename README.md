# ![KamoX Logo](https://raw.githubusercontent.com/iwabuchi404/kamox/main/images/logo_20251127.png) KamoX - Web Extension Dev Server

[![npm version](https://badge.fury.io/js/kamox.svg)](https://badge.fury.io/js/kamox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**English** | [日本語](README_ja.md)

**KamoX** is a plugin-based HTTP API server designed for **AI Coding Agents** (like Windsurf, Cursor, Devin) to live-preview, debug, and develop **Chrome Extensions** (Manifest V3), Electron apps, and VSCode extensions.

It bridges the gap between AI agents and local development environments by providing a structured API for building, verifying UI, and retrieving logs.

## Features

- **🤖 AI-First Design**: Built for AI agents to interact via HTTP API (build, verify, log).
- **🔌 Plugin Architecture**: Modular support for Chrome Extensions, Electron, and VSCode extensions (currently Chrome only).
- **⚡ Automated Verification**: Automates screenshots, DOM inspection, and console log collection using **Playwright**.
- **🛡️ Robust Error Detection**: Automatically detects extension load errors, runtime errors, and CSP violations.
- **📊 Live Dashboard**: Real-time browser-based dashboard for monitoring server status and logs.

> [!TIP]
> **For AI Agents**: Please refer to [docs/ai-usage.md](https://github.com/iwabuchi404/kamox/blob/main/docs/ai-usage.md) for the detailed API usage guide.

## Installation

```bash
npm install -g kamox
```

## Quick Start

### For Chrome Extension Projects

```bash
# Go to your extension project directory
cd /path/to/your-extension

# Auto-detect project configuration (Recommended)
kamox detect

# Start KamoX server (with auto-build enabled)
kamox chrome --auto-build
```

> **Note**: If you want to run from source code as a contributor, please refer to [CONTRIBUTING.md](CONTRIBUTING.md).

## Usage

### Basic Commands

```bash
# Show help
kamox --help

# Start Chrome Extension development server
kamox chrome [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <number>` | Server port number | `3000` |
| `-o, --output <path>` | Build output directory | `dist` |
| `-b, --build-command <cmd>` | Build command | `npm run build` |
| `-c, --config <path>` | Config file path | `kamox.config.json` |
| `--verbose` | Show detailed logs and config | `false` |
| `--auto-build` | Automatically build if output directory is missing | `false` |

### Configuration File (kamox.config.json)

Creating a `kamox.config.json` in your project root saves you from specifying options every time.

```json
{
  "mode": "chrome",
  "output": "./dist",
  "buildCommand": "npm run build",
  "port": 3000
}
| GET | `/status` | Check server status |
| POST | `/rebuild` | Rebuild project |
| POST | `/check-ui` | Verify UI (Popup, etc.) |
| POST | `/check-script` | Verify Content Script |
| GET | `/logs` | Get logs |
| POST | `/playwright/mouse` | Mouse Action (click, move, drag) |
| POST | `/playwright/keyboard` | Keyboard Action (type, press) |
| POST | `/playwright/element` | Element Action (click, fill, check) |
| POST | `/playwright/wait` | Wait Action (selector, timeout) |
| POST | `/playwright/reload` | Reload Page |
| GET | `/` | Development Dashboard |

### Interactive Testing (Playwright API)

KamoX allows AI agents to interact with the extension using Playwright-compatible APIs.

**Example: Click a button**
```bash
curl -X POST http://localhost:3000/playwright/element \
  -H "Content-Type: application/json" \
  -d '{"selector": "#submit-btn", "action": "click"}'
```

**Example: Type text**
```bash
curl -X POST http://localhost:3000/playwright/keyboard \
  -H "Content-Type: application/json" \
  -d '{"action": "type", "text": "Hello World"}'
```

For more details, see [docs/ai-usage.md](docs/ai-usage.md).


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
