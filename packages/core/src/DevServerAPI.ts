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
        const { url } = req.body;
        const result = await this.adapter.checkUI({ url });
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
      const logoPath = path.join('D:\\work\\kamox\\images\\logo_20251127.png');
      if (fs.existsSync(logoPath)) {
        res.sendFile(logoPath);
      } else {
        res.status(404).send('Logo not found');
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
    <div>
      <span class="status-badge ${allErrors.length > 0 ? 'status-error' : 'status-ok'}">
        ${allErrors.length > 0 ? 'Has Errors' : 'System Healthy'}
      </span>
    </div>
  </div>

  ${allErrors.length > 0 ? `
    <div class="error-alert">
      <div class="error-title">⚠️ ${allErrors.length} Errors Detected</div>
      <ul style="margin: 0; padding-left: 20px;">
        ${allErrors.map(e => `<li>[${e.source}] ${e.content}</li>`).join('')}
      </ul>
    </div>
  ` : ''}

  <div class="card">
    <h2>Server Status</h2>
    <div class="info-grid">
      <div class="info-item">
        <span class="label">Environment</span>
        <span class="value">${environment}</span>
      </div>
      <div class="info-item">
        <span class="label">Build Count</span>
        <span class="value">${status.buildCount}</span>
      </div>
      <div class="info-item">
        <span class="label">Last Build</span>
        <span class="value">${status.lastBuildTime ? new Date(status.lastBuildTime).toLocaleTimeString() : '-'}</span>
      </div>
      <div class="info-item">
        <span class="label">Status</span>
        <span class="value">${status.isRebuilding ? 'Rebuilding...' : 'Running'}</span>
      </div>
    </div>
    <div style="margin-top: 20px;">
      <button id="rebuildBtn" onclick="triggerRebuild()">🔄 Rebuild & Reload</button>
    </div>
  </div>

  <div class="card">
    <h2>Recent System Logs</h2>
    <div class="log-box">
      ${recentLogs.map(log => `
        <div class="log-entry log-${log.type}">
          <span class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
          <span class="log-content">${log.content}</span>
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    async function triggerRebuild() {
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
          btn.textContent = 'Rebuild Failed';
        }
      } catch (e) {
        alert('Error: ' + e.message);
        btn.textContent = 'Error';
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          if (btn.textContent !== 'Rebuild & Reload') {
             btn.textContent = '🔄 Rebuild & Reload';
          }
        }, 2000);
      }
    }
    
    // Auto refresh status every 5 seconds
    setInterval(() => {
      if (!document.hidden) {
        // location.reload(); // シンプルにするため自動リロードは一旦なし（ログが流れるので）
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
