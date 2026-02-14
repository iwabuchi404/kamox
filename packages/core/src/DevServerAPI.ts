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
      let status;
      if ('getStatusAsync' in this.adapter) {
        status = await (this.adapter as any).getStatusAsync();
      } else {
        status = this.adapter.getStatus();
      }
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
        const { url, actions, scenario, windowIndex, windowTitle } = req.body;
        const result = await this.adapter.checkUI({ url, actions, scenario, windowIndex, windowTitle } as any);
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

    // Scenarios API
    this.app.get('/scenarios', async (req: Request, res: Response) => {
      try {
        // ChromeExtensionAdapterからScenarioLoaderを取得
        if ('getScenarioLoader' in this.adapter) {
          const scenarioLoader = (this.adapter as any).getScenarioLoader();
          if (scenarioLoader) {
            const metadata = await scenarioLoader.listScenariosWithMetadata();
            res.json({
              success: true,
              timestamp: new Date().toISOString(),
              environment: this.adapter.getEnvironment(),
              data: {
                scenarios: metadata
              }
            });
          } else {
            res.json({
              success: true,
              timestamp: new Date().toISOString(),
              environment: this.adapter.getEnvironment(),
              data: {
                scenarios: []
              }
            });
          }
        } else {
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: {
              scenarios: []
            }
          });
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

    this.app.post('/logs/clear', async (req: Request, res: Response) => {
      if ('clearLogs' in this.adapter) {
        (this.adapter as any).clearLogs();
      } else {
        // IDevServer 経由で logger にアクセス
        const logger = (this.adapter as any).logger;
        if (logger) logger.clearLogs();
      }
      res.json({ success: true });
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

    // ========== Mock API エンドポイント (Electron 専用) ==========

    // IPC Mock
    if ('setIPCMock' in this.adapter) {
      this.app.post('/mock-ipc', async (req: Request, res: Response) => {
        try {
          const { channel, response } = req.body;
          if (!channel) {
            res.status(400).json({
              success: false,
              timestamp: new Date().toISOString(),
              environment: this.adapter.getEnvironment(),
              error: 'channel is required'
            });
            return;
          }
          await (this.adapter as any).setIPCMock(channel, response);
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: { channel, response }
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

      this.app.delete('/mock-ipc', async (req: Request, res: Response) => {
        try {
          // クエリパラメータまたは body からチャンネル名を取得
          const channel = (req.query.channel as string) || req.body?.channel;
          if (channel) {
            await (this.adapter as any).clearIPCMock(channel);
          } else {
            await (this.adapter as any).clearAllIPCMocks();
          }
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: { cleared: channel || 'all' }
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

    // Dialog Mock
    if ('setDialogMock' in this.adapter) {
      this.app.post('/mock-dialog', async (req: Request, res: Response) => {
        try {
          const { method, response } = req.body;
          if (!method) {
            res.status(400).json({
              success: false,
              timestamp: new Date().toISOString(),
              environment: this.adapter.getEnvironment(),
              error: 'method is required'
            });
            return;
          }
          await (this.adapter as any).setDialogMock(method, response);
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: { method, response }
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

      this.app.delete('/mock-dialog', async (req: Request, res: Response) => {
        try {
          const method = (req.query.method as string) || req.body?.method;
          if (method) {
            await (this.adapter as any).clearDialogMock(method);
          } else {
            await (this.adapter as any).clearAllDialogMocks();
          }
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: { cleared: method || 'all' }
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

    // 全モック取得/一括クリア
    if ('getAllMocks' in this.adapter) {
      this.app.get('/mocks', async (req: Request, res: Response) => {
        try {
          const mocks = (this.adapter as any).getAllMocks();
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: mocks
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

      this.app.delete('/mocks', async (req: Request, res: Response) => {
        try {
          await (this.adapter as any).clearAllMocks();
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: { cleared: 'all' }
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

    // ========== IPC Spy エンドポイント (Electron 専用) ==========

    if ('startIPCSpy' in this.adapter) {
      this.app.post('/ipc-spy/start', async (req: Request, res: Response) => {
        try {
          await (this.adapter as any).startIPCSpy();
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: { status: 'started' }
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

      this.app.post('/ipc-spy/stop', async (req: Request, res: Response) => {
        try {
          await (this.adapter as any).stopIPCSpy();
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: { status: 'stopped' }
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

      this.app.get('/ipc-spy/status', (req: Request, res: Response) => {
        try {
          const status = (this.adapter as any).getIPCSpyStatus();
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: status
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

      this.app.get('/ipc-spy/logs', async (req: Request, res: Response) => {
        try {
          const sinceId = req.query.since ? parseInt(req.query.since as string, 10) : undefined;
          const logs = await (this.adapter as any).getIPCSpyLogs(sinceId);
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: { logs, count: logs.length }
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

      this.app.delete('/ipc-spy/logs', async (req: Request, res: Response) => {
        try {
          await (this.adapter as any).clearIPCSpyLogs();
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: { cleared: true }
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

    // Wake Up Service Worker API
    this.app.post('/playwright/wake-up', async (req: Request, res: Response) => {
      try {
        if ('wakeUpServiceWorker' in this.adapter) {
          const result = await (this.adapter as any).wakeUpServiceWorker();
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: result
          });
        } else {
          throw new Error('wakeUpServiceWorker not supported in this environment');
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
      let status;
      if ('getStatusAsync' in this.adapter) {
        status = await (this.adapter as any).getStatusAsync();
      } else {
        status = this.adapter.getStatus();
      }
      const logs = this.adapter.collectLogs();
      const environment = this.adapter.getEnvironment();
      const isElectron = environment === 'electron';
      
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
    .info-item { margin-bottom: 15px; }
    .label { font-size: 0.85em; color: #7f8c8d; display: block; margin-bottom: 4px; }
    .value { font-size: 1.1em; font-weight: 500; }
    button { background: #0984e3; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 1em; transition: background 0.2s; }
    button:hover { background: #0074d9; }
    button:disabled { background: #b2bec3; cursor: not-allowed; }
    select { padding: 8px; border-radius: 4px; border: 1px solid #ddd; width: 100%; font-size: 1em; }
    .log-box { background: #2d3436; color: #dfe6e9; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 0.9em; max-height: 400px; overflow-y: auto; }
    .log-entry { margin-bottom: 4px; border-bottom: 1px solid #444; padding-bottom: 4px; display: flex; align-items: flex-start; }
    .log-time { color: #636e72; margin-right: 10px; white-space: nowrap; }
    .log-source { color: #81ecec; margin-right: 10px; font-weight: bold; min-width: 80px; }
    .log-content { word-break: break-all; }
    .log-error { color: #ff7675; }
    .log-warn { color: #ffeaa7; }
    .log-info { color: #74b9ff; }
    .log-ipc { border-left: 3px solid #fdcb6e; padding-left: 8px; background: rgba(253, 203, 110, 0.1); }
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
      ${!isElectron ? `<button onclick="openPopup()" title="Open popup in a new tab">Open Popup</button>` : ''}
      <button onclick="checkUI()" class="btn-secondary" title="Check UI and show screenshot">Check UI</button>
      ${!isElectron ? `<button onclick="wakeUpSW()" class="btn-secondary" title="Wake up Service Worker">Wake Up SW</button>` : ''}
      ${isElectron ? `<button onclick="rebuild()" class="btn-secondary" title="Restart Application">Restart App</button>` : ''}
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
      ${isElectron ? `
      <div class="info-item">
        <span class="label">Target Window</span>
        <select id="windowSelector" onchange="window.selectedWindow = this.value">
          ${status.windows?.map((w: any) => `<option value="${w.index}">${w.title}</option>`).join('') || '<option value="0">Default Window</option>'}
        </select>
      </div>
      ` : ''}
      <div style="margin-top: 20px;">
        <button onclick="rebuild()" id="rebuildBtn">${isElectron ? 'Restart Application' : 'Rebuild & Reload'}</button>
      </div>
    </div>
 
    <div class="card">
      <h2>Activity Logs</h2>
      <div style="margin-bottom: 10px; display: flex; gap: 10px; align-items: center;">
        <input type="checkbox" id="ipcOnly" onchange="window.ipcOnly = this.checked; renderLogs()">
        <label for="ipcOnly" style="font-size: 0.9em;">IPC Only</label>
        <button onclick="clearLogs()" style="padding: 4px 8px; font-size: 0.8em; background: #636e72;">Clear</button>
      </div>
      <div class="log-box" id="logBox">
        <!-- Logs will be rendered by JS -->
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
    window.selectedWindow = 0;
    window.ipcOnly = false;
    window.allLogs = { runtime: [], pages: {} };

    function renderLogs() {
      const logBox = document.getElementById('logBox');
      let logs = [...window.allLogs.runtime];
      
      // 合併全てのページのログ
      Object.entries(window.allLogs.pages).forEach(([source, pageLogs]) => {
        pageLogs.forEach(l => logs.push({ ...l, source }));
      });

      // タイムスタンプでソート
      logs.sort((a, b) => b.timestamp - a.timestamp);

      if (window.ipcOnly) {
        logs = logs.filter(l => l.content.includes('[IPC]') || l.content.includes('[Main]'));
      }

      logBox.innerHTML = logs.slice(0, 200).map(log => {
        const isIPC = log.content.includes('[IPC]') || log.content.includes('[Main]');
        return \`
          <div class="log-entry \${isIPC ? 'log-ipc' : ''}">
            <span class="log-time">[\${new Date(log.timestamp).toLocaleTimeString()}]</span>
            <span class="log-source">\${log.source || 'system'}</span>
            <span class="log-content log-\${log.type}">\${log.content}</span>
          </div>
        \`;
      }).join('');
    }

    async function clearLogs() {
      await fetch('/logs/clear', { method: 'POST' });
      window.allLogs = { runtime: [], pages: {} };
      renderLogs();
    }

    async function rebuild() {
      const btn = document.getElementById('rebuildBtn');
      btn.disabled = true;
      btn.textContent = '\${isElectron ? 'Restarting...' : 'Rebuilding...'}';
      
      try {
        const res = await fetch('/rebuild', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          location.reload();
        } else {
          alert('Failed! Check logs.');
          btn.disabled = false;
          btn.textContent = '\${isElectron ? 'Restart App' : 'Rebuild & Reload'}';
        }
      } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.textContent = '\${isElectron ? 'Restart App' : 'Rebuild & Reload'}';
      }
    }
 
    async function openPopup() {
      try {
        const res = await fetch('/playwright/open-popup', { method: 'POST' });
        const data = await res.json();
        if (!data.success) alert('Failed: ' + data.error);
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }
 
    async function wakeUpSW() {
      const btn = event.target;
      const originalText = btn.innerText;
      btn.innerText = 'Waking up...';
      btn.disabled = true;
      
      try {
        const res = await fetch('/playwright/wake-up', { method: 'POST' });
        const data = await res.json();
        if (!data.success) alert('Failed: ' + (data.error || data.data?.message));
      } catch (e) {
        alert('Error: ' + e.message);
      }
      
      btn.innerText = originalText;
      btn.disabled = false;
    }
  
    async function checkUI() {
      document.getElementById('checkUiModal').style.display = 'block';
      document.getElementById('checkUiContent').innerHTML = 'Checking UI... (Taking screenshot)';
      
      try {
        const res = await fetch('/check-ui', { 
          method: 'POST', 
          headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({ windowIndex: parseInt(window.selectedWindow) }) 
        });
        const json = await res.json();
        
        if (json.success) {
          const filename = json.data.screenshot.split(/[\\\\/]/).pop();
          const imgUrl = '/screenshots/' + filename;
          
          let content = '<div style="margin-bottom: 10px; font-weight: bold;">' + json.data.dom.title + '</div>';
          content += '<img src="' + imgUrl + '">';
          
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
 
    window.onclick = function(event) {
      const modal = document.getElementById('checkUiModal');
      if (event.target == modal) modal.style.display = "none";
    }
 
    // Auto-refresh logs and status
    async function update() {
      try {
        const [logRes, statusRes] = await Promise.all([
          fetch('/logs'),
          fetch('/status')
        ]);
        
        const logData = await logRes.json();
        if (logData.success) {
          window.allLogs = logData.data;
          renderLogs();
        }

        const statusData = await statusRes.json();
        if (statusData.success && statusData.data.windows) {
          const selector = document.getElementById('windowSelector');
          if (selector) {
            const currentVal = selector.value;
            selector.innerHTML = statusData.data.windows.map(w => \`
              <option value="\${w.index}" \${w.index == currentVal ? 'selected' : ''}>\${w.title}</option>
            \`).join('');
          }
        }
      } catch (e) {
        console.error('Update failed', e);
      }
    }

    setInterval(update, 3000);
    update();
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
