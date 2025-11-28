import { BaseDevServer } from '@kamox/core/dist/BaseDevServer.js';
import { UICheckResult, ScriptCheckResult } from '@kamox/core/dist/types/common.js';
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

  async launch(): Promise<void> {
    const originalProjectPath = path.resolve(this.state.config.projectPath);
    const devDir = path.join(originalProjectPath, '.kamox');
    
    this.logger.log('info', 'Setting up development environment...', 'system');
    
    // 既存の.kamoxディレクトリをクリーンアップ
    cleanupDevDirectory(devDir);
    
    // プロジェクトファイルを.kamoxにコピー
    this.logger.log('info', 'Copying project files to .kamox directory...', 'system');
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
      args: [
        `--disable-extensions-except=${devDir}`,
        `--load-extension=${devDir}`,
        '--enable-logging',
        '--v=1'
      ]
    });

    // Service Workerの監視
    this.context.on('serviceworker', worker => {
      this.logger.log('info', `Service Worker detected: ${worker.url()}`, 'system');
      
      if (!this.extensionId) {
        const url = worker.url();
        if (url.startsWith('chrome-extension://')) {
          this.extensionId = url.split('/')[2];
          this.logger.log('info', `Extension ID detected: ${this.extensionId}`, 'system');
        }
      }
    });

    // 既存のService Workerを確認
    const workers = this.context.serviceWorkers();
    if (workers.length > 0) {
      const url = workers[0].url();
      if (url.startsWith('chrome-extension://')) {
        this.extensionId = url.split('/')[2];
        this.logger.log('info', `Extension ID detected (existing): ${this.extensionId}`, 'system');
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
          const screenshotPath = path.join(process.cwd(), 'screenshots', `extensions_page_${timestamp}.png`);
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
  }

  async reload(): Promise<void> {
    this.logger.log('info', 'Reloading Chrome environment...', 'system');
    
    if (this.context) {
      await this.context.close();
    }
    
    await this.launch();
    
    this.buildCount++;
    this.lastBuildTime = new Date().toISOString();
  }

  async checkUI(options?: { url?: string }): Promise<UICheckResult> {
    return this.checkPopup(options?.url);
  }

  async checkPopup(targetUrl?: string): Promise<UICheckResult> {
    if (!this.context || !this.extensionId) {
      throw new Error('Extension not loaded');
    }

    this.logger.log('info', 'Checking Popup UI...', 'system');
    
    // ターゲットURLが指定されている場合、先にそのページを開く
    let targetPage: Page | null = null;
    if (targetUrl) {
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

    // ボタンが存在すればクリックして動作確認
    try {
      const button = await popup.$('#getInfo');
      if (button) {
        this.logger.log('info', 'Clicking #getInfo button...', pageId);
        await button.click();
        
        // 結果が表示されるのを待つ（Loading... から変化するまで、またはタイムアウト）
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
    
    // スクリーンショット
    const screenshotBuffer = await popup.screenshot();
    const screenshotPath = await this.screenshotManager.saveScreenshot(screenshotBuffer, 'popup');

    // DOM情報取得
    const domInfo = await popup.evaluate(() => {
      const resultEl = document.getElementById('result');
      return {
        title: document.title,
        bodyText: document.body.innerText.substring(0, 500),
        resultText: resultEl ? resultEl.innerText : null,
        elementCounts: {
          button: document.querySelectorAll('button').length,
          input: document.querySelectorAll('input').length,
          div: document.querySelectorAll('div').length
        },
        html: document.body.innerHTML.substring(0, 1000) // デバッグ用
      };
    });

    await popup.close();
    if (targetPage) {
      await targetPage.close();
    }

    return {
      loaded: true,
      screenshot: screenshotPath,
      dom: domInfo,
      logs: this.logger.getLogs().pages[pageId] || [],
      errors,
      performance: {
        loadTime: Date.now() - loadTimeStart
      }
    };
  }

  async checkScript(url: string = 'https://example.com'): Promise<ScriptCheckResult> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    this.logger.log('info', `Checking Content Script on ${url}...`, 'system');

    const pageId = `content_${Date.now()}`;
    const page = await this.context.newPage();

    // ログ収集
    page.on('console', msg => {
      this.logger.log(msg.type() as any, msg.text(), pageId);
    });

    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');
    
    // 少し待機してContent Scriptが実行されるのを待つ
    await page.waitForTimeout(1000);

    // 注入確認（例: 特定の属性やグローバル変数の確認）
    // ここでは汎用的なチェックを行うが、実際にはプロジェクト固有のチェックが必要になる場合も
    const injectionCheck = await page.evaluate(() => {
      // KamoXのサンプル拡張では body に data-kamox-injected 属性を付与することを想定
      const bodyAttr = document.body.getAttribute('data-kamox-injected');
      
      // または特定のクラス名を持つ要素の存在確認
      const customElements = document.querySelectorAll('.kamox-element').length;

      return {
        bodyAttr,
        customElements,
        title: document.title
      };
    });

    const screenshotBuffer = await page.screenshot();
    const screenshotPath = await this.screenshotManager.saveScreenshot(screenshotBuffer, 'content');

    await page.close();

    const injected = !!injectionCheck.bodyAttr || injectionCheck.customElements > 0;

    return {
      url,
      injected,
      checks: injectionCheck,
      screenshot: screenshotPath,
      logs: this.logger.getLogs().pages[pageId] || []
    };
  }

  // オーバーライド
  protected getBuildCount(): number {
    return this.buildCount;
  }

  protected getLastBuildTime(): string | null {
    return this.lastBuildTime;
  }
}
