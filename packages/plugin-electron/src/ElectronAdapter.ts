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
  PlaywrightEvaluateRequest,
  PlaywrightActionResult,
  ScenarioExecutionResult,
  ServerStatus,
  LogEntry
} from '@kamox/core/dist/types/common.js';
import { ScenarioLoader } from '@kamox/core/dist/utils/scenarioLoader.js';
import { _electron as electron, ElectronApplication, Page, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

export class ElectronAdapter extends BaseDevServer {
  private electronApp: ElectronApplication | null = null;
  private buildCount: number = 0;
  private lastBuildTime: string | null = null;
  private pageIds = new WeakMap<Page, string>();
  private scenarioLoader: ScenarioLoader | null = null;

  // モック状態のローカルレジストリ（API レスポンス用）
  private ipcMockRegistry: Record<string, any> = {};
  private dialogMockRegistry: Record<string, any> = {};

  // IPC スパイ状態
  private spyActive: boolean = false;

  // バリデーション用の許可リスト
  private static readonly VALID_DIALOG_METHODS = [
    'showOpenDialog', 'showSaveDialog', 'showMessageBox',
    'showMessageBoxSync', 'showErrorBox'
  ] as const;

  async launch(): Promise<void> {
    const projectPath = path.resolve(this.state.config.projectPath);
    // 起動ファイルの探索 (デフォルトは main.js)
    const mainFile = this.state.config.entryPoint || 'main.js';
    const mainPath = path.isAbsolute(mainFile) ? mainFile : path.join(projectPath, mainFile);

    if (!fs.existsSync(mainPath)) {
      throw new Error(`Main entry point not found: ${mainPath}`);
    }

    this.logger.log('info', `Launching Electron app with entry: ${mainPath}`, 'system');

    // VSCode ターミナル等で ELECTRON_RUN_AS_NODE=1 が設定されていると
    // Electron がブラウザモードで起動せず Node.js モードになる問題を回避
    const launchEnv: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined) {
        launchEnv[key] = value;
      }
    }

    // electron-hook.js を -r フラグでメインプロセスに注入
    // ipcMain.handle と dialog.* をフックし、global.__kamoxMocks を公開する
    const hookPath = path.resolve(__dirname, 'electron-hook.js');
    const hasHook = fs.existsSync(hookPath);
    if (!hasHook) {
      this.logger.log('warn', `Hook script not found at ${hookPath}, launching without mock support`, 'system');
    }

    const launchArgs = hasHook ? ['-r', hookPath, mainPath] : [mainPath];
    if (hasHook) {
      launchEnv.NODE_OPTIONS = `${launchEnv.NODE_OPTIONS || ''} -r "${hookPath}"`.trim();
    }

    // グローバルインストール時、Playwright は require('electron') でバイナリを見つけられない。
    // ユーザーのプロジェクト配下の electron パッケージを起点に解決し、executablePath として渡す。
    let executablePath: string | undefined = (this.state.config as any).electronPath;
    
    if (executablePath) {
      this.logger.log('info', `Using explicit Electron path: ${executablePath}`, 'system');
    } else {
      try {
        const projectRequire = createRequire(path.join(projectPath, 'package.json'));
        executablePath = projectRequire('electron') as string;
        this.logger.log('info', `Electron binary resolved via project require: ${executablePath}`, 'system');
      } catch {
        // フォールバック: node_modules/.bin/electron を直接探す (Windows/Unix 共通の対応)
        const binPath = process.platform === 'win32' 
          ? path.join(projectPath, 'node_modules', '.bin', 'electron.cmd')
          : path.join(projectPath, 'node_modules', '.bin', 'electron');
        
        if (fs.existsSync(binPath)) {
          executablePath = binPath;
          this.logger.log('info', `Electron binary found in .bin: ${executablePath}`, 'system');
        } else {
          this.logger.log('info', 'Electron binary not found in project, falling back to Playwright default resolution', 'system');
        }
      }
    }

    try {
      this.electronApp = await electron.launch({
        args: launchArgs,
        cwd: projectPath,
        env: launchEnv,
        ...(executablePath ? { executablePath } : {})
      });

      // レンダラープロセスにフック存在を示すマーカーを注入 (check-script 用)
      await this.electronApp.context().addInitScript(() => {
        (window as any).__kamoxMocks = true;
      });
    } catch (e: any) {
      this.logger.log('error', `Failed to launch Electron: ${e.message}`, 'system');
      throw e;
    }

    // ログ収集の設定 (メインプロセス)
    const appProcess = this.electronApp.process();
    appProcess.stdout?.on('data', (data) => {
      this.logger.log('info', data.toString().trim(), 'system');
    });
    appProcess.stderr?.on('data', (data) => {
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

    // 再起動でメインプロセスがリセットされるため、ローカルレジストリもクリア
    this.ipcMockRegistry = {};
    this.dialogMockRegistry = {};
    this.spyActive = false;

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

    const allWindows = this.electronApp.windows();
    if (allWindows.length === 0) {
      return await this.electronApp.firstWindow();
    }

    // DevTools ウィンドウを除外（devtools:// URL を持つウィンドウ）
    const appWindows = allWindows.filter(win => {
      const url = win.url();
      return !url.startsWith('devtools://') && !url.startsWith('chrome-devtools://');
    });

    // 表示用インデックスと内部インデックスの不整合を防ぐため、appWindows があればそちらを優先
    // なければ allWindows (すべてのウィンドウ) を対象とする
    const windows = appWindows.length > 0 ? appWindows : allWindows;

    if (title) {
      for (const win of windows) {
        const t = await win.title();
        if (t === title) return win;
      }
      throw new Error(`Window with title "${title}" not found. Available app windows: ${appWindows.length}`);
    }

    if (index !== undefined) {
      if (!windows[index]) {
        throw new Error(`Window index ${index} out of range. ${windows.length} app window(s) available.`);
      }
      return windows[index];
    }

    return windows[0];
  }

  async checkScript(url?: string): Promise<ScriptCheckResult> {
    if (!this.electronApp) {
      return { url: url || 'electron://app', injected: false, logs: [] };
    }
    try {
      const page = await this.getWindow(0);
      const injected = await page.evaluate(() => {
        // メインプロセス側でフックされていても、レンダラーから直接は見えない場合があるため、
        // 開発者が手動で注入したスクリプトやプリロードの状態を確認する。
        // 現状は ElectronAdapter が注入を試みている状態なので、存在を確認。
        return !!((window as any).__kamoxMocks || (globalThis as any).__kamoxMocks);
      });
      return {
        url: url || page.url(),
        injected,
        logs: []
      };
    } catch (e: any) {
      return {
        url: url || 'electron://app', 
        injected: false, 
        logs: [{ timestamp: Date.now(), type: 'error', content: e.message, source: 'system' }]
      };
    }
  }

  // Playwright API 実装
  async performMouseAction(request: PlaywrightMouseRequest): Promise<PlaywrightActionResult> {
    if (!this.electronApp) return { success: false, error: 'App not running' };
    try {
      const page = await this.getWindow(request.windowIndex, request.windowTitle);
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
      return { success: true, data: { action: request.action, position: { x: request.x, y: request.y } } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async performKeyboardAction(request: PlaywrightKeyboardRequest): Promise<PlaywrightActionResult> {
    if (!this.electronApp) return { success: false, error: 'App not running' };
    try {
      const page = await this.getWindow(request.windowIndex, request.windowTitle);
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
      return { success: true, data: { action: request.action, text: request.text, key: request.key } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async performElementAction(request: PlaywrightElementRequest): Promise<PlaywrightActionResult> {
    if (!this.electronApp) return { success: false, error: 'App not running' };
    try {
      const page = await this.getWindow(request.windowIndex, request.windowTitle);
      // BUG-2 対策: 操作前にウィンドウを活性化させ、Playwright の待機タイムアウトを回避
      await page.bringToFront();
      
      const element = page.locator(request.selector);
      const timeout = request.timeout || 5000;

      switch (request.action) {
        // 書き込み系アクション
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
        // 読み取り系アクション
        case 'textContent': {
          const text = await element.textContent({ timeout });
          return { success: true, data: { selector: request.selector, action: request.action, result: text } };
        }
        case 'innerHTML': {
          const html = await element.innerHTML({ timeout });
          return { success: true, data: { selector: request.selector, action: request.action, result: html } };
        }
        case 'isVisible': {
          const visible = await element.isVisible();
          return { success: true, data: { selector: request.selector, action: request.action, result: visible } };
        }
        case 'getAttribute': {
          if (!request.attribute) throw new Error('attribute is required for getAttribute');
          const attr = await element.getAttribute(request.attribute, { timeout });
          return { success: true, data: { selector: request.selector, action: request.action, attribute: request.attribute, result: attr } };
        }
      }
      return { success: true, data: { selector: request.selector, action: request.action } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async performWait(request: PlaywrightWaitRequest): Promise<PlaywrightActionResult> {
    if (!this.electronApp) return { success: false, error: 'App not running' };
    try {
      const page = await this.getWindow(request.windowIndex, request.windowTitle);
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
      return { success: true, data: { type: request.type } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async performReload(request: PlaywrightReloadRequest): Promise<PlaywrightActionResult> {
    if (!this.electronApp) return { success: false, error: 'App not running' };
    try {
      const page = await this.getWindow(request.windowIndex, request.windowTitle);
      await page.reload({
        waitUntil: request.waitUntil || 'load',
        timeout: request.timeout || 30000
      });
      return { success: true, data: { reloaded: true, waitUntil: request.waitUntil || 'load' } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async performEvaluate(request: PlaywrightEvaluateRequest): Promise<PlaywrightActionResult> {
    if (!this.electronApp) return { success: false, error: 'App not running' };
    try {
      const page = await this.getWindow(request.windowIndex, request.windowTitle);
      // BUG-5 対策: 複数行や return の有無に柔軟に対応できるようラッピングを改善
      const result = await page.evaluate(({ script, arg }) => {
        const scriptToExec = script.includes('return') ? script : `return (${script})`;
        const fn = new Function('arg', scriptToExec);
        return fn(arg);
      }, { script: request.script, arg: request.arg });
      return { success: true, data: result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  getStatus(): ServerStatus {
    const status = super.getStatus();
    const allWindows = this.electronApp?.windows() || [];
    // DevTools を除外してアプリウィンドウのみ表示
    const appWindows = allWindows.filter(win => {
      const url = win.url();
      return !url.startsWith('devtools://') && !url.startsWith('chrome-devtools://');
    });
    const windows = appWindows.length > 0 ? appWindows : allWindows;

    status.windows = windows.map((win, i) => ({
      index: i,
      title: 'Electron Window' // タイトル取得は非同期なのでここではプレースホルダ
    }));

    return status;
  }

  // 非同期でタイトルを含めたステータスを取得するエンドポイント用
  async getStatusAsync(): Promise<ServerStatus> {
    const status = super.getStatus();
    if (this.electronApp) {
      const allWindows = this.electronApp.windows();
      // DevTools を除外してアプリウィンドウのみ表示
      const appWindows = allWindows.filter(win => {
        const url = win.url();
        return !url.startsWith('devtools://') && !url.startsWith('chrome-devtools://');
      });
      const windows = appWindows.length > 0 ? appWindows : allWindows;

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

  // ========== IPC モック API ==========

  async setIPCMock(channel: string, response: any): Promise<void> {
    if (!this.electronApp) throw new Error('Electron app not running');
    await this.electronApp.evaluate(
      (_electron, { channel, response }) => {
        const mocks = (globalThis as any).__kamoxMocks;
        if (!mocks) throw new Error('KamoX hook not loaded');
        mocks.setMock(channel, response);
      },
      { channel, response }
    );
    this.ipcMockRegistry[channel] = response;
    this.logger.log('info', `IPC mock set: ${channel}`, 'system');
  }

  async clearIPCMock(channel: string): Promise<void> {
    if (!this.electronApp) throw new Error('Electron app not running');
    await this.electronApp.evaluate(
      (_electron, { channel }) => {
        const mocks = (globalThis as any).__kamoxMocks;
        if (mocks) mocks.clearMock(channel);
      },
      { channel }
    );
    delete this.ipcMockRegistry[channel];
    this.logger.log('info', `IPC mock cleared: ${channel}`, 'system');
  }

  async clearAllIPCMocks(): Promise<void> {
    if (!this.electronApp) throw new Error('Electron app not running');
    await this.electronApp.evaluate(() => {
      const mocks = (globalThis as any).__kamoxMocks;
      if (mocks) mocks.clearAllMocks();
    });
    this.ipcMockRegistry = {};
    this.logger.log('info', 'All IPC mocks cleared', 'system');
  }

  // ========== Dialog モック API ==========

  async setDialogMock(method: string, response: any): Promise<void> {
    if (!this.electronApp) throw new Error('Electron app not running');
    if (!(ElectronAdapter.VALID_DIALOG_METHODS as readonly string[]).includes(method)) {
      throw new Error(`Invalid dialog method: ${method}. Valid: ${ElectronAdapter.VALID_DIALOG_METHODS.join(', ')}`);
    }
    await this.electronApp.evaluate(
      (_electron, { method, response }) => {
        const mocks = (globalThis as any).__kamoxMocks;
        if (!mocks) throw new Error('KamoX hook not loaded');
        mocks.setDialogMock(method, response);
      },
      { method, response }
    );
    this.dialogMockRegistry[method] = response;
    this.logger.log('info', `Dialog mock set: ${method}`, 'system');
  }

  async clearDialogMock(method: string): Promise<void> {
    if (!this.electronApp) throw new Error('Electron app not running');
    await this.electronApp.evaluate(
      (_electron, { method }) => {
        const mocks = (globalThis as any).__kamoxMocks;
        if (mocks) mocks.clearDialogMock(method);
      },
      { method }
    );
    delete this.dialogMockRegistry[method];
    this.logger.log('info', `Dialog mock cleared: ${method}`, 'system');
  }

  async clearAllDialogMocks(): Promise<void> {
    if (!this.electronApp) throw new Error('Electron app not running');
    await this.electronApp.evaluate(() => {
      const mocks = (globalThis as any).__kamoxMocks;
      if (mocks) mocks.clearAllDialogMocks();
    });
    this.dialogMockRegistry = {};
    this.logger.log('info', 'All dialog mocks cleared', 'system');
  }

  // ========== 統合モック API ==========

  getAllMocks(): { ipc: Record<string, any>; dialog: Record<string, any> } {
    return {
      ipc: { ...this.ipcMockRegistry },
      dialog: { ...this.dialogMockRegistry }
    };
  }

  async clearAllMocks(): Promise<void> {
    if (!this.electronApp) throw new Error('Electron app not running');
    await this.electronApp.evaluate(() => {
      const mocks = (globalThis as any).__kamoxMocks;
      if (mocks) mocks.clearAll();
    });
    this.ipcMockRegistry = {};
    this.dialogMockRegistry = {};
    this.logger.log('info', 'All mocks (IPC + dialog) cleared', 'system');
  }

  // ========== IPC スパイ API ==========

  async startIPCSpy(): Promise<void> {
    if (!this.electronApp) throw new Error('Electron app not running');
    await this.electronApp.evaluate(() => {
      const spy = (globalThis as any).__kamoxSpy;
      if (!spy) throw new Error('KamoX hook not loaded');
      spy.start();
    });
    this.spyActive = true;
    this.logger.log('info', 'IPC spy started', 'system');
  }

  async stopIPCSpy(): Promise<void> {
    if (!this.electronApp) throw new Error('Electron app not running');
    await this.electronApp.evaluate(() => {
      const spy = (globalThis as any).__kamoxSpy;
      if (spy) spy.stop();
    });
    this.spyActive = false;
    this.logger.log('info', 'IPC spy stopped', 'system');
  }

  getIPCSpyStatus(): { active: boolean } {
    return { active: this.spyActive };
  }

  async getIPCSpyLogs(sinceId?: number): Promise<any[]> {
    if (!this.electronApp) throw new Error('Electron app not running');
    if (sinceId !== undefined) {
      return await this.electronApp.evaluate(
        (_electron, { sinceId }) => {
          const spy = (globalThis as any).__kamoxSpy;
          if (!spy) return [];
          return spy.getLogsSince(sinceId);
        },
        { sinceId }
      );
    }
    return await this.electronApp.evaluate(() => {
      const spy = (globalThis as any).__kamoxSpy;
      if (!spy) return [];
      return spy.getLogs();
    });
  }

  async clearIPCSpyLogs(): Promise<void> {
    if (!this.electronApp) throw new Error('Electron app not running');
    await this.electronApp.evaluate(() => {
      const spy = (globalThis as any).__kamoxSpy;
      if (spy) spy.clear();
    });
    this.logger.log('info', 'IPC spy logs cleared', 'system');
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
