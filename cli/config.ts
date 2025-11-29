import fs from 'fs';
import path from 'path';

export function loadConfig(args: any) {
  let config: any = {};

  // 設定ファイルの読み込み（パストラバーサル対策）
  let configPath = args.config || 'kamox.config.json';
  
  // パストラバーサル対策: ディレクトリ部分を除去
  configPath = path.basename(configPath);
  
  // 許可されたファイル名のみ受け入れ
  const allowedConfigs = ['kamox.config.json', '.kamoxrc'];
  if (!allowedConfigs.includes(configPath)) {
    console.warn(`Invalid config file: ${configPath}. Using default: kamox.config.json`);
    configPath = 'kamox.config.json';
  }
  
  const absoluteConfigPath = path.resolve(process.cwd(), configPath);
  
  // 解決後のパスがプロジェクト内にあることを確認
  const cwd = process.cwd();
  if (!absoluteConfigPath.startsWith(cwd)) {
    console.warn('Config file must be in project directory. Using default config.');
  } else if (fs.existsSync(absoluteConfigPath)) {
    try {
      const configFile = fs.readFileSync(absoluteConfigPath, 'utf8');
      config = JSON.parse(configFile);
      console.log(`Loaded config from ${path.basename(absoluteConfigPath)}`);
    } catch (e: any) {
      console.warn(`Failed to parse config file: ${e.message}`);
    }
  }

  // buildCommandのホワイトリスト検証
  let buildCommand = args.buildCommand || config.buildCommand || 'npm run build';
  const allowedBuildCommands = [
    'npm run build',
    'npm run compile',
    'npm run bundle',
    'yarn build',
    'yarn compile',
    'pnpm build',
    'pnpm compile'
  ];
  
  if (!allowedBuildCommands.includes(buildCommand)) {
    console.warn(`Unsafe build command: ${buildCommand}. Using default: npm run build`);
    buildCommand = 'npm run build';
  }

  // CLI引数で上書き（優先順位: CLI > Config > Default）
  const finalConfig = {
    environment: (args.environment || config.environment || 'chrome') as 'chrome' | 'electron' | 'vscode',
    projectPath: args.projectPath || config.projectPath || './dist',
    port: parseInt(args.port || String(config.port) || '3000', 10),
    buildCommand: buildCommand
  };

  return finalConfig;
}
