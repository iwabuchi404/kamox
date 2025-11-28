export interface ServerConfig {
  port: number;
  projectPath: string;
  buildCommand?: string;
  environment: 'chrome' | 'electron' | 'vscode';
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
