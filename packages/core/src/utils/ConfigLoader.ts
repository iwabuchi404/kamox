import path from 'path';
import fs from 'fs';
import { KamoxConfig, ConfigSource } from '../types/config.js';

export class ConfigLoader {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  load(cliOptions: Partial<KamoxConfig> & { configPath?: string }): ConfigSource {
    // 1. Load from file (if specified or default)
    let fileConfig: KamoxConfig = {};
    let fileSource = '';

    if (cliOptions.configPath) {
      const configPath = path.resolve(this.cwd, cliOptions.configPath);
      if (fs.existsSync(configPath)) {
        fileConfig = this.readConfig(configPath);
        fileSource = configPath;
      } else {
        throw new Error(`Config file not found: ${configPath}`);
      }
    } else {
      // Try default locations
      const defaultPath = path.join(this.cwd, 'kamox.config.json');
      if (fs.existsSync(defaultPath)) {
        fileConfig = this.readConfig(defaultPath);
        fileSource = defaultPath;
      } else {
        // Try package.json
        const pkgPath = path.join(this.cwd, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.kamox) {
            fileConfig = pkg.kamox;
            fileSource = 'package.json';
          }
        }
      }
    }

    // 2. Merge with defaults and CLI options
    // Priority: CLI > File > Default
    const mergedConfig: KamoxConfig = {
      mode: cliOptions.mode || fileConfig.mode || 'chrome', // Default to chrome for now
      output: cliOptions.output || fileConfig.output || 'dist',
      buildCommand: cliOptions.buildCommand || fileConfig.buildCommand || 'npm run build',
      port: cliOptions.port || fileConfig.port || 3000,
      
      chrome: {
        ...fileConfig.chrome,
        ...cliOptions.chrome
      },
      
      screenshots: {
        directory: '.kamox/screenshots',
        retentionTime: 3600000,
        autoCleanup: true,
        ...fileConfig.screenshots,
        ...cliOptions.screenshots
      }
    };

    return {
      config: mergedConfig,
      source: cliOptions.configPath ? 'cli+file' : (fileSource ? `cli+${path.basename(fileSource)}` : 'cli+default')
    };
  }

  private readConfig(filePath: string): KamoxConfig {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e: any) {
      throw new Error(`Failed to parse config file ${filePath}: ${e.message}`);
    }
  }
}
