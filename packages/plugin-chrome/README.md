# @kamox/plugin-chrome

Chrome Extension adapter for KamoX.

This package provides Chrome Extension support for the KamoX development server.

# @kamox/plugin-chrome

Chrome Extension adapter for KamoX.

This package provides Chrome Extension support for the KamoX development server.

## Installation

```bash
npm install @kamox/plugin-chrome
```

## Features

- **Manifest V3 Support**: Full support for building and testing MV3 extensions.
- **Service Worker Debugging**:
  - CDP-based log collection for background workers.
  - "Wake Up" capability for idle workers.
- **Hot Reload**: Automatically reloads the extension when files change.
- **Permission Check**: Validates `manifest.json` permissions.
- **CSP Validation**: Warns about Content Security Policy violations.

## Usage

This is a plugin package used by the KamoX CLI. For end-user documentation, please see the [kamox](https://www.npmjs.com/package/kamox) package.

## Documentation

For full documentation, please visit the [KamoX GitHub repository](https://github.com/iwabuchi404/kamox).

## License

MIT
