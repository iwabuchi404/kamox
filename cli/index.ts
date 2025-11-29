#!/usr/bin/env node
import { Command } from 'commander';
import { DevServerAPI } from '@kamox/core/dist/DevServerAPI.js';
import { ChromeExtensionAdapter } from '@kamox/plugin-chrome/dist/ChromeExtensionAdapter.js';
import { ConfigLoader } from '@kamox/core/dist/utils/ConfigLoader.js';
import { ProjectDetector } from '@kamox/core/dist/utils/ProjectDetector.js';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();
// Read package.json to get version
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

program
  .name('kamox')
  .description('Web Extension Dev Server')
  .version(packageJson.version);

program
  .command('chrome')
  .description('Start dev server for Chrome Extension')
  .option('-p, --port <number>', 'Server port')
  .option('-o, --output <path>', 'Build output directory')
  .option('-b, --build-command <command>', 'Build command')
  .option('-c, --config <path>', 'Path to config file')
  .option('--verbose', 'Show detailed configuration and logs')
  .option('--auto-build', 'Automatically build project if output directory is missing')
  .action(async (options) => {
    try {
      const cwd = process.cwd();
      const loader = new ConfigLoader(cwd);
      
      const { config, source } = loader.load({
        mode: 'chrome',
        port: options.port ? parseInt(options.port) : undefined,
        output: options.output,
        buildCommand: options.buildCommand,
        configPath: options.config
      });

      console.log(`KamoX v${packageJson.version}`);
      console.log(`Project:  ${cwd}`);
      
      if (options.verbose) {
        console.log(`Config:   ${source}`);
        console.log('  ├─ mode:         ' + (options.mode ? 'from CLI' : `from ${source.split('+')[1] || 'default'}`));
        console.log('  ├─ output:       ' + (options.output ? 'from CLI' : `from ${source.split('+')[1] || 'default'}`));
        console.log('  ├─ port:         ' + (options.port ? 'from CLI' : `from ${source.split('+')[1] || 'default'}`));
        console.log('  └─ buildCommand: ' + (options.buildCommand ? 'from CLI' : `from ${source.split('+')[1] || 'default'}`));
      } else {
        console.log(`Config:   ${source}`);
      }
      
      console.log(`Output:   ${config.output}`);
      console.log(`Port:     ${config.port}`);
      console.log('');

      // Validate output directory
      const outputPath = path.resolve(cwd, config.output || 'dist');
      if (!fs.existsSync(outputPath)) {
        console.warn(`⚠️  Output directory not found: ${outputPath}`);
        
        if (options.autoBuild) {
          console.log('');
          console.log(`Running build command: ${config.buildCommand}`);
          const { execSync } = await import('child_process');
          try {
            execSync(config.buildCommand || 'npm run build', { cwd, stdio: 'inherit' });
            console.log('✓ Build completed successfully');
            console.log('');
          } catch (e: any) {
            console.error('✗ Build failed');
            console.error('');
            console.error('Please fix build errors and try again.');
            process.exit(1);
          }
        } else {
          console.warn('');
          console.warn('Please build your project first:');
          console.warn(`  ${config.buildCommand}`);
          console.warn('');
          console.warn('Or use --auto-build to build automatically:');
          console.warn(`  kamox chrome --auto-build`);
          console.warn('');
          console.warn('Attempting to continue anyway...');
          console.warn('');
        }
      }

      // Initialize Adapter
      const adapterConfig = {
        projectPath: outputPath,
        buildCommand: config.buildCommand,
        workDir: cwd,
        environment: config.mode,
      };

      const adapter = new ChromeExtensionAdapter(adapterConfig as any);
      
      console.log('Launching Chrome...');
      await adapter.launch();

      const status = adapter.getStatus();
      const projectName = status.projectName || 'Extension';
      
      console.log('');
      console.log(`✓ Chrome launched successfully`);
      console.log(`✓ Extension loaded: ${projectName}`);
      console.log('');
      console.log(`🌐 Dashboard:  http://localhost:${config.port}/`);
      console.log(`📡 API Status: http://localhost:${config.port}/status`);
      console.log(`📖 AI Guide:   https://github.com/yourorg/kamox/blob/main/docs/ai-usage.md`);
      console.log('');
      console.log('Press Ctrl+C to stop');
      console.log('');

      const api = new DevServerAPI(adapter);
      api.start(config.port);

    } catch (error: any) {
      console.error('');
      console.error('✗ Fatal error:', error.message);
      console.error('');
      
      // Provide helpful error messages
      if (error.message.includes('manifest.json')) {
        console.error('Possible causes:');
        console.error('  1. manifest.json not found in output directory');
        console.error('  2. Invalid manifest.json format');
        console.error('  3. Output directory path is incorrect');
        console.error('');
        console.error('Debug steps:');
        console.error('  1. Check if project is built: ls dist/manifest.json');
        console.error('  2. Verify output directory: kamox chrome --output ./your-output-dir');
        console.error('  3. Try auto-detection: kamox detect');
        console.error('');
      } else if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        console.error('Possible causes:');
        console.error('  1. Output directory does not exist');
        console.error('  2. Project has not been built');
        console.error('');
        console.error('Debug steps:');
        console.error('  1. Build your project first: npm run build');
        console.error('  2. Use auto-build: kamox chrome --auto-build');
        console.error('  3. Check project structure: kamox detect');
        console.error('');
      }
      
      console.error('Need help? See https://github.com/yourorg/kamox#troubleshooting');
      console.error('');
      process.exit(1);
    }
  });

program
  .command('detect')
  .description('Detect project type and show recommended configuration')
  .action(() => {
    const cwd = process.cwd();
    const detector = new ProjectDetector();
    
    const type = detector.detectProjectType(cwd);
    const output = detector.detectOutputDir(cwd);
    const buildCmd = detector.detectBuildCommand(cwd);
    
    console.log('KamoX Project Detection');
    console.log('=======================');
    console.log('');
    console.log(`Project directory: ${cwd}`);
    console.log(`Detected type:     ${type || 'Unknown'}`);
    console.log(`Output directory:  ${output}`);
    console.log(`Build command:     ${buildCmd || 'Not found'}`);
    console.log('');
    
    if (type) {
      console.log('✓ Recommended command:');
      console.log(`  kamox ${type}`);
      console.log('');
      console.log('💡 Tip: Create kamox.config.json for easier usage:');
      console.log(JSON.stringify({
        mode: type,
        output: `./${output}`,
        buildCommand: buildCmd || 'npm run build'
      }, null, 2));
    } else {
      console.log('⚠️  Could not detect project type.');
      console.log('');
      console.log('Please create kamox.config.json manually:');
      console.log(JSON.stringify({
        mode: 'chrome',  // or 'electron', 'vscode'
        output: './dist',
        buildCommand: 'npm run build'
      }, null, 2));
    }
    console.log('');
  });

program.parse();
