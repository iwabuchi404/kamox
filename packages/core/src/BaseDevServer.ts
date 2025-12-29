import fs from 'fs';
import path from 'path';
import { 
  ServerConfig, 
  ServerState, 
  RebuildResult, 
  UICheckResult, 
  ScriptCheckResult, 
  LogCollection,
  ServerStatus,
  UserAction,
  PlaywrightMouseRequest,
  PlaywrightKeyboardRequest,
  PlaywrightElementRequest,
  PlaywrightWaitRequest,
  PlaywrightReloadRequest,
  PlaywrightActionResult
} from './types/common.js';
import { IDevServer } from './types/plugin.js';
import { Logger } from './utils/logger.js';
import { ScreenshotManager } from './utils/screenshot.js';
import { runBuild } from './utils/rebuild.js';

export abstract class BaseDevServer implements IDevServer {
  protected state: ServerState;
  protected logger: Logger;
  protected screenshotManager: ScreenshotManager;
  protected projectName: string = 'Unknown Project';

  constructor(config: ServerConfig) {
    this.logger = new Logger();
    this.screenshotManager = new ScreenshotManager(process.cwd());
    this.state = {
      isRebuilding: false,
      logs: this.logger.getLogs(),
      config
    };

    // package.jsonからプロジェクト名を取得（デフォルト動作）
    try {
      const packageJsonPath = path.join(config.projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (pkg.name) {
          this.projectName = pkg.name;
        }
      }
    } catch (e) {
      // 無視
    }
  }

  // 抽象メソッド（サブクラスで実装）
  abstract launch(): Promise<void>;
  abstract reload(): Promise<void>;
  abstract checkUI(options?: { url?: string; actions?: UserAction[]; scenario?: string }): Promise<UICheckResult>;
  abstract checkScript(url?: string): Promise<ScriptCheckResult>;
  
  // Playwright API抽象メソッド
  abstract performMouseAction(request: PlaywrightMouseRequest): Promise<PlaywrightActionResult>;
  abstract performKeyboardAction(request: PlaywrightKeyboardRequest): Promise<PlaywrightActionResult>;
  abstract performElementAction(request: PlaywrightElementRequest): Promise<PlaywrightActionResult>;
  abstract performWait(request: PlaywrightWaitRequest): Promise<PlaywrightActionResult>;
  abstract performReload(request: PlaywrightReloadRequest): Promise<PlaywrightActionResult>;
  
  // 共通メソッド
  async rebuild(): Promise<RebuildResult> {
    if (this.state.isRebuilding) {
      throw new Error('Build already in progress');
    }

    this.state.isRebuilding = true;
    this.logger.log('info', 'Starting rebuild...', 'system');

    try {
      const buildCommand = this.state.config.buildCommand || 'npm run build';
      const result = await runBuild(buildCommand, this.state.config.projectPath);
      
      // ログの統合
      result.logs.forEach(log => this.logger.log(log.type, log.content, log.source));

      if (result.success) {
        this.logger.log('info', 'Build successful, reloading environment...', 'system');
        await this.reload();
      } else {
        this.logger.log('error', 'Build failed', 'system');
      }

      return result;
    } finally {
      this.state.isRebuilding = false;
    }
  }

  async takeScreenshot(prefix: string): Promise<string> {
    // 実装はサブクラスのPlaywrightインスタンス等に依存するため、
    // ここではインターフェースのみ提供し、実際のキャプチャはサブクラスから
    // screenshotManagerを呼び出す形になることが多いが、
    // 共通化できる部分はここで行う
    throw new Error('takeScreenshot must be implemented by subclass or called via screenshotManager directly');
  }

  collectLogs(): LogCollection {
    return this.logger.getLogs();
  }

  getStatus(): ServerStatus {
    return {
      serverRunning: true,
      environment: this.state.config.environment,
      isRebuilding: this.state.isRebuilding,
      buildCount: this.getBuildCount(),
      lastBuildTime: this.getLastBuildTime(),
      features: this.getFeatures(),
      projectName: this.projectName
    };
  }

  getEnvironment(): string {
    return this.state.config.environment;
  }

  // サブクラスでオーバーライド可能なヘルパー
  protected getBuildCount(): number {
    return 0; // サブクラスで実装推奨
  }

  protected getLastBuildTime(): string | null {
    return null; // サブクラスで実装推奨
  }

  protected getFeatures() {
    return {
      checkUI: true,
      checkScript: true,
      checkIPC: false,
      checkCommand: false
    };
  }
}
