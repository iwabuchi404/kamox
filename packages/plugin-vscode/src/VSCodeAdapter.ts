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

  // Playwright API implementations (minimal for VS Code)
  async performMouseAction(request: PlaywrightMouseRequest): Promise<PlaywrightActionResult> {
    return { success: false, error: 'Mouse actions via Playwright API not supported in VSCode environment' };
  }

  async performKeyboardAction(request: PlaywrightKeyboardRequest): Promise<PlaywrightActionResult> {
    if (request.action === 'type' && request.text) {
      await this.driver.typeText(request.text);
      return { success: true };
    }
    return { success: false, error: 'Keyboard action not supported or missing text' };
  }

  async performElementAction(request: PlaywrightElementRequest): Promise<PlaywrightActionResult> {
    if (request.action === 'click') {
      await this.driver.click(request.selector);
      return { success: true };
    }
    return { success: false, error: `Element action ${request.action} not supported` };
  }

  async performWait(request: PlaywrightWaitRequest): Promise<PlaywrightActionResult> {
    return { success: false, error: 'Wait action not supported' };
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
