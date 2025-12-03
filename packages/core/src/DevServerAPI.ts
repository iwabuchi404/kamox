import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { BaseDevServer } from './BaseDevServer.js';

export class DevServerAPI {
  private app: Application;
  private adapter: BaseDevServer;

  constructor(adapter: BaseDevServer) {
    this.adapter = adapter;
    this.app = express();
    this.app.use(bodyParser.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    // 共通エンドポイント
    this.app.get('/status', async (req: Request, res: Response) => {
      const status = this.adapter.getStatus();
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        environment: this.adapter.getEnvironment(),
        data: status
      });
    });

    this.app.post('/rebuild', async (req: Request, res: Response) => {
      try {
        const result = await this.adapter.rebuild();
        res.json({
          success: result.success,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          data: result
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          error: error.message
        });
      }
    });

    this.app.post('/check-ui', async (req: Request, res: Response) => {
      try {
        const { url, actions } = req.body;
        const result = await this.adapter.checkUI({ url, actions });
        res.json({
          success: true,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          data: result
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          error: error.message
        });
      }
    });

    this.app.post('/check-script', async (req: Request, res: Response) => {
      try {
        const { url } = req.body;
        const result = await this.adapter.checkScript(url);
        res.json({
          success: true,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          data: result
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          error: error.message
        });
      }
    });

    this.app.get('/logs', async (req: Request, res: Response) => {
      const logs = this.adapter.collectLogs();
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        environment: this.adapter.getEnvironment(),
        data: logs
      });
    });

    // Playwright API endpoints
    this.app.post('/playwright/mouse', async (req: Request, res: Response) => {
      try {
        const result = await this.adapter.performMouseAction(req.body);
        res.json({
          success: result.success,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          data: result.data,
          error: result.error
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          error: error.message
        });
      }
    });

    this.app.post('/playwright/keyboard', async (req: Request, res: Response) => {
      try {
        const result = await this.adapter.performKeyboardAction(req.body);
        res.json({
          success: result.success,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          data: result.data,
          error: result.error
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          error: error.message
        });
      }
    });

    this.app.post('/playwright/element', async (req: Request, res: Response) => {
      try {
        const result = await this.adapter.performElementAction(req.body);
        res.json({
          success: result.success,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          data: result.data,
          error: result.error
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          error: error.message
        });
      }
    });

    this.app.post('/playwright/wait', async (req: Request, res: Response) => {
      try {
        const result = await this.adapter.performWait(req.body);
        res.json({
          success: result.success,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          data: result.data,
          error: result.error
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          error: error.message
        });
      }
    });

    this.app.post('/playwright/reload', async (req: Request, res: Response) => {
      try {
        const result = await this.adapter.performReload(req.body);
        res.json({
          success: result.success,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          data: result.data,
          error: result.error
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          error: error.message
        });
      }
    });


    // 環境固有エンドポイントの動的登録
    if ('checkPopup' in this.adapter) {
      this.app.post('/check-popup', async (req: Request, res: Response) => {
        try {
          const result = await (this.adapter as any).checkPopup();
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: result
          });
        } catch (error: any) {
          res.status(500).json({
            success: false,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            error: error.message
          });
        }
      });
    }

    // ロゴ配信
    this.app.get('/logo.png', (req: Request, res: Response) => {
      const logoPath = path.join(__dirname, '../../images/logo_20251127.png');
      if (fs.existsSync(logoPath)) {
        res.sendFile(logoPath);
      } else {
        res.status(404).send('Logo not found');
      }
    });

    // スクリーンショット配信
    this.app.get('/screenshots/:filename', (req: Request, res: Response) => {
      const filename = req.params.filename;
      // セキュリティ対策: ファイル名のみを許可
      if (!/^[a-zA-Z0-9_.-]+\.png$/.test(filename)) {
        res.status(400).send('Invalid filename');
        return;
      }

      // ワークディレクトリの特定（adapterの実装に依存するが、ここでは簡易的に推測）
      // Note: 本来はadapterからパスをもらうべきだが、BaseDevServerにはそのIFがないため
      // 設定ファイル等から推測するか、adapterをキャストして取得する
      let workDir = '';
      if ('state' in this.adapter) {
         const state = (this.adapter as any).state;
         const rootDir = state.config.workDir ? path.resolve(state.config.workDir) : path.resolve(state.config.projectPath);
         workDir = path.join(rootDir, '.kamox');
      }

      if (!workDir) {
        res.status(500).send('Cannot determine work directory');
        return;
      }

      const screenshotPath = path.join(workDir, 'screenshots', filename);
      if (fs.existsSync(screenshotPath)) {
        res.sendFile(screenshotPath);
      } else {
        res.status(404).send('Screenshot not found');
      }
    });

    // Open Popup API
    this.app.post('/playwright/open-popup', async (req: Request, res: Response) => {
      try {
        if ('openPopup' in this.adapter) {
          const result = await (this.adapter as any).openPopup();
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: result
          });
        } else {
          throw new Error('openPopup not supported in this environment');
        }
      } catch (error: any) {
        res.status(500).json({
          success: false,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          error: error.message
        });
      }
    });

    // ダッシュボード（簡易版）
    this.app.get('/', async (req: Request, res: Response) => {
      const status = this.adapter.getStatus();
      const logs = this.adapter.collectLogs();
      const environment = this.adapter.getEnvironment();
      
      // エラーログの抽出
      const systemErrors = logs.runtime.filter((l: any) => l.type === 'error');
      const pageErrors = Object.entries(logs.pages).flatMap(([pageId, pageLogs]) => 
        pageLogs.filter((l: any) => l.type === 'error').map((l: any) => ({ ...l, source: pageId }))
      );
      const allErrors = [...systemErrors, ...pageErrors];
      
      // 直近のシステムログ
      const recentLogs = logs.runtime.slice(-100).reverse();

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KamoX Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; color: #333; }
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
    h1 { margin-top: 0; color: #2c3e50; }
    h2 { margin-top: 0; font-size: 1.2em; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.9em; }
    .status-ok { background: #e6fffa; color: #00b894; }
    .status-error { background: #ffe6e6; color: #d63031; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .info-item { margin-bottom: 10px; }
    .label { font-size: 0.85em; color: #7f8c8d; display: block; margin-bottom: 4px; }
    .value { font-size: 1.1em; font-weight: 500; }
    button { background: #0984e3; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 1em; transition: background 0.2s; }
    button:hover { background: #0074d9; }
    button:disabled { background: #b2bec3; cursor: not-allowed; }
    .log-box { background: #2d3436; color: #dfe6e9; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 0.9em; max-height: 300px; overflow-y: auto; }
    .log-entry { margin-bottom: 4px; border-bottom: 1px solid #444; padding-bottom: 4px; }
    .log-time { color: #636e72; margin-right: 10px; }
    .log-error { color: #ff7675; }
    .log-warn { color: #ffeaa7; }
    .log-info { color: #74b9ff; }
    .error-alert { background: #ffe6e6; border-left: 4px solid #d63031; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
    .error-title { font-weight: bold; color: #d63031; margin-bottom: 5px; }
    .logo { height: 40px; margin-right: 15px; vertical-align: middle; }
    .header-title { display: flex; align-items: center; }
    .header-title h1 { margin: 0; }
    .project-name { font-size: 0.9em; color: #636e72; margin-left: 10px; font-weight: normal; }
    
    .actions { display: flex; gap: 10px; margin: 0 20px; }
    .btn-secondary { background: #636e72; }
    .btn-secondary:hover { background: #2d3436; }
    
    /* Modal */
    .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5); }
    .modal-content { background-color: #fefefe; margin: 5% auto; padding: 20px; border: 1px solid #888; width: 80%; max-width: 800px; border-radius: 8px; position: relative; }
    .close { color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer; }
    .close:hover, .close:focus { color: black; text-decoration: none; cursor: pointer; }
    #checkUiContent img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px; }
    #checkUiContent pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
    <div class="header-title">
      <img src="/logo.png" alt="KamoX Logo" class="logo">
      <div>
        <h1>KamoX Dashboard</h1>
        ${status.projectName ? `<div class="project-name">${status.projectName}</div>` : ''}
      </div>
    </div>
    
    <div class="actions">
      <button onclick="openPopup()" title="Open popup in a new tab">Open Popup</button>
      <button onclick="checkUI()" class="btn-secondary" title="Check UI and show screenshot">Check UI</button>
    </div>

    <div>
      <span class="status-badge ${allErrors.length > 0 ? 'status-error' : 'status-ok'}">
        ${allErrors.length > 0 ? 'Has Errors' : 'System Healthy'}
      </span>
    </div>
  </div>

  ${allErrors.length > 0 ? `
  <div class="error-alert">
    <div class="error-title">⚠️ Errors Detected</div>
    ${allErrors.slice(0, 3).map((e: any) => `<div>${e.content}</div>`).join('')}
    ${allErrors.length > 3 ? `<div style="margin-top:5px; font-size:0.9em;">...and ${allErrors.length - 3} more errors</div>` : ''}
  </div>
  ` : ''}

  <div class="info-grid">
    <div class="card">
      <h2>Server Status</h2>
      <div class="info-item">
        <span class="label">Environment</span>
        <span class="value">${environment}</span>
      </div>
      <div class="info-item">
        <span class="label">Status</span>
        <span class="value" style="color: #00b894">● Running</span>
      </div>
      <div style="margin-top: 20px;">
        <button onclick="rebuild()" id="rebuildBtn">Rebuild & Reload</button>
      </div>
    </div>

    <div class="card">
      <h2>Recent Logs</h2>
      <div class="log-box" id="logBox">
        ${recentLogs.map((log: any) => `
          <div class="log-entry">
            <span class="log-time">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
            <span class="log-${log.type}">${log.content}</span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- Modal for Check UI Result -->
  <div id="checkUiModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal()">&times;</span>
      <h2>UI Check Result</h2>
      <div id="checkUiContent">Loading...</div>
    </div>
  </div>

  <script>
    async function rebuild() {
      const btn = document.getElementById('rebuildBtn');
      btn.disabled = true;
      btn.textContent = 'Rebuilding...';
      
      try {
        const res = await fetch('/rebuild', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          location.reload();
        } else {
          alert('Build failed! Check logs.');
          btn.disabled = false;
          btn.textContent = 'Rebuild & Reload';
        }
      } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.textContent = 'Rebuild & Reload';
      }
    }

    async function openPopup() {
      try {
        const res = await fetch('/playwright/open-popup', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          // alert('Popup opened!');
        } else {
          alert('Failed: ' + data.error);
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }
  
    async function checkUI() {
      document.getElementById('checkUiModal').style.display = 'block';
      document.getElementById('checkUiContent').innerHTML = 'Checking UI... (Taking screenshot)';
      
      try {
        const res = await fetch('/check-ui', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({}) });
        const json = await res.json();
        
        if (json.success) {
          // パスからファイル名を抽出
          const filename = json.data.screenshot.split(/[\\\\/]/).pop();
          const imgUrl = '/screenshots/' + filename;
          
          let content = '<img src="' + imgUrl + '">';
          
          if (json.data.errors && json.data.errors.length > 0) {
             content += '<h3 style="color:#d63031">Errors:</h3><pre>' + JSON.stringify(json.data.errors, null, 2) + '</pre>';
          } else {
             content += '<div style="color:#00b894; font-weight:bold; margin-top:10px;">✓ No errors detected</div>';
          }
          
          document.getElementById('checkUiContent').innerHTML = content;
        } else {
          document.getElementById('checkUiContent').innerText = 'Error: ' + json.error;
        }
      } catch (e) {
        document.getElementById('checkUiContent').innerText = 'Error: ' + e.message;
      }
    }
    
    function closeModal() {
      document.getElementById('checkUiModal').style.display = 'none';
    }

    // Close modal when clicking outside
    window.onclick = function(event) {
      const modal = document.getElementById('checkUiModal');
      if (event.target == modal) {
        modal.style.display = "none";
      }
    }

    // Auto-refresh logs every 5 seconds
    setInterval(async () => {
      try {
        const res = await fetch('/logs');
        const data = await res.json();
        if (data.success) {
          const logs = data.data.runtime.slice(-100).reverse();
          const logBox = document.getElementById('logBox');
          // Only update if content changed (simple check)
          // For now just replace
          logBox.innerHTML = logs.map(log => \`
            <div class="log-entry">
              <span class="log-time">[\${new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span class="log-\${log.type}">\${log.content}</span>
            </div>
          \`).join('');
        }
      } catch (e) {
        console.error('Failed to fetch logs', e);
      }
    }, 5000);
  </script>
</body>
</html>
      `;
      res.send(html);
    });
  }

  start(port: number = 3000) {
    this.app.listen(port, '127.0.0.1', () => {
      console.log(`KamoX running on http://127.0.0.1:${port}`);
      console.log(`Environment: ${this.adapter.getEnvironment()}`);
    });
  }
}
