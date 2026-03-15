import { ExTester, VSBrowser, NotificationType, Workbench, DEFAULT_STORAGE_FOLDER, ReleaseQuality } from 'vscode-extension-tester'
import { IVSCodeUIDriver, VSCodeLaunchConfig, NotificationInfo } from './IVSCodeUIDriver.js'

export class ExTesterDriver implements IVSCodeUIDriver {
  private exTester: ExTester | null = null

  async launch(config: VSCodeLaunchConfig): Promise<void> {
    this.exTester = new ExTester();
    
    // Setup VS Code and Driver if needed
    // downloadCode returns the path to the executable
    const downloadedPath = await this.exTester.downloadCode() as unknown;
    const vscodePath = config.vscodePath || (typeof downloadedPath === 'string' ? downloadedPath : (this.exTester as any).code.executablePath);
    
    if (!vscodePath) {
      throw new Error('Failed to determine VSCode executable path');
    }
    
    await this.exTester.downloadChromeDriver();
    
    const browser = new VSBrowser('1.111.0' as any, ReleaseQuality.Stable);
    await browser.start(vscodePath);
    await browser.waitForWorkbench();
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
    const bottomBar = await workbench.getBottomBar()
    const outputView = await bottomBar.openOutputView()
    await outputView.selectChannel(channelName)
    return await outputView.getText()
  }

  // Placeholder implementations for the rest of Step 1/2/3 to satisfy interface
  async getNotifications(): Promise<NotificationInfo[]> {
    const workbench = new Workbench()
    const center = await workbench.openNotificationsCenter()
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
    const content = await sideBar.getContent()
    const section = await content.getSection(viewId)
    const items = await section.getVisibleItems()
    return Promise.all(items.map((i: any) => i.getText()))
  }

  async selectQuickPickItem(label: string): Promise<void> {
    const workbench = new Workbench()
    const quickPick = await workbench.openCommandPrompt()
    await quickPick.setText(label)
    await quickPick.confirm()
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

  async evaluate(script: string): Promise<any> {
    const driver = VSBrowser.instance.driver
    return await driver.executeScript(script)
  }
}
