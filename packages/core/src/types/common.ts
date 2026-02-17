export interface ServerConfig {
  port: number;
  projectPath: string;
  buildCommand?: string;
  environment: 'chrome' | 'electron' | 'vscode';
  workDir?: string;
  entryPoint?: string;
}

export interface LogEntry {
  timestamp: number;
  type: 'log' | 'info' | 'warn' | 'error' | 'debug';
  content: string;
  source: string;
}

export interface LogCollection {
  build: LogEntry[];
  runtime: LogEntry[];
  pages: { [pageId: string]: LogEntry[] };
}

export interface ServerState {
  isRebuilding: boolean;
  logs: LogCollection;
  config: ServerConfig;
}

export interface RebuildResult {
  success: boolean;
  logs: LogEntry[];
  buildTime: number;
}

export interface UICheckResult {
  loaded: boolean;
  screenshot: string;
  dom?: any;
  logs: LogEntry[];
  errors: string[];
  performance?: {
    loadTime: number;
  };
  scenario?: {
    name: string;
    logs: LogEntry[];
    executionTime: number;
  };
}

export interface UserAction {
  type: 'click' | 'type' | 'wait' | 'drag' | 'scroll';
  selector?: string;
  text?: string;
  ms?: number;
  source?: string;
  target?: string;
  x?: number;
  y?: number;
}

export interface ScriptCheckResult {
  url: string;
  injected: boolean;
  checks?: any;
  screenshot?: string;
  logs: LogEntry[];
}

export interface ServerStatus {
  serverRunning: boolean;
  environment: string;
  isRebuilding: boolean;
  buildCount: number;
  lastBuildTime: string | null;
  features: {
    checkUI: boolean;
    checkScript: boolean;
    checkIPC: boolean;
    checkCommand: boolean;
  };
  projectName?: string;
  windows?: Array<{ index: number; title: string }>;
}

// Playwright API types
// windowIndex / windowTitle は Electron マルチウィンドウ対応用（Chrome では無視される）
export interface PlaywrightMouseRequest {
  action: 'click' | 'move' | 'down' | 'up' | 'drag';
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  toX?: number;
  toY?: number;
  windowIndex?: number;
  windowTitle?: string;
}

export interface PlaywrightKeyboardRequest {
  action: 'type' | 'press';
  text?: string;
  key?: string;
  windowIndex?: number;
  windowTitle?: string;
}

export interface PlaywrightElementRequest {
  selector: string;
  action: 'click' | 'fill' | 'select' | 'check' | 'uncheck' | 'textContent' | 'innerHTML' | 'isVisible' | 'getAttribute';
  value?: string;
  attribute?: string;
  timeout?: number;
  windowIndex?: number;
  windowTitle?: string;
}

export interface PlaywrightWaitRequest {
  type: 'selector' | 'timeout' | 'networkIdle';
  selector?: string;
  duration?: number;
  timeout?: number;
  windowIndex?: number;
  windowTitle?: string;
}

export interface PlaywrightReloadRequest {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
  windowIndex?: number;
  windowTitle?: string;
}

export interface PlaywrightEvaluateRequest {
  script: string;
  arg?: any;
  windowIndex?: number;
  windowTitle?: string;
}

export interface PlaywrightActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

// Scenario types
export interface ScenarioMetadata {
  name: string;
  description?: string;
  version?: string;
  requiresPersistentContext?: boolean;
  requiresServiceWorkerInit?: boolean;
  warmup?: {
    enabled?: boolean;
    parallel?: boolean;
  };
}

export interface ScenarioExecutionResult {
  success: boolean;
  logs: LogEntry[];
  executionTime: number;
  error?: string;
}