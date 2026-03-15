import { 
  BaseDevServer, 
  ServerConfig, 
  UICheckResult, 
  ScriptCheckResult,
  PlaywrightMouseRequest,
  PlaywrightKeyboardRequest,
  PlaywrightElementRequest,
  PlaywrightWaitRequest,
  PlaywrightReloadRequest,
  PlaywrightEvaluateRequest,
  PlaywrightActionResult,
  UserAction
} from '@kamox/core';
import { IVSCodeUIDriver } from './drivers/IVSCodeUIDriver.js';
import { ExTesterDriver } from './drivers/ExTesterDriver.js';

export class VSCodeAdapter extends BaseDevServer {
  private driver: IVSCodeUIDriver;

  constructor(config: ServerConfig, driver?: IVSCodeUIDriver) {
    super(config);
    // driver未指定時はExTesterDriverをデフォルト使用
    this.driver = driver ?? new ExTesterDriver();
  }

  async launch(): Promise<void> {
    this.logger.log('info', 'Launching VSCode...', 'system');
    await this.driver.launch({
      extensionPath: this.state.config.projectPath,
      vscodePath: (this.state.config as any).vscodePath,
      workspacePath: (this.state.config as any).workspacePath
    });
    this.logger.log('info', 'VSCode launched', 'system');
  }

  async reload(): Promise<void> {
    this.logger.log('info', 'Reloading VSCode window...', 'system');
    await this.driver.executeCommand('workbench.action.reloadWindow');
  }

  async openFile(path: string): Promise<void> {
    this.logger.log('info', `Opening file: ${path}`, 'system');
    await this.driver.openFile(path);
  }

  async checkUI(options?: { url?: string; actions?: UserAction[]; scenario?: string }): Promise<UICheckResult> {
    const screenshotBuffer = await this.driver.takeScreenshot();
    const screenshotPath = await this.screenshotManager.saveScreenshot(screenshotBuffer, 'vscode-ui');
    
    return {
      loaded: true,
      screenshot: screenshotPath,
      logs: this.logger.getLogs().runtime.slice(-10),
      errors: []
    };
  }

  async checkScript(url?: string): Promise<ScriptCheckResult> {
    // VSCode環境ではスクリプト注入の概念が異なるため、一旦 success を返す
    return {
      url: url || '',
      injected: true,
      logs: []
    };
  }

  // VSCode固有メソッド（DevServerAPIがduck-typingで検出）
  async executeVSCodeCommand(id: string): Promise<void> {
    this.logger.log('info', `Executing VSCode command: ${id}`, 'system');
    await this.driver.executeCommand(id);
  }

  async getOutputLogs(channel: string): Promise<string> {
    return await this.driver.getOutputChannelText(channel);
  }

  async getVSCodeNotifications() {
    return await this.driver.getNotifications();
  }

  async dismissVSCodeNotification(message: string) {
    await this.driver.dismissNotification(message);
  }

  async getVSCodeStatusBarItem(labelPattern: string) {
    return await this.driver.getStatusBarItemText(labelPattern);
  }

  async setVSCodeActivityBarItem(label: string) {
    await this.driver.clickActivityBarItem(label);
  }

  async getVSCodeTreeView(viewId: string) {
    return await this.driver.getTreeViewItems(viewId);
  }

  async selectVSCodeQuickPick(label: string) {
    await this.driver.selectQuickPickItem(label);
  }

  async getVSCodeProblems() {
    return await this.driver.getProblems();
  }

  // Playwright API implementations (minimal for VS Code)
  async performMouseAction(request: PlaywrightMouseRequest): Promise<PlaywrightActionResult> {
    this.logger.log('warn', `Mouse actions via Playwright API not supported in VSCode environment: ${request.action}`, 'system');
    return { success: false, error: 'Mouse actions via Playwright API not supported in VSCode environment' };
  }

  async performKeyboardAction(request: PlaywrightKeyboardRequest): Promise<PlaywrightActionResult> {
    if (request.action === 'type' && request.text) {
      await this.driver.typeText(request.text);
      return { success: true };
    }
    this.logger.log('warn', `Keyboard action not supported or missing text: ${request.action}`, 'system');
    return { success: false, error: 'Keyboard action not supported or missing text' };
  }

  async performElementAction(request: PlaywrightElementRequest): Promise<PlaywrightActionResult> {
    if (request.action === 'click') {
      await this.driver.click(request.selector);
      return { success: true };
    }
    this.logger.log('warn', `Element action ${request.action} not supported`, 'system');
    return { success: false, error: `Element action ${request.action} not supported` };
  }

  async performWait(request: PlaywrightWaitRequest): Promise<PlaywrightActionResult> {
    if (request.timeout) {
      this.logger.log('info', `Waiting for ${request.timeout}ms...`, 'system');
      await new Promise(resolve => setTimeout(resolve, request.timeout));
      return { success: true };
    }
    this.logger.log('warn', 'Wait action called without timeout', 'system');
    return { success: false, error: 'Timeout is required for wait action' };
  }

  async performReload(request: PlaywrightReloadRequest): Promise<PlaywrightActionResult> {
    await this.reload();
    return { success: true };
  }

  async performEvaluate(request: PlaywrightEvaluateRequest): Promise<PlaywrightActionResult> {
    const result = await this.driver.evaluate(request.script);
    return { success: true, data: result };
  }

  protected getFeatures() {
    return {
      checkUI: true,
      checkScript: false,
      checkIPC: false,
      checkCommand: true
    };
  }
}
