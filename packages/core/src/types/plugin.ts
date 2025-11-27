import { RebuildResult, UICheckResult, ScriptCheckResult } from './common.js';

export interface IDevServer {
  launch(): Promise<void>;
  reload(): Promise<void>;
  rebuild(): Promise<RebuildResult>;
  checkUI(options?: { url?: string }): Promise<UICheckResult>;
  checkScript(url?: string): Promise<ScriptCheckResult>;
}
