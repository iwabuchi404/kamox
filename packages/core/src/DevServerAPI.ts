import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
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
  }

  start(port: number = 3000) {
    this.app.listen(port, '127.0.0.1', () => {
      console.log(`KamoX running on http://127.0.0.1:${port}`);
      console.log(`Environment: ${this.adapter.getEnvironment()}`);
    });
  }
}
