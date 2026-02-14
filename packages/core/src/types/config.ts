export interface KamoxConfig {
  mode?: 'chrome' | 'electron' | 'vscode';
  output?: string;
  buildCommand?: string;
  port?: number;
  entryPoint?: string;
  
  chrome?: {
    testUrls?: string[];
    popupViewport?: {
      width: number;
      height: number;
    };
  };
  
  screenshots?: {
    directory?: string;
    retentionTime?: number;
    autoCleanup?: boolean;
  };
}

export interface ConfigSource {
  config: KamoxConfig;
  source: string; // 'cli' | 'file' | 'package.json' | 'default'
}
