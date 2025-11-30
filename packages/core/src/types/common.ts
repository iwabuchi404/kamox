export interface ServerConfig {
  port: number;
  projectPath: string;
  buildCommand?: string;
  environment: 'chrome' | 'electron' | 'vscode';
  workDir?: string;
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
}

// Playwright API types
export interface PlaywrightMouseRequest {
  action: 'click' | 'move' | 'down' | 'up' | 'drag';
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  toX?: number;
  toY?: number;
}

export interface PlaywrightKeyboardRequest {
  action: 'type' | 'press';
  text?: string;
  key?: string;
}

export interface PlaywrightElementRequest {
  selector: string;
  action: 'click' | 'fill' | 'select' | 'check' | 'uncheck';
  value?: string;
  timeout?: number;
}

export interface PlaywrightWaitRequest {
  type: 'selector' | 'timeout' | 'networkIdle';
  selector?: string;
  duration?: number;
  timeout?: number;
}

export interface PlaywrightReloadRequest {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface PlaywrightActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

