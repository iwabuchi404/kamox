import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Logger } from './logger.js';
import { BrowserContext } from 'playwright';
import { ScenarioMetadata } from '../types/common.js';

/**
 * シナリオインターフェース
 */
export interface Scenario {
  name: string;
  description?: string;
  version?: string;
  requiresPersistentContext?: boolean;
  requiresServiceWorkerInit?: boolean;
  warmup?: {
    enabled?: boolean;
    parallel?: boolean;
  };
  setup: (context: BrowserContext, logger: Logger) => Promise<void>;
  cleanup?: (context: BrowserContext, logger: Logger) => Promise<void>;
}

/**
 * シナリオローダー
 * セキュリティ対策:
 * - パストラバーサル対策
 * - 拡張子検証
 * - ディレクトリ制限
 * - エラーハンドリング
 */
export class ScenarioLoader {
  private scenariosDir: string;
  private logger: Logger;
  private readonly ALLOWED_EXTENSIONS = ['.scenario.js', '.scenario.mjs'];

  constructor(projectRoot: string, logger: Logger) {
    this.scenariosDir = path.join(projectRoot, '.kamox', 'scenarios');
    this.logger = logger;
    this.logger.log('info', `ScenarioLoader initialized with projectRoot: ${projectRoot}`, 'scenario');
    this.logger.log('info', `Scenarios directory: ${this.scenariosDir}`, 'scenario');
  }

  /**
   * シナリオファイルを読み込む
   * 
   * セキュリティ対策:
   * 1. パストラバーサル対策: ベース名のみを使用し、ディレクトリトラバーサルを防止
   * 2. 拡張子検証: 許可された拡張子のみを許可
   * 3. ディレクトリ制限: .kamox/scenarios/内のファイルのみを許可
   * 4. エラーハンドリング: 適切なエラーメッセージとログ記録
   */
  async loadScenario(scenarioName: string): Promise<Scenario> {
    try {
      // 1. パストラバーサル対策: ベース名のみを使用
      const basename = path.basename(scenarioName);
      
      // 2. 拡張子検証
      const hasValidExtension = this.ALLOWED_EXTENSIONS.some(ext => basename.endsWith(ext));
      if (!hasValidExtension) {
        const error = new Error(
          `Invalid scenario file extension. Must be one of: ${this.ALLOWED_EXTENSIONS.join(', ')}`
        );
        this.logger.log('error', error.message, 'scenario');
        throw error;
      }

      // 3. ディレクトリ制限: シナリオディレクトリ内のファイルのみ許可
      const filePath = path.join(this.scenariosDir, basename);
      const resolvedPath = path.resolve(filePath);
      const resolvedDir = path.resolve(this.scenariosDir);
      
      // パストラバーサル検出: 解決後のパスがシナリオディレクトリ内にあることを確認
      if (!resolvedPath.startsWith(resolvedDir + path.sep) && resolvedPath !== resolvedDir) {
        const error = new Error('Path traversal detected: Scenario files must be in .kamox/scenarios/');
        this.logger.log('error', error.message, 'scenario');
        throw error;
      }

      // 4. ファイル存在確認
      if (!fs.existsSync(resolvedPath)) {
        const error = new Error(`Scenario file not found: ${basename}`);
        this.logger.log('error', error.message, 'scenario');
        throw error;
      }

      // 5. シナリオを読み込む
      this.logger.log('info', `Loading scenario: ${basename}`, 'scenario');
      
      try {
        const module = await import(pathToFileURL(resolvedPath).href);
        const scenario = module.default;

        // 6. シナリオ形式の検証
        if (!scenario || typeof scenario.setup !== 'function') {
          const error = new Error(
            'Invalid scenario format: must export default object with setup function'
          );
          this.logger.log('error', error.message, 'scenario');
          throw error;
        }

        // 7. versionフィールドの検証（オプションだが推奨）
        if (scenario.version && typeof scenario.version !== 'string') {
          this.logger.log('warn', 'Scenario version should be a string', 'scenario');
        }

        const loadedScenario: Scenario = {
          name: scenario.name || basename.replace(/\.scenario\.(js|mjs)$/, ''),
          description: scenario.description,
          version: scenario.version,
          requiresPersistentContext: scenario.requiresPersistentContext || false,
          requiresServiceWorkerInit: scenario.requiresServiceWorkerInit || false,
          warmup: scenario.warmup,
          setup: scenario.setup,
          cleanup: scenario.cleanup
        };

        this.logger.log('info', `Scenario loaded: ${loadedScenario.name}`, 'scenario');
        return loadedScenario;
      } catch (importError: any) {
        const error = new Error(`Failed to import scenario file: ${importError.message}`);
        this.logger.log('error', error.message, 'scenario');
        throw error;
      }
    } catch (error: any) {
      // エラーハンドリング: すべてのエラーを適切に処理
      if (error.message) {
        throw error; // 既に適切なエラーメッセージが設定されている
      }
      const genericError = new Error(`Unexpected error loading scenario: ${error}`);
      this.logger.log('error', genericError.message, 'scenario');
      throw genericError;
    }
  }

  /**
   * 利用可能なシナリオ一覧を取得（名前のみ）
   */
  listScenarios(): string[] {
    try {
      this.logger.log('info', `Checking scenarios directory: ${this.scenariosDir}`, 'scenario');
      if (!fs.existsSync(this.scenariosDir)) {
        this.logger.log('warn', `Scenarios directory does not exist: ${this.scenariosDir}`, 'scenario');
        return [];
      }

      const files = fs.readdirSync(this.scenariosDir);
      this.logger.log('info', `Found ${files.length} files in scenarios directory`, 'scenario');
      return files
        .filter(file => {
          const hasValidExtension = this.ALLOWED_EXTENSIONS.some(ext => file.endsWith(ext));
          // ディレクトリではなくファイルであることを確認
          const filePath = path.join(this.scenariosDir, file);
          return hasValidExtension && fs.statSync(filePath).isFile();
        })
        .map(file => file.replace(/\.scenario\.(js|mjs)$/, ''));
    } catch (error: any) {
      this.logger.log('error', `Failed to list scenarios: ${error.message}`, 'scenario');
      return [];
    }
  }

  /**
   * シナリオメタデータ一覧を取得
   */
  async listScenariosWithMetadata(): Promise<ScenarioMetadata[]> {
    try {
      const scenarioNames = this.listScenarios();
      const metadata: ScenarioMetadata[] = [];

      for (const name of scenarioNames) {
        try {
          const scenario = await this.loadScenario(`${name}.scenario.js`);
          metadata.push({
            name: scenario.name,
            description: scenario.description,
            version: scenario.version,
            requiresPersistentContext: scenario.requiresPersistentContext,
            requiresServiceWorkerInit: scenario.requiresServiceWorkerInit,
            warmup: scenario.warmup
          });
        } catch (error: any) {
          // 読み込みに失敗したシナリオはスキップ
          this.logger.log('warn', `Failed to load metadata for scenario ${name}: ${error.message}`, 'scenario');
        }
      }

      return metadata;
    } catch (error: any) {
      this.logger.log('error', `Failed to list scenarios with metadata: ${error.message}`, 'scenario');
      return [];
    }
  }

  /**
   * シナリオディレクトリのパスを取得
   */
  getScenariosDir(): string {
    return this.scenariosDir;
  }

  /**
   * シナリオディレクトリが存在するか確認
   */
  scenariosDirExists(): boolean {
    return fs.existsSync(this.scenariosDir);
  }
}

