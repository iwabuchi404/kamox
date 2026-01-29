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
- **Multi-Window Management**: Seamlessly switch between different app windows for inspection.
- **Unified API**: Compatible with standard KamoX Playwright action endpoints.

For detailed documentation, see the [official Electron guide](https://github.com/iwabuchi404/kamox/blob/main/docs/electron.md).
