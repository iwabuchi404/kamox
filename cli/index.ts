#!/usr/bin/env node
import { Command } from 'commander';
import { DevServerAPI } from '@kamox/core/dist/DevServerAPI.js';
import { ChromeExtensionAdapter } from '@kamox/plugin-chrome/dist/ChromeExtensionAdapter.js';
import { loadConfig } from './config.js';
import path from 'path';

const program = new Command();

program
  .name('kamox')
  .description('Web Extension Dev Server')
  .version('0.1.0');

console.log('Raw argv:', process.argv);

program
  .command('chrome')
  .description('Start dev server for Chrome Extension')
  .option('-p, --project-path <path>', 'Path to extension directory (dist)')
  .option('--port <number>', 'Port number', '3000')
  .option('-c, --config <path>', 'Path to config file')
  .option('--build-command <command>', 'Build command to run on rebuild')
  .action(async (options) => {
    try {
      const config = loadConfig({
        environment: 'chrome',
        ...options
      });

      console.log('Starting KamoX for Chrome Extension...');
      console.log('Config:', JSON.stringify(config, null, 2));

      const adapter = new ChromeExtensionAdapter(config);
      
      // 初回起動
      await adapter.launch();

      const api = new DevServerAPI(adapter);
      api.start(config.port);

    } catch (error: any) {
      console.error('Fatal error:', error.message);
      process.exit(1);
    }
  });

program.parse();
