import { 
  RebuildResult, 
  UICheckResult, 
  ScriptCheckResult, 
  UserAction,
  PlaywrightMouseRequest,
  PlaywrightKeyboardRequest,
  PlaywrightElementRequest,
  PlaywrightWaitRequest,
  PlaywrightReloadRequest,
  PlaywrightEvaluateRequest,
  PlaywrightActionResult
} from './common.js';

export interface IDevServer {
  launch(): Promise<void>;
  reload(): Promise<void>;
  rebuild(): Promise<RebuildResult>;
  checkUI(options?: { url?: string; actions?: UserAction[]; scenario?: string }): Promise<UICheckResult>;
  checkScript(url?: string): Promise<ScriptCheckResult>;
  
  // Playwright Actions
  performMouseAction(request: PlaywrightMouseRequest): Promise<PlaywrightActionResult>;
  performKeyboardAction(request: PlaywrightKeyboardRequest): Promise<PlaywrightActionResult>;
  performElementAction(request: PlaywrightElementRequest): Promise<PlaywrightActionResult>;
  performWait(request: PlaywrightWaitRequest): Promise<PlaywrightActionResult>;
  performReload(request: PlaywrightReloadRequest): Promise<PlaywrightActionResult>;
  performEvaluate(request: PlaywrightEvaluateRequest): Promise<PlaywrightActionResult>;
  
  getEnvironment(): string;
}
