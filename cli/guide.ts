// kamox guide コマンド用ガイドテキスト生成

type GuideMode = 'chrome' | 'electron' | 'vscode' | 'all'

export function generateGuide(mode: GuideMode = 'all'): string {
  const sections: string[] = []

  sections.push(HEADER)
  sections.push(QUICK_START(mode))
  sections.push(COMMON_ENDPOINTS)
  sections.push(PLAYWRIGHT_ENDPOINTS(mode))

  if (mode === 'chrome' || mode === 'all') {
    sections.push(CHROME_ENDPOINTS)
  }

  if (mode === 'electron' || mode === 'all') {
    sections.push(ELECTRON_ENDPOINTS)
  }

  if (mode === 'vscode' || mode === 'all') {
    sections.push(VSCODE_ENDPOINTS)
  }

  sections.push(REQUEST_EXAMPLES(mode))
  sections.push(RESPONSE_FORMAT)
  sections.push(CONFIG_EXAMPLE)

  return sections.join('\n')
}

// ============================================================
// 各セクション定義
// ============================================================

const HEADER = `# KamoX

> AI-powered dev server for Chrome extensions, Electron apps, and VSCode extensions.
> Launch with \`kamox chrome\`, \`kamox electron\`, or \`kamox vscode\`, then control via REST API on http://localhost:<port>.
> Default port: 3000. All endpoints accept/return JSON.
`

function QUICK_START(mode: GuideMode): string {
  if (mode === 'vscode') {
    return `## Quick Start (VSCode)

Typical workflow for AI agents:

1. \`GET  /status\`                    — Confirm server is running
2. \`POST /check-ui\`                  — Take screenshot of VSCode window
3. \`POST /vscode/command\`            — Execute a VSCode command by ID
4. \`GET  /vscode/output\`             — Read Extension Host output channel
5. \`GET  /vscode/notifications\`      — Check for error/info toasts
6. \`GET  /vscode/problems\`           — Check Problems panel (errors/warnings)
7. \`POST /rebuild\`                   — Rebuild extension source
8. \`POST /playwright/reload\`         — Reload VSCode window after rebuild
`
  }

  return `## Quick Start

Typical workflow for AI agents:

1. \`GET  /status\`              — Confirm server is running
2. \`POST /check-ui\`            — Take screenshot + get DOM text
3. \`POST /playwright/element\`  — Interact with UI elements
4. \`GET  /logs\`                — Check for errors
5. \`POST /rebuild\`             — Rebuild / restart the app
`
}

const COMMON_ENDPOINTS = `## Common Endpoints

\`\`\`
GET  /status
  → { projectName, environment, buildCount, lastBuildTime, windows? }

POST /rebuild
  → { success, message }

POST /check-ui
  Body: { url?, actions?, scenario?, windowIndex?, windowTitle? }
  → { loaded, screenshot, dom: { title, bodyText, html }, logs, errors, performance }

POST /check-script
  Body: { url? }
  → { url, injected, screenshot, logs }

GET  /logs
  → { runtime: LogEntry[], pages: { [id]: LogEntry[] } }

POST /logs/clear
  → { success }

GET  /scenarios
  → { scenarios: [{ name, description, tags }] }
  Note: Returns empty array [] when the adapter does not support scenarios (e.g. Electron)

GET  /screenshots/:filename
  → PNG image binary
\`\`\`
`

function PLAYWRIGHT_ENDPOINTS(mode: GuideMode): string {
  const mouseNote = mode === 'vscode'
    ? `  Note: NOT supported in VSCode mode. Use /playwright/element with a CSS selector instead.`
    : `  Body: { action: "click"|"move"|"down"|"up"|"drag", x, y, button?, clickCount?, toX?, toY?, windowIndex?, windowTitle? }\n  → { action, position }`

  return `## Playwright Endpoints

\`\`\`
POST /playwright/mouse
${mouseNote}

POST /playwright/keyboard
  Body: { action: "type"|"press", text?, key?, windowIndex?, windowTitle? }
  → { action, text, key }

POST /playwright/element
  Body: { selector, action, value?, attribute?, timeout?, windowIndex?, windowTitle? }
  Actions (write): "click", "fill", "select", "check", "uncheck"
  Actions (read):  "textContent", "innerHTML", "isVisible", "getAttribute"
  → write: { selector, action }
  → read:  { selector, action, result }

POST /playwright/wait
  Body: { timeout: <ms> }
  → { success }

POST /playwright/reload
  Body: { waitUntil?: "load"|"domcontentloaded"|"networkidle", timeout? }
  → { reloaded, waitUntil }

POST /playwright/evaluate
  Body: { script: string }
  → { success, data: <result> }
\`\`\`
`
}

const CHROME_ENDPOINTS = `## Chrome Extension Endpoints

\`\`\`
POST /playwright/open-popup
  → { success, message }

POST /playwright/wake-up
  → { success, message }

POST /check-popup
  Body: (same as /check-ui)
  → (same as /check-ui)
\`\`\`
`

const ELECTRON_ENDPOINTS = `## Electron Endpoints

### IPC Mock
\`\`\`
POST   /mock-ipc
  Body: { channel: string, response: any }
  → { channel, response }

DELETE /mock-ipc
  Query: ?channel=<name>  (omit to clear all)
  → { cleared: "<name>"|"all" }
\`\`\`

### Dialog Mock
\`\`\`
POST   /mock-dialog
  Body: { method: "showOpenDialog"|"showSaveDialog"|"showMessageBox"|"showMessageBoxSync"|"showErrorBox", response: any }
  → { method, response }

DELETE /mock-dialog
  Query: ?method=<name>  (omit to clear all)
  → { cleared: "<name>"|"all" }
\`\`\`

### Mock Management
\`\`\`
GET    /mocks
  → { ipc: { [channel]: response }, dialog: { [method]: response } }

DELETE /mocks
  → { cleared: "all" }
\`\`\`

### IPC Spy (bidirectional capture)
\`\`\`
POST   /ipc-spy/start
  → { status: "started" }

POST   /ipc-spy/stop
  → { status: "stopped" }

GET    /ipc-spy/status
  → { active: boolean }

GET    /ipc-spy/logs
  Query: ?since=<id>  (exclusive: returns entries with id > since)
  → { logs: [{ id, timestamp, direction, channel, method, args, webContentsId? }], count }
  Note: Omit since to get all logs. Example: ?since=5 returns IDs 6, 7, 8...

DELETE /ipc-spy/logs
  → { cleared: true }
  Note: Resets the ID counter to 0. Reset your local since value to 0 after clearing.
\`\`\`
`

const VSCODE_ENDPOINTS = `## VSCode Extension Endpoints

\`\`\`
POST /vscode/command
  Body: { id: string }
  → {}
  Note: Executes a registered VSCode command by ID (Command Palette equivalent).
        Return values are not retrievable. Verify results via /check-ui or /vscode/notifications.

GET  /vscode/output
  Query: ?channel=<name>
  → { channel, text }

POST /vscode/open
  Body: { path: string }
  → {}

GET  /vscode/notifications
  → { notifications: [{ message, type: "info"|"warning"|"error", actions: string[] }] }

POST /vscode/notifications/dismiss
  Body: { message: string }
  → {}

GET  /vscode/statusbar
  Query: ?pattern=<label>
  → { text: string | null }

POST /vscode/activity-bar
  Body: { label: string }
  Valid: "Explorer", "Search", "Source Control", "Run and Debug", "Extensions", or custom view labels
  → {}

GET  /vscode/tree-view/:viewId
  → { viewId, items: string[] }

POST /vscode/quick-pick
  Body: { label: string }
  → {}

GET  /vscode/problems
  → { markers: [{ message, type, label }] }
\`\`\`
`

function REQUEST_EXAMPLES(mode: GuideMode): string {
  let text = `## Request Examples

### Screenshot + DOM check
\`\`\`
curl -X POST http://localhost:3000/check-ui \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

### Click a button
\`\`\`
curl -X POST http://localhost:3000/playwright/element \\
  -H "Content-Type: application/json" \\
  -d '{"selector": "#submit-btn", "action": "click"}'
\`\`\`

### Fill a form field
\`\`\`
curl -X POST http://localhost:3000/playwright/element \\
  -H "Content-Type: application/json" \\
  -d '{"selector": "input[name=email]", "action": "fill", "value": "test@example.com"}'
\`\`\`
`

  if (mode === 'electron' || mode === 'all') {
    text += `
### Mock an IPC channel (Electron)
\`\`\`
curl -X POST http://localhost:3000/mock-ipc \\
  -H "Content-Type: application/json" \\
  -d '{"channel": "get-config", "response": {"theme": "dark"}}'
\`\`\`

### Start IPC spy and fetch logs (Electron)
\`\`\`
curl -X POST http://localhost:3000/ipc-spy/start
curl http://localhost:3000/ipc-spy/logs
curl http://localhost:3000/ipc-spy/logs?since=5
\`\`\`
`
  }

  if (mode === 'vscode' || mode === 'all') {
    text += `
### Execute a VSCode command (VSCode)
\`\`\`
curl -X POST http://localhost:3000/vscode/command \\
  -H "Content-Type: application/json" \\
  -d '{"id": "workbench.action.files.save"}'
\`\`\`

### Read extension output channel (VSCode)
\`\`\`
curl "http://localhost:3000/vscode/output?channel=My%20Extension"
\`\`\`

### Check for notification toasts (VSCode)
\`\`\`
curl http://localhost:3000/vscode/notifications
\`\`\`

### Get Problems panel diagnostics (VSCode)
\`\`\`
curl http://localhost:3000/vscode/problems
\`\`\`
`
  }

  return text
}

const RESPONSE_FORMAT = `## Response Format

All endpoints return:
\`\`\`json
{
  "success": true,
  "timestamp": "2025-01-01T00:00:00.000Z",
  "environment": "chrome" | "electron" | "vscode",
  "data": { ... },
  "error": "message"  // only on failure
}
\`\`\`
`

const CONFIG_EXAMPLE = `## Configuration

kamox.config.json:
\`\`\`json
{
  "mode": "chrome",
  "port": 3000,
  "output": "./dist",
  "buildCommand": "npm run build",
  "entryPoint": "main.js"
}
\`\`\`

CLI options override config file values.
`
