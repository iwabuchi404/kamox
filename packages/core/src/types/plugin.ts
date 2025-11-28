import { RebuildResult, UICheckResult, ScriptCheckResult, UserAction } from './common.js';

export interface IDevServer {
  launch(): Promise<void>;
  reload(): Promise<void>;
  rebuild(): Promise<RebuildResult>;
  checkUI(options?: { url?: string; actions?: UserAction[] }): Promise<UICheckResult>;
  checkScript(url?: string): Promise<ScriptCheckResult>;
}
