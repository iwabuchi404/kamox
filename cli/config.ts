import fs from 'fs';
import path from 'path';
import { ServerConfig } from '@kamox/core/dist/types/common.js';

export interface CLIArgs {
  environment?: 'chrome' | 'electron' | 'vscode';
  projectPath?: string;
  port?: string;
  config?: string;
  buildCommand?: string;
}

export function loadConfig(args: CLIArgs): ServerConfig {
  let config: Partial<ServerConfig> = {};

  // 設定ファイルの読み込み
  const configPath = args.config || 'kamox.config.json';
  const absoluteConfigPath = path.resolve(process.cwd(), configPath);

  if (fs.existsSync(absoluteConfigPath)) {
    try {
      const configFile = fs.readFileSync(absoluteConfigPath, 'utf8');
      config = JSON.parse(configFile);
      console.log(`Loaded config from ${absoluteConfigPath}`);
    } catch (e) {
      console.warn(`Failed to parse config file: ${absoluteConfigPath}`);
    }
  }

  // CLI引数で上書き（優先順位: CLI > Config > Default）
  const finalConfig: ServerConfig = {
    environment: (args.environment || config.environment || 'chrome') as any,
    projectPath: args.projectPath || config.projectPath || './dist',
    port: parseInt(args.port || String(config.port) || '3000', 10),
    buildCommand: args.buildCommand || config.buildCommand || 'npm run build'
  };

  return finalConfig;
}
