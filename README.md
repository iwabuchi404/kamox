# ![KamoX Logo](images/logo_20251127.png) KamoX - Web Extension Dev Server

**English** | [日本語](README_ja.md)

A plugin-based HTTP API server that allows AI coding agents to live-preview and develop Chrome Extensions, Electron apps, and VSCode extensions.

## Features

- **AI-Friendly**: Build, verify UI, and retrieve logs via HTTP API.
- **Plugin Architecture**: Supports Chrome Extensions, Electron, and VSCode extensions (currently Chrome only).
- **Automation**: Automates screenshots, DOM info retrieval, and log collection.
- **Robust Error Detection**: Automatically detects extension load errors and runtime errors, notifying via logs and dashboard.
- **Development Dashboard**: Real-time verification of server status, errors, and logs in the browser.

> [!TIP]
> **For AI Agents**: Please refer to [docs/ai-usage.md](docs/ai-usage.md) for detailed API usage guide.

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
```

Use `kamox detect` command to see recommended settings based on your project structure.

## Dashboard

After starting the KamoX server, access the URL shown in the console (e.g., `http://localhost:3000/`) to see the dashboard with the following features:

- **Status Check**: Check server status and environment info.
- **Error Notification**: Instant check for extension load errors and runtime errors.
- **Log Viewer**: View recent system logs.
- **Rebuild**: Rebuild and reload the extension with one click.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | Check server status |
| POST | `/rebuild` | Rebuild project |
| POST | `/check-ui` | Verify UI (Popup, etc.) |
| POST | `/check-script` | Verify Content Script |
| GET | `/logs` | Get logs |
| GET | `/` | Development Dashboard |

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
