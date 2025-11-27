import { UICheckResult, ScriptCheckResult } from '@kamox/core/dist/types/common.js';

export interface PopupCheckResult extends UICheckResult {
  // Chrome固有の拡張があればここに追加
}

export interface ContentScriptCheckResult extends ScriptCheckResult {
  // Chrome固有の拡張があればここに追加
}
