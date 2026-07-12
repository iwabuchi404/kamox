import { _electron as electron, ElectronApplication, Page } from 'playwright'
import { chromium } from 'playwright'
import { IVSCodeUIDriver, VSCodeLaunchConfig, NotificationInfo } from './IVSCodeUIDriver.js'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { spawn, ChildProcess } from 'child_process'

export class PlaywrightVSCodeDriver implements IVSCodeUIDriver {
  private app: ElectronApplication | null = null
  private page: Page | null = null
  private userDataDir: string | null = null
  private childProcess: ChildProcess | null = null
  private browser: import('playwright').Browser | null = null

  async launch(config: VSCodeLaunchConfig): Promise<void> {
    const extensionAbsPath = path.resolve(config.extensionPath)
    console.log(`[KamoX] extensionPath (resolved): ${extensionAbsPath}`)

    // VSCodeバイナリのパスを決定
    const vscodePath = config.vscodePath || this.findVSCode()
    console.log(`[KamoX] VSCode binary: ${vscodePath}`)

    // テスト用の独立したユーザーデータディレクトリ
    this.userDataDir = path.join(os.tmpdir(), `kamox-vscode-profile-${Date.now()}`)
    fs.mkdirSync(this.userDataDir, { recursive: true })
    console.log(`[KamoX] User data dir: ${this.userDataDir}`)

    // ELECTRON_RUN_AS_NODE を除外
    const launchEnv: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined) {
        launchEnv[key] = value
      }
    }

    const debugPort = 9222 + Math.floor(Math.random() * 1000)
    const args = [
      `--extensionDevelopmentPath=${extensionAbsPath}`,
      `--user-data-dir=${this.userDataDir}`,
      '--no-first-run',
      '--skip-release-notes',
      '--skip-welcome',
      '--disable-updates',
      '--disable-workspace-trust',
      `--remote-debugging-port=${debugPort}`,
      ...(config.additionalArgs ?? [])
    ]

    if (config.workspacePath) {
      args.push(config.workspacePath)
    }

    console.log(`[KamoX] Launching VSCode with args: ${args.join(' ')}`)
    console.log(`[KamoX] Remote debugging port: ${debugPort}`)

    // spawn VSCode process
    this.childProcess = spawn(vscodePath, args, {
      env: launchEnv,
      stdio: 'pipe',
      detached: false,
    })

    this.childProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) console.log(`[KamoX] VSCode stdout: ${text}`)
    })

    this.childProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) console.error(`[KamoX] VSCode stderr: ${text}`)
    })

    this.childProcess.on('exit', (code, signal) => {
      console.log(`[KamoX] VSCode process exited: code=${code}, signal=${signal}`)
    })

    // Wait for CDP endpoint to be available
    const cdpUrl = `http://127.0.0.1:${debugPort}/json/version`
    let connected = false
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      try {
        const resp = await fetch(cdpUrl)
        if (resp.ok) {
          const info = await resp.json()
          console.log(`[KamoX] CDP endpoint available: ${JSON.stringify(info).substring(0, 200)}`)
          connected = true
          break
        }
      } catch {
        // Not ready yet
      }
      // Check if process died
      if (this.childProcess?.exitCode !== null && this.childProcess?.exitCode !== undefined) {
        throw new Error(`VSCode process exited early with code ${this.childProcess.exitCode}`)
      }
    }

    if (!connected) {
      throw new Error('Could not connect to VSCode CDP endpoint within timeout')
    }

    // Connect via Playwright CDP
    console.log('[KamoX] Connecting via CDP...')
    this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`)

    // Get the first page (VSCode workbench)
    const pages = this.browser.contexts()[0]?.pages() || []
    console.log(`[KamoX] Available pages: ${pages.length}`)

    // Wait for workbench page
    let workbenchPage = pages.find(p => p.url().includes('workbench') || p.url().includes('vscode'))
    if (!workbenchPage) {
      // Wait for a page to appear
      for (let attempt = 0; attempt < 10; attempt++) {
        const allPages = this.browser.contexts()[0]?.pages() || []
        if (allPages.length > 0) {
          workbenchPage = allPages[0]
          break
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    if (!workbenchPage) {
      throw new Error('No VSCode workbench page found')
    }

    this.page = workbenchPage
    console.log(`[KamoX] Connected to page: ${this.page.url()}`)

    // Wait for workbench to be ready
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
    try { await this.browser?.close() } catch {}
    this.browser = null
    try { this.childProcess?.kill() } catch {}
    this.childProcess = null
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
    // Check if script should run in webview (contains __WEBVIEW__ marker)
    if (script.includes('__WEBVIEW__')) {
      const cleanScript = script.replace('__WEBVIEW__', '')
      // Try all frames (including nested ones)
      const allFrames = this.page.frames()
      console.log(`[KamoX] evaluate __WEBVIEW__: trying ${allFrames.length} frames`)
      for (let i = 0; i < allFrames.length; i++) {
        const frame = allFrames[i]
        console.log(`[KamoX] Frame ${i}: url=${frame.url()?.substring(0, 100)}`)
        if (frame === this.page.mainFrame()) continue
        try {
          const result = await frame.evaluate(cleanScript)
          console.log(`[KamoX] Frame ${i} result: ${JSON.stringify(result)?.substring(0, 200)}`)
          // If result looks like it found something, return it
          if (result && result !== 'NO_PRE_IN_THIS_FRAME' && result !== 'NO_PRE') return result
        } catch (e) {
          console.log(`[KamoX] Frame ${i} error: ${(e as Error).message?.substring(0, 100)}`)
        }
      }
      // Return last result even if NO_PRE
      throw new Error('Could not find pre#ascii-output in any webview frame')
    }
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
