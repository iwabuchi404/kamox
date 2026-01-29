import { BaseDevServer } from '@kamox/core/dist/BaseDevServer.js';
import { 
  UICheckResult, 
  ScriptCheckResult, 
  UserAction,
  PlaywrightMouseRequest,
  PlaywrightKeyboardRequest,
  PlaywrightElementRequest,
  PlaywrightWaitRequest,
  PlaywrightReloadRequest,
  PlaywrightActionResult,
  ScenarioExecutionResult,
  ServerStatus,
  LogEntry
} from '@kamox/core/dist/types/common.js';
import { ScenarioLoader } from '@kamox/core/dist/utils/scenarioLoader.js';
import { _electron as electron, ElectronApplication, Page, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';

export class ElectronAdapter extends BaseDevServer {
  private electronApp: ElectronApplication | null = null;
  private buildCount: number = 0;
  private lastBuildTime: string | null = null;
  private pageIds = new WeakMap<Page, string>();
  private scenarioLoader: ScenarioLoader | null = null;

  async launch(): Promise<void> {
    const projectPath = path.resolve(this.state.config.projectPath);
    // 起動ファイルの探索 (デフォルトは main.js)
    const mainFile = this.state.config.entryPoint || 'main.js';
    const mainPath = path.isAbsolute(mainFile) ? mainFile : path.join(projectPath, mainFile);

    if (!fs.existsSync(mainPath)) {
      throw new Error(`Main entry point not found: ${mainPath}`);
    }

    this.logger.log('info', `Launching Electron app with entry: ${mainPath}`, 'system');

    try {
      this.electronApp = await electron.launch({
        args: [mainPath],
        cwd: projectPath
      });
    } catch (e: any) {
      this.logger.log('error', `Failed to launch Electron: ${e.message}`, 'system');
      throw e;
    }

    // ログ収集の設定 (メインプロセス)
    const process = this.electronApp.process();
    process.stdout?.on('data', (data) => {
      this.logger.log('info', data.toString().trim(), 'system');
    });
    process.stderr?.on('data', (data) => {
      // stderr は無条件でエラーとして記録
      const content = data.toString().trim();
      if (content) {
        this.logger.log('error', `[Main Error] ${content}`, 'system');
      }
    });

    // レンダラープロセスのログ収集 (既存の全ウィンドウ + 新規ウィンドウ)
    this.electronApp.windows().forEach(win => this.setupWindowLogging(win));
    this.electronApp.on('window', win => {
      this.logger.log('info', 'New window detected', 'system');
      this.setupWindowLogging(win);
    });

    this.logger.log('info', 'Electron app launched', 'system');
  }

  private setupWindowLogging(window: Page) {
    const pageId = `window_${Date.now()}`;
    this.pageIds.set(window, pageId);
    window.on('console', msg => {
      const type = msg.type();
      // console.error などもそのまま Logger に渡す
      this.logger.log(type as any, msg.text(), pageId);
    });
    window.on('pageerror', err => {
      // 未捕捉例外をエラーとして記録
      this.logger.log('error', `[PageError] ${err.message}`, pageId);
    });
  }

  async reload(): Promise<void> {
    this.logger.log('info', 'Reloading Electron environment...', 'system');
    
    if (this.electronApp) {
      await this.electronApp.close();
    }
    
    await this.launch();
    
    this.buildCount++;
    this.lastBuildTime = new Date().toISOString();
  }

  async checkUI(options?: { url?: string; actions?: UserAction[]; windowIndex?: number; windowTitle?: string; scenario?: string }): Promise<UICheckResult> {
    if (!this.electronApp) {
      throw new Error('Electron app not running');
    }

    this.logger.log('info', 'Checking Electron UI...', 'system');
    
    // シナリオの実行 (指定されている場合)
    if (options?.scenario) {
      await this.executeScenario(options.scenario);
    }

    // ウィンドウの選択
    const window = await this.getWindow(options?.windowIndex, options?.windowTitle);
    const pageId = this.pageIds.get(window) || 'window_default';
    const loadTimeStart = Date.now();

    const errors: string[] = [];

    // スクリーンショット撮影
    const timestamp = new Date().getTime();
    const rootDir = this.state.config.workDir ? path.resolve(this.state.config.workDir) : path.resolve(this.state.config.projectPath);
    const workDir = path.join(rootDir, '.kamox');
    const screenshotsDir = path.join(workDir, 'screenshots');
    
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const screenshotPath = path.join(screenshotsDir, `electron_${timestamp}.png`);
    let screenshotBuffer: Buffer | undefined;

    try {
      screenshotBuffer = await window.screenshot({ path: screenshotPath });
      this.logger.log('info', `Saved electron window screenshot to: ${screenshotPath}`, pageId);
    } catch (e: any) {
      this.logger.log('error', `Failed to take screenshot: ${e.message}`, pageId);
      errors.push(`Screenshot failed: ${e.message}`);
    }

    // DOM 取得
    let dom: any = {};
    try {
      dom = await window.evaluate(() => {
        return {
          title: document.title,
          bodyText: document.body.innerText,
          html: document.documentElement.outerHTML
        };
      });
    } catch (e: any) {
      this.logger.log('error', `Failed to get DOM: ${e.message}`, pageId);
    }

    return {
      loaded: true,
      screenshot: screenshotPath,
      dom,
      logs: this.logger.getLogs().pages[pageId] || [],
      errors,
      performance: {
        loadTime: Date.now() - loadTimeStart
      }
    };
  }

  private async getWindow(index?: number, title?: string): Promise<Page> {
    if (!this.electronApp) throw new Error('App not running');
    
    const windows = this.electronApp.windows();
    if (windows.length === 0) {
      return await this.electronApp.firstWindow();
    }

    if (title) {
      for (const win of windows) {
        const t = await win.title();
        if (t === title) return win;
      }
    }

    if (index !== undefined && windows[index]) {
      return windows[index];
    }

    return windows[0];
  }

  async checkScript(url?: string): Promise<ScriptCheckResult> {
    // Electron では Content Script の概念が拡張機能と異なるため、
    // Phase 1 では未実装とするか、Preload スクリプトの検証などに充てる
    return {
      url: url || 'electron://app',
      injected: false,
      logs: []
    };
  }

  // Playwright API 実装
  async performMouseAction(request: PlaywrightMouseRequest): Promise<PlaywrightActionResult> {
    if (!this.electronApp) return { success: false, error: 'App not running' };
    try {
      const page = await this.getWindow();
      const button = request.button || 'left';
      const clickCount = request.clickCount || 1;

      switch (request.action) {
        case 'click':
          await page.mouse.click(request.x, request.y, { button, clickCount });
          break;
        case 'move':
          await page.mouse.move(request.x, request.y);
          break;
        case 'down':
          await page.mouse.down({ button });
          break;
        case 'up':
          await page.mouse.up({ button });
          break;
        case 'drag':
          if (request.toX === undefined || request.toY === undefined) {
             throw new Error('toX and toY are required for drag');
          }
          await page.mouse.move(request.x, request.y);
          await page.mouse.down({ button });
          await page.mouse.move(request.toX, request.toY);
          await page.mouse.up({ button });
          break;
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async performKeyboardAction(request: PlaywrightKeyboardRequest): Promise<PlaywrightActionResult> {
    if (!this.electronApp) return { success: false, error: 'App not running' };
    try {
      const page = await this.getWindow();
      switch (request.action) {
        case 'type':
          if (!request.text) throw new Error('text is required');
          await page.keyboard.type(request.text);
          break;
        case 'press':
          if (!request.key) throw new Error('key is required');
          await page.keyboard.press(request.key);
          break;
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async performElementAction(request: PlaywrightElementRequest): Promise<PlaywrightActionResult> {
    if (!this.electronApp) return { success: false, error: 'App not running' };
    try {
      const page = await this.getWindow();
      const element = page.locator(request.selector);
      const timeout = request.timeout || 5000;

      switch (request.action) {
        case 'click':
          await element.click({ timeout });
          break;
        case 'fill':
          if (request.value === undefined) throw new Error('value is required');
          await element.fill(request.value, { timeout });
          break;
        case 'select':
          if (request.value === undefined) throw new Error('value is required');
          await element.selectOption(request.value, { timeout });
          break;
        case 'check':
          await element.check({ timeout });
          break;
        case 'uncheck':
          await element.uncheck({ timeout });
          break;
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async performWait(request: PlaywrightWaitRequest): Promise<PlaywrightActionResult> {
    if (!this.electronApp) return { success: false, error: 'App not running' };
    try {
      const page = await this.getWindow();
      switch (request.type) {
        case 'selector':
          if (!request.selector) throw new Error('selector is required');
          await page.waitForSelector(request.selector, { timeout: request.timeout || 5000 });
          break;
        case 'timeout':
          if (request.duration === undefined) throw new Error('duration is required');
          await page.waitForTimeout(request.duration);
          break;
        case 'networkIdle':
          await page.waitForLoadState('networkidle', { timeout: request.timeout || 30000 });
          break;
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async performReload(request: PlaywrightReloadRequest): Promise<PlaywrightActionResult> {
    if (!this.electronApp) return { success: false, error: 'App not running' };
    try {
      const page = await this.getWindow();
      await page.reload({ 
        waitUntil: request.waitUntil || 'load', 
        timeout: request.timeout || 30000 
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  getStatus(): ServerStatus {
    const status = super.getStatus();
    const windows = this.electronApp?.windows() || [];
    
    status.windows = windows.map((win, i) => ({
      index: i,
      title: 'Electron Window' // タイトル取得は非同期なのでここではプレースホルダ
    }));
    
    return status;
  }

  // 非同期でタイトルを含めたステータスを取得するエンドポイント用
  async getStatusAsync(): Promise<ServerStatus> {
    const status = this.getStatus();
    if (this.electronApp) {
      const windows = this.electronApp.windows();
      status.windows = await Promise.all(windows.map(async (win, i) => ({
        index: i,
        title: await win.title() || `Window ${i}`
      })));
    }
    return status;
  }

  protected getBuildCount(): number {
    return this.buildCount;
  }

  protected getLastBuildTime(): string | null {
    return this.lastBuildTime;
  }

  protected getFeatures() {
    return {
      checkUI: true,
      checkScript: true,
      checkIPC: true, // Electron では基本 IPC ログが取れるため true とした
      checkCommand: false
    };
  }

  // Scenario 関連の実装
  getScenarioLoader(): ScenarioLoader {
    if (!this.scenarioLoader) {
      const rootDir = this.state.config.workDir ? path.resolve(this.state.config.workDir) : path.resolve(this.state.config.projectPath);
      this.scenarioLoader = new ScenarioLoader(rootDir, this.logger);
    }
    return this.scenarioLoader;
  }

  async executeScenario(scenarioName: string): Promise<ScenarioExecutionResult> {
    const loader = this.getScenarioLoader();
    const startTime = Date.now();
    const scenarioLogs: LogEntry[] = [];

    try {
      // .scenario.js または .scenario.mjs を探す
      const scenario = await loader.loadScenario(`${scenarioName}.scenario.js`);

      // ログ収集のラップ
      const originalLog = this.logger.log.bind(this.logger);
      const logWrapper = (type: LogEntry['type'], content: string, source: string) => {
        if (source === 'scenario') {
          scenarioLogs.push({
            timestamp: Date.now(),
            type,
            content,
            source
          });
        }
        originalLog(type, content, source);
      };
      this.logger.log = logWrapper as any;

      try {
        if (!this.electronApp) {
          throw new Error('Electron app not running');
        }

        const context = this.electronApp.context();
        
        // シナリオ実行 (Electron では BrowserContext を渡す)
        await scenario.setup(context as unknown as BrowserContext, this.logger);

        // クリーンアップ
        if (scenario.cleanup) {
          await scenario.cleanup(context as unknown as BrowserContext, this.logger);
        }

        return {
          success: true,
          logs: scenarioLogs,
          executionTime: Date.now() - startTime
        };
      } finally {
        this.logger.log = originalLog;
      }
    } catch (error: any) {
      this.logger.log('error', `Scenario failed: ${error.message}`, 'scenario');
      return {
        success: false,
        error: error.message,
        logs: scenarioLogs,
        executionTime: Date.now() - startTime
      };
    }
  }
}
