import { validateUrl } from '@kamox/core/dist/utils/security.js';
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
  LogEntry
} from '@kamox/core/dist/types/common.js';
import { ScenarioLoader, Scenario } from '@kamox/core/dist/utils/scenarioLoader.js';
import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { 
  generateDevManifest, 
  generateDevBackground, 
  copyProjectFiles, 
  updateGitignore, 
  cleanupDevDirectory 
} from './utils/devManifest.js';

export class ChromeExtensionAdapter extends BaseDevServer {
  private context: BrowserContext | null = null;
  private extensionId: string | null = null;
  private buildCount: number = 0;
  private lastBuildTime: string | null = null;
  private sharedContext: BrowserContext | null = null;
  private scenarioLoader: ScenarioLoader | null = null;

  async launch(): Promise<void> {
    const originalProjectPath = path.resolve(this.state.config.projectPath);
    // workDirが設定されている場合はそれを使用、そうでない場合はprojectPathの親ディレクトリを推測
    // シナリオファイルは元のプロジェクトディレクトリに配置されるため
    const rootDir = this.state.config.workDir 
      ? path.resolve(this.state.config.workDir) 
      : path.dirname(originalProjectPath); // distディレクトリの親（プロジェクトルート）
    const workDir = path.join(rootDir, '.kamox');
    const devDir = path.join(workDir, 'build');
    
    // Ensure .kamox directory exists
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    const screenshotsDir = path.join(workDir, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    // 既存の開発用ビルドディレクトリをクリーンアップ
    cleanupDevDirectory(devDir);
    
    // プロジェクトファイルを.kamox/buildにコピー
    this.logger.log('info', 'Preparing development extension in .kamox/build...', 'system');
    copyProjectFiles(originalProjectPath, devDir);
    
    // 開発用manifest.jsonを生成
    const originalManifestPath = path.join(originalProjectPath, 'manifest.json');
    
    // manifest.jsonからプロジェクト名を取得して上書き
    try {
      if (fs.existsSync(originalManifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(originalManifestPath, 'utf8'));
        if (manifest.name) {
          this.projectName = manifest.name;
        }
      }
    } catch (e) {
      this.logger.log('warn', `Failed to read manifest name: ${e}`, 'system');
    }

    const devManifestPath = path.join(devDir, 'manifest.json');
    this.logger.log('info', 'Generating development manifest.json...', 'system');
    generateDevManifest(originalManifestPath, devManifestPath, {
      addPermissions: ['tabs', 'activeTab'],
      relaxCSP: true,
      addDevPrefix: true
    });
    
    // 開発用background.jsを生成
    const devBackgroundPath = path.join(devDir, '_kamox_background.js');
    this.logger.log('info', 'Generating development background worker...', 'system');
    generateDevBackground(devBackgroundPath);
    
    // .gitignoreを更新
    updateGitignore(originalProjectPath);
    
    // ユーザーデータディレクトリを明示的に指定（ログ取得のため）
    const userDataDir = path.join(os.tmpdir(), `kamox_profile_${Date.now()}`);
    
    this.logger.log('info', `Launching Chrome with extension at: ${devDir}`, 'system');
    this.logger.log('info', `User data directory: ${userDataDir}`, 'system');

    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 800, height: 600 }, // Chrome拡張機能Popupの最大サイズに合わせる
      args: [
        `--disable-extensions-except=${devDir}`,
        `--load-extension=${devDir}`,
        '--enable-logging',
        '--v=1'
      ]
    });

    // Service Workerの監視とCDPアタッチ
    this.context.on('serviceworker', async worker => {
      this.logger.log('info', `Service Worker detected: ${worker.url()}`, 'system');
      
      if (!this.extensionId) {
        const url = worker.url();
        if (url.startsWith('chrome-extension://')) {
          this.extensionId = url.split('/')[2];
          this.logger.log('info', `Extension ID detected: ${this.extensionId}`, 'system');
        }
      }
      
      // Service WorkerのCDPセッションをアタッチ
      await this.attachToServiceWorker(worker.url());
    });

    // 既存のService Workerを確認してアタッチ
    const workers = this.context.serviceWorkers();
    if (workers.length > 0) {
      const url = workers[0].url();
      if (url.startsWith('chrome-extension://')) {
        this.extensionId = url.split('/')[2];
        this.logger.log('info', `Extension ID detected (existing): ${this.extensionId}`, 'system');
      }
      
      // 既存のService WorkerにもCDPアタッチ
      for (const worker of workers) {
        await this.attachToServiceWorker(worker.url());
      }
    } else {
      // 少し待ってみる
      try {
        const worker = await this.context.waitForEvent('serviceworker', { timeout: 5000 });
        const url = worker.url();
        if (url.startsWith('chrome-extension://')) {
          this.extensionId = url.split('/')[2];
          this.logger.log('info', `Extension ID detected (event): ${this.extensionId}`, 'system');
        }
      } catch (e) {
        this.logger.log('warn', 'No Service Worker detected within timeout', 'system');
        
        // chrome_debug.logからエラーを確認
        try {
          const logPath = path.join(userDataDir, 'chrome_debug.log');
          this.logger.log('info', `Checking for log file at: ${logPath}`, 'system');
          
          if (fs.existsSync(logPath)) {
            // Windowsでのファイルロック回避のため、一時ファイルにコピーしてから読み込む
            const tempLogPath = path.join(os.tmpdir(), `kamox_debug_copy_${Date.now()}.log`);
            fs.copyFileSync(logPath, tempLogPath);
            
            const logContent = fs.readFileSync(tempLogPath, 'utf8');
            fs.unlinkSync(tempLogPath); // コピーを削除
            
            // エラーに関連しそうな行を抽出
            const errorLines = logContent.split('\n')
              .filter(line => line.includes('error') || line.includes('Error') || line.includes('Manifest') || line.includes('Extension'))
              .slice(-20); // 最後の20行のみ
            
            if (errorLines.length > 0) {
              this.logger.log('error', 'Possible extension load errors found in chrome_debug.log:', 'system');
              errorLines.forEach(line => this.logger.log('error', line.trim(), 'system'));
            } else {
              this.logger.log('info', 'No obvious errors found in chrome_debug.log', 'system');
            }
          } else {
            this.logger.log('warn', `Log file not found at: ${logPath}`, 'system');
          }
        } catch (err: any) {
          this.logger.log('error', `Failed to read chrome_debug.log: ${err.message}`, 'system');
        }

        // chrome://extensionsページも念のため確認
        try {
          const page = await this.context.newPage();
          await page.goto('chrome://extensions');
          
          // 開発者モードを有効化
          await page.waitForTimeout(1000);
          
          // デバッグ用：スクリーンショットを保存
          const timestamp = new Date().getTime();
          const rootDir = this.state.config.workDir ? path.resolve(this.state.config.workDir) : path.resolve(this.state.config.projectPath);
          const workDir = path.join(rootDir, '.kamox');
          const screenshotsDir = path.join(workDir, 'screenshots');
          const screenshotPath = path.join(screenshotsDir, `extensions_page_${timestamp}.png`);
          await page.screenshot({ path: screenshotPath });
          this.logger.log('info', `Saved extensions page screenshot to: ${screenshotPath}`, 'system');

          // chrome.management APIを使って拡張機能リストを取得
          try {
            const extensions = await page.evaluate(async () => {
              // @ts-ignore
              if (chrome && chrome.management && chrome.management.getAll) {
                // @ts-ignore
                return new Promise(resolve => chrome.management.getAll(resolve));
              }
              return null;
            });
            if (extensions) {
              this.logger.log('info', `Installed extensions (via API): ${JSON.stringify(extensions)}`, 'system');
            }
          } catch (err) {
            this.logger.log('warn', `Failed to get extensions via API: ${err}`, 'system');
          }
          
          await page.close();
        } catch (err: any) {
          this.logger.log('error', `Failed to check chrome://extensions: ${err.message}`, 'system');
        }
      }
    }
    
    // ScenarioLoaderを初期化（既存のrootDirを使用）
    this.scenarioLoader = new ScenarioLoader(rootDir, this.logger);
  }

  private async attachToServiceWorker(workerUrl: string): Promise<void> {
    try {
      this.logger.log('info', `Attempting to attach CDP to Service Worker: ${workerUrl}`, 'system');
      
      // Get a page to create a CDP session from
      const pages = this.context!.pages();
      const page = pages.length > 0 ? pages[0] : await this.context!.newPage();
      
      // Create a CDP session from the page
      const client = await this.context!.newCDPSession(page);
      
      // Get all targets
      const targets = await client.send('Target.getTargets');
      
      // Find the Service Worker target
      const swTarget = targets.targetInfos.find((t: any) => 
        t.type === 'service_worker' && t.url === workerUrl
      );
      
      if (!swTarget) {
        this.logger.log('warn', `Service Worker target not found for: ${workerUrl}`, 'system');
        return;
      }
      
      this.logger.log('info', `Found Service Worker target: ${swTarget.targetId}`, 'system');
      
      // Attach to the Service Worker target
      const { sessionId } = await client.send('Target.attachToTarget', {
        targetId: swTarget.targetId,
        flatten: false  // Must be false to use sendMessageToTarget
      });
      
      this.logger.log('info', `Attached to Service Worker session: ${sessionId}`, 'system');
      
      // Enable Runtime domain for this session using sendMessageToTarget
      await client.send('Target.sendMessageToTarget', {
        sessionId,
        message: JSON.stringify({ id: 1, method: 'Runtime.enable' })
      });
      
      // Listen for messages from the target
      client.on('Target.receivedMessageFromTarget', (params: any) => {
        if (params.sessionId !== sessionId) return;
        
        try {
          const message = JSON.parse(params.message);
          
          // Handle console API calls
          if (message.method === 'Runtime.consoleAPICalled') {
            const consoleParams = message.params;
            const type = consoleParams.type === 'warning' ? 'warn' : consoleParams.type === 'error' ? 'error' : 'info';
            const args = consoleParams.args?.map((arg: any) => {
              if (arg.value !== undefined) return String(arg.value);
              if (arg.description) return arg.description;
              return JSON.stringify(arg);
            }).join(' ') || '';
            
            this.logger.log(type, `[SW] ${args}`, 'worker');
          }
          
          // Handle exceptions
          if (message.method === 'Runtime.exceptionThrown') {
            const exceptionParams = message.params;
            const desc = exceptionParams.exceptionDetails?.exception?.description || 
                        exceptionParams.exceptionDetails?.text || 'Unknown error';
            this.logger.log('error', `[SW Exception] ${desc}`, 'worker');
          }
        } catch (e) {
          // Ignore parse errors
        }
      });
      
      this.logger.log('info', 'Service Worker log monitoring enabled via CDP', 'system');
      
    } catch (e: any) {
      this.logger.log('warn', `Failed to attach to Service Worker: ${e.message}`, 'system');
    }
  }

  async reload(): Promise<void> {
    this.logger.log('info', 'Reloading Chrome environment...', 'system');
    
    if (this.context) {
      await this.context.close();
    }
    
    await this.launch();
    
    this.buildCount++;
    this.lastBuildTime = new Date().toISOString();
    
    // ScenarioLoaderを初期化
    const rootDir = this.state.config.workDir ? path.resolve(this.state.config.workDir) : path.resolve(this.state.config.projectPath);
    this.scenarioLoader = new ScenarioLoader(rootDir, this.logger);
  }

  async checkUI(options?: { url?: string; actions?: UserAction[]; scenario?: string }): Promise<UICheckResult> {
    return this.checkPopup(options?.url, options?.actions, options?.scenario);
  }

  async checkPopup(targetUrl?: string, actions?: UserAction[], scenarioName?: string): Promise<UICheckResult> {
    if (!this.context || !this.extensionId) {
      throw new Error('Extension not loaded');
    }

    if (targetUrl && targetUrl !== 'debug:tab_mixer') {
      try {
        validateUrl(targetUrl);
      } catch (e: any) {
        throw new Error(`Invalid target URL: ${e.message}`);
      }
    }

    this.logger.log('info', 'Checking Popup UI...', 'system');
    
    // シナリオが指定されている場合、先に実行
    let scenarioResult: ScenarioExecutionResult | null = null;
    if (scenarioName) {
      try {
        scenarioResult = await this.executeScenario(scenarioName);
        if (!scenarioResult || !scenarioResult.success) {
          throw new Error(`Scenario execution failed: ${scenarioResult?.error || 'Unknown error'}`);
        }
      } catch (error: any) {
        this.logger.log('error', `Scenario execution error: ${error.message}`, 'scenario');
        throw error;
      }
    }
    
    // ターゲットURLが指定されている場合、先にそのページを開く
    let targetPage: Page | null = null;
    
    // Tab Mixerデバッグ用ロジック（後方互換性のため残すが、シナリオ機能に移行推奨）
    if (targetUrl === 'debug:tab_mixer') {
      this.logger.log('info', 'Starting Tab Mixer debug scenario...', 'system');
      
      // 複数のタブを開く
      await this.context.newPage().then(p => p.goto('https://example.com'));
      await this.context.newPage().then(p => p.goto('https://google.com'));
      // await this.context.newPage().then(p => p.goto('https://github.com')); // 時間短縮のため2つで
      
      // 少し待機してタブ情報を更新させる
      await new Promise(r => setTimeout(r, 2000));
    } else if (targetUrl) {
      this.logger.log('info', `Opening target page: ${targetUrl}`, 'system');
      targetPage = await this.context.newPage();
      await targetPage.goto(targetUrl);
      await targetPage.waitForLoadState('domcontentloaded');
    }

    const pageId = `popup_${Date.now()}`;
    const popup = await this.context.newPage();
    
    // ログ収集
    popup.on('console', msg => {
      this.logger.log(msg.type() as any, msg.text(), pageId);
    });

    const errors: string[] = [];
    popup.on('pageerror', err => {
      errors.push(err.message);
      this.logger.log('error', err.message, pageId);
    });

    // Popupを開く
    const popupUrl = `chrome-extension://${this.extensionId}/popup.html`;
    await popup.goto(popupUrl);
    await popup.waitForLoadState('domcontentloaded');
    
    const loadTimeStart = Date.now();

    // アクション実行
    if (actions && actions.length > 0) {
      this.logger.log('info', `Executing ${actions.length} actions...`, pageId);
      for (const action of actions) {
        try {
          switch (action.type) {
            case 'click':
              if (action.selector) {
                this.logger.log('info', `Action: Click ${action.selector}`, pageId);
                await popup.click(action.selector);
              }
              break;
            case 'type':
              if (action.selector && action.text) {
                this.logger.log('info', `Action: Type "${action.text}" into ${action.selector}`, pageId);
                await popup.fill(action.selector, action.text);
              }
              break;
            case 'wait':
              if (action.ms) {
                this.logger.log('info', `Action: Wait ${action.ms}ms`, pageId);
                await popup.waitForTimeout(action.ms);
              }
              break;
            case 'drag':
              if (action.source && action.target) {
                this.logger.log('info', `Action: Drag ${action.source} to ${action.target}`, pageId);
                
                try {
                  const sourceElement = await popup.waitForSelector(action.source, { timeout: 2000 });
                  const targetElement = await popup.waitForSelector(action.target, { timeout: 2000 });
                  
                  if (sourceElement && targetElement) {
                    const sourceBox = await sourceElement.boundingBox();
                    const targetBox = await targetElement.boundingBox();
                    
                    if (sourceBox && targetBox) {
                      // ドラッグ開始位置（中心）
                      const startX = sourceBox.x + sourceBox.width / 2;
                      const startY = sourceBox.y + sourceBox.height / 2;
                      
                      // ドロップ位置（中心）
                      const endX = targetBox.x + targetBox.width / 2;
                      const endY = targetBox.y + targetBox.height / 2;
                      
                      await popup.mouse.move(startX, startY);
                      await popup.mouse.down();
                      
                      // dnd-kitのactivationConstraint(8px)を超えるために少し動かす
                      await popup.mouse.move(startX + 10, startY + 10, { steps: 5 });
                      await popup.waitForTimeout(200); // ドラッグ開始を待つ
                      
                      // ターゲットへ移動
                      await popup.mouse.move(endX, endY, { steps: 20 });
                      await popup.waitForTimeout(200); // ドロップ判定を待つ
                      
                      await popup.mouse.up();
                    }
                  }
                } catch (e: any) {
                  this.logger.log('warn', `Drag failed: ${e.message}`, pageId);
                  // フォールバックとして通常のdragAndDropを試す
                  await popup.dragAndDrop(action.source, action.target);
                }
              }
              break;
            case 'scroll':
              if (action.x !== undefined && action.y !== undefined) {
                 this.logger.log('info', `Action: Scroll to ${action.x}, ${action.y}`, pageId);
                 await popup.evaluate(({x, y}) => window.scrollTo(x, y), {x: action.x, y: action.y});
              }
              break;
          }
        } catch (e: any) {
          this.logger.log('error', `Action failed: ${e.message}`, pageId);
          errors.push(`Action failed: ${e.message}`);
        }
      }
    } else {
      // デフォルト動作（ボタンクリック）
      try {
        const button = await popup.$('#getInfo');
        if (button) {
          this.logger.log('info', 'Clicking #getInfo button...', pageId);
          await button.click();
          
          // 結果が表示されるのを待つ
          await popup.waitForFunction(() => {
            const result = document.getElementById('result');
            return result && result.textContent !== 'Ready' && result.textContent !== 'Loading...';
          }, null, { timeout: 5000 }).catch(() => {
            this.logger.log('warn', 'Timeout waiting for result update', pageId);
          });
        }
      } catch (e: any) {
        this.logger.log('error', `Interaction failed: ${e.message}`, pageId);
        errors.push(`Interaction failed: ${e.message}`);
      }
    }
    
    // スクリーンショット
    const timestamp = new Date().getTime();
    const rootDir = this.state.config.workDir ? path.resolve(this.state.config.workDir) : path.resolve(this.state.config.projectPath);
    const workDir = path.join(rootDir, '.kamox');
    const screenshotsDir = path.join(workDir, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotsDir, `popup_${timestamp}.png`);
    let screenshotBuffer: Buffer | undefined;
    
    try {
      screenshotBuffer = await popup.screenshot({ path: screenshotPath, fullPage: true });
      this.logger.log('info', `Saved popup screenshot to: ${screenshotPath}`, pageId);
    } catch (e: any) {
      this.logger.log('error', `Failed to take screenshot: ${e.message}`, pageId);
      errors.push(`Screenshot failed: ${e.message}`);
    }

    // DOM取得
    let dom: any = {};
    try {
      dom = await popup.evaluate(() => {
        return {
          title: document.title,
          bodyText: document.body.innerText,
          resultText: document.getElementById('result')?.innerText || '',
          html: document.documentElement.outerHTML
        };
      });
    } catch (e: any) {
      this.logger.log('error', `Failed to get DOM: ${e.message}`, pageId);
    }

    // ページを閉じる
    await popup.close();
    
    // ターゲットページも閉じる
    if (targetPage) {
      await targetPage.close();
    }

    const result: UICheckResult = {
      loaded: true,
      screenshot: screenshotPath,
      dom,
      logs: this.logger.getLogs().pages[pageId] || [],
      errors,
      performance: {
        loadTime: Date.now() - loadTimeStart
      }
    };

    // シナリオ実行結果を追加
    if (scenarioResult) {
      result.scenario = {
        name: scenarioName!,
        logs: scenarioResult.logs,
        executionTime: scenarioResult.executionTime
      };
    }

    return result;
  }

  async openPopup(): Promise<{ success: boolean; message: string }> {
    if (!this.context || !this.extensionId) {
      throw new Error('Extension not loaded');
    }

    const popupUrl = `chrome-extension://${this.extensionId}/popup.html`;
    this.logger.log('info', `Opening popup: ${popupUrl}`, 'system');
    
    const page = await this.context.newPage();
    await page.goto(popupUrl);
    
    return { success: true, message: 'Popup opened' };
  }

  async wakeUpServiceWorker(): Promise<{ success: boolean; message: string }> {
    if (!this.context || !this.extensionId) {
      throw new Error('Extension not loaded');
    }

    this.logger.log('info', 'Waking up Service Worker...', 'system');
    
    const page = await this.context.newPage();
    try {
      const popupUrl = `chrome-extension://${this.extensionId}/popup.html`;
      await page.goto(popupUrl);
      
      await page.evaluate(() => {
        // @ts-ignore
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          // @ts-ignore
          chrome.runtime.sendMessage({ type: 'KAMOX_WAKE_UP' }).catch(() => {});
        }
      });
      
      await page.waitForTimeout(500);
      await page.close();
      
      return { success: true, message: 'Service Worker wake up triggered' };
    } catch (e: any) {
      await page.close();
      return { success: false, message: `Failed to wake up SW: ${e.message}` };
    }
  }

  async checkScript(url: string = 'https://example.com'): Promise<ScriptCheckResult> {
    if (!this.context) {
      throw new Error('Chrome environment not running');
    }

    try {
      validateUrl(url);
    } catch (e: any) {
      throw new Error(`Invalid target URL: ${e.message}`);
    }

    this.logger.log('info', `Checking Content Script on ${url}...`, 'system');
    
    const pageId = `script_${Date.now()}`;
    const page = await this.context.newPage();
    
    // ログ収集
    page.on('console', msg => {
      this.logger.log(msg.type() as any, msg.text(), pageId);
    });

    const errors: string[] = [];
    page.on('pageerror', err => {
      errors.push(err.message);
      this.logger.log('error', err.message, pageId);
    });

    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');

    // スクリプト注入確認（例：特定の要素や変数の存在確認）
    // ここでは単純にbodyの背景色が変わっているかなどをチェックするロジックを想定
    // 実際には拡張機能の仕様に合わせてカスタマイズが必要
    
    const injected = await page.evaluate(() => {
      // 例: windowオブジェクトに特定のプロパティが追加されているか
      // @ts-ignore
      return window.myExtensionLoaded === true || document.body.getAttribute('data-extension-loaded') === 'true';
    });

    // スクリーンショット
    const timestamp = new Date().getTime();
    const rootDir = this.state.config.workDir ? path.resolve(this.state.config.workDir) : path.resolve(this.state.config.projectPath);
    const workDir = path.join(rootDir, '.kamox');
    const screenshotsDir = path.join(workDir, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotsDir, `script_${timestamp}.png`);
    await page.screenshot({ path: screenshotPath });

    await page.close();

    return {
      url,
      injected: !!injected,
      screenshot: screenshotPath,
      logs: this.logger.getLogs().pages[pageId] || []
    };
  }

  protected getBuildCount(): number {
    return this.buildCount;
  }

  protected getLastBuildTime(): string | null {
    return this.lastBuildTime;
  }

  // Playwright API implementations
  async performMouseAction(request: PlaywrightMouseRequest): Promise<PlaywrightActionResult> {
    if (!this.context) {
      return {
        success: false,
        error: 'Browser context not initialized'
      };
    }

    try {
      const pages = this.context.pages();
      if (pages.length === 0) {
        return {
          success: false,
          error: 'No active pages found'
        };
      }

      const page = pages[0];
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
            return {
              success: false,
              error: 'toX and toY are required for drag action'
            };
          }
          await page.mouse.move(request.x, request.y);
          await page.mouse.down({ button });
          await page.mouse.move(request.toX, request.toY);
          await page.mouse.up({ button });
          break;
        default:
          return {
            success: false,
            error: `Unknown mouse action: ${request.action}`
          };
      }

      return {
        success: true,
        data: {
          action: request.action,
          position: { x: request.x, y: request.y }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async performKeyboardAction(request: PlaywrightKeyboardRequest): Promise<PlaywrightActionResult> {
    if (!this.context) {
      return {
        success: false,
        error: 'Browser context not initialized'
      };
    }

    try {
      const pages = this.context.pages();
      if (pages.length === 0) {
        return {
          success: false,
          error: 'No active pages found'
        };
      }

      const page = pages[0];

      switch (request.action) {
        case 'type':
          if (!request.text) {
            return {
              success: false,
              error: 'text is required for type action'
            };
          }
          await page.keyboard.type(request.text);
          break;
        case 'press':
          if (!request.key) {
            return {
              success: false,
              error: 'key is required for press action'
            };
          }
          await page.keyboard.press(request.key);
          break;
        default:
          return {
            success: false,
            error: `Unknown keyboard action: ${request.action}`
          };
      }

      return {
        success: true,
        data: {
          action: request.action,
          text: request.text,
          key: request.key
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async performElementAction(request: PlaywrightElementRequest): Promise<PlaywrightActionResult> {
    if (!this.context) {
      return {
        success: false,
        error: 'Browser context not initialized'
      };
    }

    try {
      const pages = this.context.pages();
      if (pages.length === 0) {
        return {
          success: false,
          error: 'No active pages found'
        };
      }

      const page = pages[0];
      const timeout = request.timeout || 5000;
      const element = page.locator(request.selector);

      switch (request.action) {
        case 'click':
          await element.click({ timeout });
          break;
        case 'fill':
          if (request.value === undefined) {
            return {
              success: false,
              error: 'value is required for fill action'
            };
          }
          await element.fill(request.value, { timeout });
          break;
        case 'select':
          if (request.value === undefined) {
            return {
              success: false,
              error: 'value is required for select action'
            };
          }
          await element.selectOption(request.value, { timeout });
          break;
        case 'check':
          await element.check({ timeout });
          break;
        case 'uncheck':
          await element.uncheck({ timeout });
          break;
        default:
          return {
            success: false,
            error: `Unknown element action: ${request.action}`
          };
      }

      return {
        success: true,
        data: {
          selector: request.selector,
          action: request.action
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async performWait(request: PlaywrightWaitRequest): Promise<PlaywrightActionResult> {
    if (!this.context) {
      return {
        success: false,
        error: 'Browser context not initialized'
      };
    }

    try {
      const pages = this.context.pages();
      if (pages.length === 0) {
        return {
          success: false,
          error: 'No active pages found'
        };
      }

      const page = pages[0];
      const startTime = Date.now();

      switch (request.type) {
        case 'selector':
          if (!request.selector) {
            return {
              success: false,
              error: 'selector is required for selector wait type'
            };
          }
          await page.waitForSelector(request.selector, { timeout: request.timeout || 5000 });
          break;
        case 'timeout':
          if (request.duration === undefined) {
            return {
              success: false,
              error: 'duration is required for timeout wait type'
            };
          }
          await page.waitForTimeout(request.duration);
          break;
        case 'networkIdle':
          await page.waitForLoadState('networkidle', { timeout: request.timeout || 30000 });
          break;
        default:
          return {
            success: false,
            error: `Unknown wait type: ${request.type}`
          };
      }

      const waited = Date.now() - startTime;

      return {
        success: true,
        data: {
          type: request.type,
          waited
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async performReload(request: PlaywrightReloadRequest): Promise<PlaywrightActionResult> {
    if (!this.context) {
      return {
        success: false,
        error: 'Browser context not initialized'
      };
    }

    try {
      const pages = this.context.pages();
      if (pages.length === 0) {
        return {
          success: false,
          error: 'No active pages found'
        };
      }

      const page = pages[0];
      const waitUntil = request.waitUntil || 'load';
      const timeout = request.timeout || 30000;

      await page.reload({ waitUntil, timeout });

      return {
        success: true,
        data: {
          reloaded: true,
          waitUntil
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Scenario execution methods
  async executeScenario(scenarioName: string): Promise<ScenarioExecutionResult> {
    if (!this.scenarioLoader) {
      const rootDir = this.state.config.workDir ? path.resolve(this.state.config.workDir) : path.resolve(this.state.config.projectPath);
      this.scenarioLoader = new ScenarioLoader(rootDir, this.logger);
    }

    const startTime = Date.now();
    const scenarioLogs: LogEntry[] = [];

    try {
      // シナリオを読み込む
      const scenario = await this.scenarioLoader.loadScenario(`${scenarioName}.scenario.js`);

      // ログ収集のためのラッパー
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
        // コンテキストの取得（共有コンテキストモデル）
        const context = scenario.requiresPersistentContext
          ? await this.ensurePersistentContext()
          : await this.ensureSharedContext();

        // Service Worker初期化
        if (scenario.requiresServiceWorkerInit && this.extensionId) {
          await this.initServiceWorker(this.extensionId);
        }

        // シナリオ実行
        await scenario.setup(context, this.logger);

        // クリーンアップ（デフォルト動作 + カスタム）
        await this.executeCleanup(scenario, context);

        return {
          success: true,
          logs: scenarioLogs,
          executionTime: Date.now() - startTime
        };
      } finally {
        // ロガーを元に戻す
        this.logger.log = originalLog;
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        logs: scenarioLogs,
        executionTime: Date.now() - startTime
      };
    }
  }

  private async ensureSharedContext(): Promise<BrowserContext> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }
    
    // 共有コンテキストは既存のcontextを使用（軽量なシナリオ用）
    // 必要に応じて新しいBrowserContextを作成することも可能
    return this.context;
  }

  private async ensurePersistentContext(): Promise<BrowserContext> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }
    
    // PersistentContextは既存のcontext（launchPersistentContextで作成済み）を使用
    return this.context;
  }

  private async initServiceWorker(extensionId: string): Promise<void> {
    this.logger.log('info', 'Initializing Service Worker...', 'scenario');

    // 1. Service Workerを強制起動
    await this.wakeUpServiceWorker();

    // 2. Service Workerが起動するまで待機
    await this.waitForServiceWorkerReady(extensionId);

    this.logger.log('info', 'Service Worker initialized', 'scenario');
  }

  private async waitForServiceWorkerReady(extensionId: string): Promise<void> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const workers = this.context.serviceWorkers();
      const sw = workers.find(w => w.url().includes(extensionId));
      if (sw) {
        this.logger.log('info', 'Service Worker is ready', 'scenario');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Service Worker did not start within timeout');
  }

  private async executeCleanup(scenario: Scenario, context: BrowserContext): Promise<void> {
    // カスタムcleanupがある場合は実行
    if (scenario.cleanup) {
      try {
        await scenario.cleanup(context, this.logger);
      } catch (error: any) {
        this.logger.log('warn', `Custom cleanup failed: ${error.message}`, 'scenario');
      }
    }

    // デフォルトクリーンアップ（常に実行）
    await this.defaultCleanup(context);
  }

  private async defaultCleanup(context: BrowserContext): Promise<void> {
    this.logger.log('info', 'Executing default cleanup...', 'scenario');

    try {
      // 1. すべてのページを閉じる（拡張機能のポップアップなどは除外）
      const pages = context.pages();
      const pagesToClose = pages.filter(page => {
        const url = page.url();
        // 拡張機能のページは保持
        return !url.startsWith('chrome-extension://') && 
               !url.startsWith('chrome://') &&
               !url.startsWith('about:');
      });

      for (const page of pagesToClose) {
        try {
          await page.close();
        } catch (error: any) {
          this.logger.log('warn', `Failed to close page: ${error.message}`, 'scenario');
        }
      }

      this.logger.log('info', `Closed ${pagesToClose.length} pages`, 'scenario');
    } catch (error: any) {
      this.logger.log('warn', `Default cleanup error: ${error.message}`, 'scenario');
    }
  }

  getScenarioLoader(): ScenarioLoader | null {
    // ScenarioLoaderが初期化されていない場合は初期化
    if (!this.scenarioLoader) {
      const rootDir = this.state.config.workDir ? path.resolve(this.state.config.workDir) : path.resolve(this.state.config.projectPath);
      this.scenarioLoader = new ScenarioLoader(rootDir, this.logger);
    }
    return this.scenarioLoader;
  }
}

