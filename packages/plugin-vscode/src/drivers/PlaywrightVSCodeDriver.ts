import { _electron as electron, ElectronApplication, Page } from 'playwright'
import { IVSCodeUIDriver, VSCodeLaunchConfig, NotificationInfo } from './IVSCodeUIDriver.js'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

export class PlaywrightVSCodeDriver implements IVSCodeUIDriver {
  private app: ElectronApplication | null = null
  private page: Page | null = null
  private userDataDir: string | null = null

  async launch(config: VSCodeLaunchConfig): Promise<void> {
    const extensionAbsPath = path.resolve(config.extensionPath)
    console.log(`[KamoX] extensionPath (resolved): ${extensionAbsPath}`)

    // VSCodeバイナリのパスを決定（指定なければ自動検出またはExTesterのキャッシュを使用）
    const vscodePath = config.vscodePath || this.findVSCode()
    console.log(`[KamoX] VSCode binary: ${vscodePath}`)

    // テスト用の独立したユーザーデータディレクトリ（ユーザーのVSCodeと競合を避けるため毎回新規作成）
    // 同じディレクトリを使い回すと前回の残存プロセスとmutex競合が発生する
    this.userDataDir = path.join(os.tmpdir(), `kamox-vscode-profile-${Date.now()}`)
    fs.mkdirSync(this.userDataDir, { recursive: true })
    console.log(`[KamoX] User data dir: ${this.userDataDir}`)

    // ELECTRON_RUN_AS_NODE が設定されているとElectronがNode.jsモードで起動する問題を回避
    const launchEnv: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined) {
        launchEnv[key] = value
      }
    }

    const args = [
      '--no-sandbox',
      '--disable-gpu',
      '--in-process-gpu',
      `--extensionDevelopmentPath=${extensionAbsPath}`,
      `--user-data-dir=${this.userDataDir}`,
      '--no-first-run',
      '--skip-release-notes',
      '--skip-welcome',
      '--disable-updates',
      '--disable-workspace-trust',
      ...(config.additionalArgs ?? [])
    ]

    if (config.workspacePath) {
      args.push(config.workspacePath)
    }

    console.log(`[KamoX] Launching VSCode with args: ${args.join(' ')}`)

    this.app = await electron.launch({
      executablePath: vscodePath,
      args,
      env: launchEnv,
    })

    // 最初のウィンドウ（ワークベンチ）を取得
    this.page = await this.app.firstWindow()

    // ワークベンチが完全に表示されるまで待機
    await this.waitForWorkbench()
    console.log(`[KamoX] VSCode workbench ready. Extension loaded from: ${extensionAbsPath}`)
  }

  private findVSCode(): string {
    // ExTesterがキャッシュしたVSCodeを優先（バージョン一致のため）
    const exTesterCache = path.join(os.tmpdir(), 'test-resources', 'VSCode-win32-x64-archive', 'Code.exe')
    if (fs.existsSync(exTesterCache)) {
      console.log(`[KamoX] Using cached VSCode: ${exTesterCache}`)
      return exTesterCache
    }

    // ユーザーのインストール済みVSCodeを探す
    const username = os.userInfo().username
    const candidates = [
      `C:\\Users\\${username}\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe`,
      'C:\\Program Files\\Microsoft VS Code\\Code.exe',
      'C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe',
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        console.log(`[KamoX] Found VSCode: ${p}`)
        return p
      }
    }
    throw new Error(
      'VSCode not found. Use --vscode-path to specify it or run without --no-download to cache it first.'
    )
  }

  private async waitForWorkbench(timeout = 30000): Promise<void> {
    if (!this.page) throw new Error('VSCode not launched')
    try {
      await this.page.waitForSelector('.monaco-workbench', { timeout })
      console.log('[KamoX] .monaco-workbench detected')
    } catch {
      console.warn('[KamoX] .monaco-workbench not found within timeout, continuing...')
      // フォールバック: DOMContentLoadedまで待機
      await this.page.waitForTimeout(5000)
    }
  }

  async quit(): Promise<void> {
    await this.app?.close()
    this.app = null
    this.page = null
    // 一時ユーザーデータディレクトリをクリーンアップ
    if (this.userDataDir && fs.existsSync(this.userDataDir)) {
      try {
        fs.rmSync(this.userDataDir, { recursive: true, force: true })
      } catch {
        // クリーンアップ失敗は無視
      }
    }
    this.userDataDir = null
  }

  async takeScreenshot(): Promise<Buffer> {
    if (!this.page) throw new Error('VSCode not launched')
    return await this.page.screenshot()
  }

  async executeCommand(id: string): Promise<void> {
    if (!this.page) throw new Error('VSCode not launched')
    // Ctrl+Shift+P でコマンドパレットを開いてコマンドIDを入力・実行
    await this.page.keyboard.press('Control+Shift+P')
    await this.page.waitForTimeout(500)
    // コマンドパレットに直接コマンドIDを入力（> プレフィックス付き）
    await this.page.keyboard.type(id, { delay: 20 })
    await this.page.waitForTimeout(400)
    await this.page.keyboard.press('Enter')
    await this.page.waitForTimeout(300)
  }

  async openFile(filePath: string): Promise<void> {
    if (!this.page) throw new Error('VSCode not launched')
    // Ctrl+P でファイルクイックオープン
    await this.page.keyboard.press('Control+P')
    await this.page.waitForTimeout(500)
    await this.page.keyboard.type(filePath, { delay: 20 })
    await this.page.waitForTimeout(400)
    await this.page.keyboard.press('Enter')
    await this.page.waitForTimeout(500)
  }

  async typeText(text: string): Promise<void> {
    if (!this.page) throw new Error('VSCode not launched')
    await this.page.keyboard.type(text)
  }

  async pressKey(key: string): Promise<void> {
    if (!this.page) throw new Error('VSCode not launched')
    await this.page.keyboard.press(key)
  }

  async click(selector: string): Promise<void> {
    if (!this.page) throw new Error('VSCode not launched')
    await this.page.click(selector)
  }

  async evaluate(script: string): Promise<any> {
    if (!this.page) throw new Error('VSCode not launched')
    return await this.page.evaluate(script)
  }

  // --- 以下はUI操作が必要な実装 ---

  async getOutputChannelText(channelName: string): Promise<string> {
    if (!this.page) throw new Error('VSCode not launched')
    // アウトプットパネルを開く（Ctrl+Shift+U）
    await this.page.keyboard.press('Control+Shift+U')
    await this.page.waitForTimeout(800)
    // チャンネル選択ドロップダウンをクリック
    try {
      const dropdown = await this.page.$('.output-view-container .select-box select, .panel .output .select')
      if (dropdown) {
        await dropdown.selectOption({ label: channelName })
        await this.page.waitForTimeout(500)
      }
      // アウトプット内容を取得
      const outputEl = await this.page.$('.output-view-container .view-lines, .panel .output .view-lines')
      if (outputEl) {
        return await outputEl.innerText()
      }
    } catch (e) {
      console.warn(`[KamoX] Failed to get output channel text: ${e}`)
    }
    return ''
  }

  async getNotifications(): Promise<NotificationInfo[]> {
    if (!this.page) throw new Error('VSCode not launched')
    try {
      // 通知センターを開く
      const bellIcon = await this.page.$('.statusbar-item[id*="notification"], .notifications-statusbar-item')
      if (bellIcon) await bellIcon.click()
      await this.page.waitForTimeout(500)

      const items = await this.page.$$('.notification-list-item')
      const results: NotificationInfo[] = []
      for (const item of items) {
        const messageEl = await item.$('.notification-list-item-message')
        const message = messageEl ? await messageEl.innerText() : ''
        results.push({ message, type: 'info', actions: [] })
      }
      return results
    } catch {
      return []
    }
  }

  async dismissNotification(message: string): Promise<void> {
    if (!this.page) throw new Error('VSCode not launched')
    try {
      const items = await this.page.$$('.notification-list-item')
      for (const item of items) {
        const messageEl = await item.$('.notification-list-item-message')
        const text = messageEl ? await messageEl.innerText() : ''
        if (text === message) {
          const closeBtn = await item.$('.codicon-notifications-clear, .notification-close-action')
          if (closeBtn) await closeBtn.click()
          break
        }
      }
    } catch (e) {
      console.warn(`[KamoX] Failed to dismiss notification: ${e}`)
    }
  }

  async getStatusBarItemText(labelPattern: string): Promise<string | null> {
    if (!this.page) throw new Error('VSCode not launched')
    try {
      const items = await this.page.$$('.statusbar-item')
      for (const item of items) {
        const text = await item.innerText()
        if (text.includes(labelPattern)) return text
      }
    } catch (e) {
      console.warn(`[KamoX] Failed to get status bar item: ${e}`)
    }
    return null
  }

  async clickActivityBarItem(label: string): Promise<void> {
    if (!this.page) throw new Error('VSCode not launched')
    try {
      const items = await this.page.$$('.activitybar .action-item')
      for (const item of items) {
        const ariaLabel = await item.getAttribute('aria-label')
        if (ariaLabel && ariaLabel.toLowerCase().includes(label.toLowerCase())) {
          await item.click()
          return
        }
      }
    } catch (e) {
      console.warn(`[KamoX] Failed to click activity bar item: ${e}`)
    }
  }

  async getTreeViewItems(viewId: string): Promise<string[]> {
    if (!this.page) throw new Error('VSCode not launched')
    try {
      const rows = await this.page.$$('.pane-body .tree-rows .row, .sidebar .tree-rows .monaco-list-row')
      const texts: string[] = []
      for (const row of rows) {
        const text = await row.innerText()
        if (text.trim()) texts.push(text.trim())
      }
      return texts
    } catch (e) {
      console.warn(`[KamoX] Failed to get tree view items: ${e}`)
      return []
    }
  }

  async selectQuickPickItem(label: string): Promise<void> {
    if (!this.page) throw new Error('VSCode not launched')
    try {
      const items = await this.page.$$('.quick-input-list .quick-input-list-entry')
      for (const item of items) {
        const text = await item.innerText()
        if (text.includes(label)) {
          await item.click()
          return
        }
      }
    } catch (e) {
      console.warn(`[KamoX] Failed to select quick pick item: ${e}`)
    }
  }

  async getProblems(): Promise<any[]> {
    if (!this.page) throw new Error('VSCode not launched')
    try {
      // Ctrl+Shift+M でProblemsパネルを開く
      await this.page.keyboard.press('Control+Shift+M')
      await this.page.waitForTimeout(800)
      const rows = await this.page.$$('.markers-panel .monaco-list-row')
      const results: any[] = []
      for (const row of rows) {
        const text = await row.innerText()
        results.push({ message: text })
      }
      return results
    } catch (e) {
      console.warn(`[KamoX] Failed to get problems: ${e}`)
      return []
    }
  }
}
