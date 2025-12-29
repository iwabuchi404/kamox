# Debug Scenario Feature Reference

The Debug Scenario Feature allows you to define reusable test scenarios that set up your extension's environment before running UI checks or manual verification. This is particularly useful for testing complex states that are difficult to reproduce manually.

## 1. Scenario File Structure

Scenario files must be placed in the `.kamox/scenarios/` directory in your project root.
Files must have the extension `.scenario.js` or `.scenario.mjs`.

A scenario file is a JavaScript module that exports a default object with the following structure:

```javascript
export default {
  // Metadata
  name: 'my-scenario',           // (Required) Unique identifier for the scenario
  description: 'Description...', // (Optional) Human-readable description
  version: '1.0.0',             // (Optional) Version of the scenario
  
  // Configuration
  requiresPersistentContext: true, // (Optional) If true, uses a persistent browser context (keeps cookies/storage)
                                   // Default: false
  
  requiresServiceWorkerInit: true, // (Optional) If true, ensures Service Worker is active before running
                                   // Default: false
                                   
  warmup: {                        // (Optional) Configuration for warming up pages
    enabled: true,
    parallel: false                // If true, opens tabs in parallel (faster but higher load)
  },

  // Lifecycle Methods
  
  /**
   * Setup function (Required)
   * Executed before the UI check or verification.
   * @param {BrowserContext} context - Playwright BrowserContext instance
   * @param {Logger} logger - Logger instance
   */
  async setup(context, logger) {
    // Write your setup logic here
    logger.log('info', 'Setting up...', 'scenario');
  },

  /**
   * Cleanup function (Optional)
   * Executed after the verification is referenced or manually triggered (not auto-run by check-ui consistently yet).
   */
  async cleanup(context, logger) {
    // Cleanup logic
  }
};
```

## 2. API Reference

### `context` (Playwright BrowserContext)
The `context` object passed to `setup` is a standard [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext). You can use all standard Playwright methods.

**Common Methods:**
- `await context.newPage()`: Open a new tab.
- `await context.cookies()`: Get cookies.
- `await context.addCookies(cookies)`: Set cookies.
- `await context.storageState()`: Get storage state.
- `await context.grantPermissions(permissions)`: Grant permissions origin-wide.

### `logger` (KamoX Logger)
The `logger` object allows you to write logs that will appear in the KamoX Dashboard and API responses.

**Methods:**
- `logger.log(level, message, source)`
  - `level`: `'info'`, `'warn'`, `'error'`, or `'debug'`
  - `message`: String message
  - `source`: String source identifier (usually `'scenario'`)

**Example:**
```javascript
logger.log('info', 'Opening test page...', 'scenario');
```

## 3. Examples

### Basic Example: Open a Tab
```javascript
export default {
  name: 'open-tab',
  description: 'Opens example.com',
  async setup(context, logger) {
    const page = await context.newPage();
    await page.goto('https://example.com');
  }
};
```

### Advanced Example: Service Worker & Storage
```javascript
export default {
  name: 'auth-state',
  description: 'Sets authentication token and wakes up SW',
  requiresPersistentContext: true,
  requiresServiceWorkerInit: true,
  
  async setup(context, logger) {
    // 1. Set LocalStorage (requires opening a page on the origin)
    const page = await context.newPage();
    await page.goto('https://my-extension-origin.com'); 
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'test-token-123');
    });
    
    logger.log('info', 'Auth token set', 'scenario');
  }
};
```

## 4. Usage via HTTP API

### List Scenarios
```bash
curl http://localhost:3000/scenarios
```

### Run Scenario
Execute a scenario as part of a UI Check request.

```bash
curl -X POST http://localhost:3000/check-ui \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "my-scenario",
    "url": "https://google.com"  // Optional: URL to check after scenario
  }'
```
