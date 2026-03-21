import {
  ExTester,
  VSBrowser,
  NotificationType,
  Workbench,
  ReleaseQuality,
  MarkerType,
  until,
  By
} from 'vscode-extension-tester'
import { IVSCodeUIDriver, VSCodeLaunchConfig, NotificationInfo } from './IVSCodeUIDriver.js'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

export class ExTesterDriver implements IVSCodeUIDriver {
  private exTester: ExTester | null = null

  async launch(config: VSCodeLaunchConfig): Promise<void> {
    // パスを絶対パス・バックスラッシュ形式に正規化（Windows VSCode が正しく認識するため）
    const extensionAbsPath = path.resolve(config.extensionPath).replace(/\//g, '\\');
    console.log(`[KamoX] extensionPath (raw): ${config.extensionPath}`);
    console.log(`[KamoX] extensionPath (resolved): ${extensionAbsPath}`);

    // extensionPathを渡してExTesterを初期化（内部でstoragePathとextensionPathを管理）
    this.exTester = new ExTester(undefined, ReleaseQuality.Stable, extensionAbsPath);

    // CodeUtilインスタンスを先に取得（downloadCode前でもexecutablePath/codeFolder は設定済み）
    const codeInternal = (this.exTester as any).code;

    // キャッシュ済みVSCodeを確認し、あればAPIを叩かずスキップ
    const cachedVersion: string | undefined = codeInternal?.getExistingCodeVersion?.();
    if (cachedVersion) {
      console.log(`Using cached VSCode ${cachedVersion}`);
    } else {
      // キャッシュがない場合のみダウンロード（update.code.visualstudio.com APIを呼ぶ）
      try {
        await this.exTester.downloadCode();
      } catch (e: any) {
        throw new Error(`Failed to download VSCode: ${e.message}\nTip: If the API is unavailable (503), run once with network access to cache VSCode.`);
      }
    }

    const vscodePath: string = config.vscodePath || codeInternal?.executablePath;
    const codeVersion: string = codeInternal?.getExistingCodeVersion?.()
      ?? codeInternal?.availableVersions?.[0];

    if (!vscodePath) {
      throw new Error('Failed to determine VSCode executable path. Use --vscode-path to specify it manually.');
    }
    if (!codeVersion) {
      throw new Error('Failed to determine VSCode version from downloaded installation.');
    }

    // VSCodeのElectronバージョンに合ったChromeDriverをダウンロード
    await this.exTester.downloadChromeDriver(codeVersion);

    // --extensionDevelopmentPath はChromiumドライバー経由では機能しないため、
    // --extensions-dir でディレクトリジャンクションを使って拡張機能を読み込む方式に変更。
    // ジャンクションは管理者権限不要で作成可能（Windows）。
    const storageFolder = path.join(os.tmpdir(), 'test-resources')
    const testExtDir = path.join(storageFolder, 'test-extensions')
    const junctionPath = path.join(testExtDir, 'dev-extension')
    fs.mkdirSync(testExtDir, { recursive: true })
    if (fs.existsSync(junctionPath)) {
      fs.rmSync(junctionPath, { recursive: true, force: true })
    }
    // Windows ジャンクションで拡張機能ソースをリンク（シンボリックリンク権限不要）
    fs.symlinkSync(extensionAbsPath, junctionPath, 'junction')
    console.log(`[KamoX] Junction created: ${junctionPath} -> ${extensionAbsPath}`)

    // EXTENSIONS_FOLDER: VSBrowser がコンストラクタで読むためここで設定
    process.env.EXTENSIONS_FOLDER = testExtDir
    console.log(`[KamoX] EXTENSIONS_FOLDER set to: ${testExtDir}`)

    // VSBrowserを正しいバージョン文字列で初期化（ChromeDriverとの一致が重要）
    const browser = new VSBrowser(codeVersion, ReleaseQuality.Stable);

    // Windows AMD GPU 環境で DirectComposition が失敗しクラッシュするため --disable-gpu を注入する。
    // VSBrowser.start() は内部で Options.addArguments() を呼ぶため、一時的にプロトタイプをパッチする。
    const { Options } = await import('selenium-webdriver/chrome.js');
    const _origAddArgs = Options.prototype.addArguments;
    Options.prototype.addArguments = function (...args: string[]) {
      // --disable-gpu: GPU ハードウェアアクセラレーション無効
      // --in-process-gpu: GPU を別プロセスでなくメインプロセス内で実行
      return _origAddArgs.call(this, ...args, '--disable-gpu', '--in-process-gpu');
    };

    try {
      await browser.start(vscodePath);
    } finally {
      Options.prototype.addArguments = _origAddArgs;
    }

    await browser.waitForWorkbench();
    console.log(`[KamoX] Workbench ready. Extension loaded from: ${testExtDir}`);
  }

  async quit(): Promise<void> {
    await VSBrowser.instance.quit()
  }

  async takeScreenshot(): Promise<Buffer> {
    const driver = VSBrowser.instance.driver
    const base64 = await driver.takeScreenshot()
    return Buffer.from(base64, 'base64')
  }

  async executeCommand(id: string): Promise<void> {
    const workbench = new Workbench()
    await workbench.executeCommand(id)
  }

  async getOutputChannelText(channelName: string): Promise<string> {
    const workbench = new Workbench()
    const bottomBar = workbench.getBottomBar()
    const outputView = await bottomBar.openOutputView()
    await outputView.selectChannel(channelName)
    return await outputView.getText()
  }

  async openFile(path: string): Promise<void> {
    await VSBrowser.instance.openResources(path)
  }

  // Placeholder implementations for the rest of Step 1/2/3 to satisfy interface
  async getNotifications(): Promise<NotificationInfo[]> {
    const workbench = new Workbench()
    const center = await workbench.openNotificationsCenter()
    // Wait for the notifications center to be ready/populated
    const driver = VSBrowser.instance.driver
    try {
      await driver.wait(until.elementLocated(By.className('notifications-list-container')), 5000)
    } catch (e) {
      // Fallback or ignore if it doesn't appear in time
    }
    
    const notifications = await center.getNotifications(NotificationType.Any)
    return Promise.all(notifications.map(async (n: any) => ({
      message: await n.getMessage(),
      type: 'info' as const, // Simplification for MVP
      actions: await n.getActions().then((actions: any[]) => Promise.all(actions.map((a: any) => a.getText())))
    })))
  }

  async dismissNotification(message: string): Promise<void> {
    const workbench = new Workbench()
    const center = await workbench.openNotificationsCenter()
    const notifications = await center.getNotifications(NotificationType.Any)
    for (const n of notifications) {
      if ((await n.getMessage()) === message) {
        await n.dismiss()
        break
      }
    }
  }

  async getStatusBarItemText(labelPattern: string): Promise<string | null> {
    const workbench = new Workbench()
    const statusBar = workbench.getStatusBar()
    const items = await statusBar.getItems()
    for (const item of items) {
      const text = await item.getText()
      if (text.includes(labelPattern)) return text
    }
    return null
  }

  async clickActivityBarItem(label: string): Promise<void> {
    const workbench = new Workbench()
    const activityBar = workbench.getActivityBar()
    const control = await activityBar.getViewControl(label)
    await control?.click()
  }

  async getTreeViewItems(viewId: string): Promise<string[]> {
    const workbench = new Workbench()
    const sideBar = workbench.getSideBar()
    const content = sideBar.getContent()
    const sections = await content.getSections()
    let section = null
    
    // Try exact match first
    try {
      section = await content.getSection(viewId)
    } catch (e) {
      // Try case-insensitive match
      for (const s of sections) {
        const title = await s.getTitle()
        if (title.toLowerCase() === viewId.toLowerCase()) {
          section = s
          break
        }
      }
    }

    if (!section && sections.length > 0) {
      // Fallback to first section if nothing found
      section = sections[0]
    }

    if (!section) throw new Error(`No section found in sidebar`)
    
    await section.expand()
    const items = await section.getVisibleItems()
    return Promise.all(items.map((i: any) => i.getText()))
  }

  async selectQuickPickItem(label: string): Promise<void> {
    const workbench = new Workbench()
    const quickPick = await workbench.openCommandPrompt()
    await quickPick.setText(label)
    await quickPick.confirm()
  }

  async getProblems(): Promise<any[]> {
    const workbench = new Workbench()
    const bottomBar = workbench.getBottomBar()
    const problemsView = await bottomBar.openProblemsView()
    const markers = await problemsView.getAllVisibleMarkers(MarkerType.Any)
    return Promise.all(markers.map(async (marker: any) => ({
      message: await marker.getText(),
      type: await marker.getType(),
      label: await marker.getLabel()
    })))
  }

  async click(selector: string): Promise<void> {
    const driver = VSBrowser.instance.driver
    const element = await driver.findElement({ css: selector })
    await element.click()
  }

  async typeText(text: string): Promise<void> {
    const driver = VSBrowser.instance.driver
    await driver.actions().sendKeys(text).perform()
  }

  async pressKey(key: string): Promise<void> {
    const driver = VSBrowser.instance.driver
    await driver.actions().sendKeys(key).perform()
  }

  async evaluate(script: string): Promise<any> {
    const driver = VSBrowser.instance.driver
    return await driver.executeScript(script)
  }
}
