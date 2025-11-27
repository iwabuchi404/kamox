import fs from 'fs';
import path from 'path';

export interface DevManifestOptions {
  addPermissions?: string[];
  relaxCSP?: boolean;
  addDevPrefix?: boolean;
}

/**
 * 開発用のmanifest.jsonを生成する
 */
export function generateDevManifest(
  originalManifestPath: string,
  outputPath: string,
  options: DevManifestOptions = {}
): void {
  const manifest = JSON.parse(fs.readFileSync(originalManifestPath, 'utf8'));
  
  // 1. Background Service Workerを追加（なければ）
  if (!manifest.background) {
    manifest.background = {
      service_worker: '_kamox_background.js'
    };
  }
  // 既存のbackgroundがある場合はそのまま保持（Extension ID取得のため）
  
  // 2. 開発に必要な権限を追加
  const defaultDevPermissions = ['tabs', 'activeTab'];
  const devPermissions = [...defaultDevPermissions, ...(options.addPermissions || [])];
  manifest.permissions = [...new Set([...(manifest.permissions || []), ...devPermissions])];
  
  // 3. Content Security Policyを緩和（開発時のみ）
  if (options.relaxCSP !== false) {
    if (!manifest.content_security_policy) {
      manifest.content_security_policy = {};
    }
    // Manifest V3ではunsafe-evalは禁止されているため、object-srcのみ緩和
    manifest.content_security_policy.extension_pages = 
      "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline';";
  }
  
  // 4. 開発用の識別子を追加
  if (options.addDevPrefix !== false) {
    manifest.name = `[DEV] ${manifest.name}`;
    if (manifest.version) {
      // バージョンに.devサフィックスを追加（セマンティックバージョニング対応）
      manifest.version = `${manifest.version}.0`;
    }
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
}

/**
 * 最小限の開発用background.jsを生成する
 */
export function generateDevBackground(outputPath: string): void {
  const code = `// KamoX Development Background Worker
// This file is auto-generated for development purposes only
// DO NOT EDIT - This file will be regenerated on each KamoX startup

chrome.runtime.onInstalled.addListener(() => {
  console.log('[KamoX] Development mode active');
});

// タブ情報へのアクセスを可能にする
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'kamox:getTabInfo') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ success: true, tab: tabs[0] });
    });
    return true; // 非同期レスポンス
  }
  
  if (request.action === 'kamox:getAllTabs') {
    chrome.tabs.query({}, (tabs) => {
      sendResponse({ success: true, tabs });
    });
    return true;
  }
});
`;
  
  fs.writeFileSync(outputPath, code);
}

/**
 * プロジェクトファイルを開発ディレクトリにコピーする
 */
export function copyProjectFiles(srcDir: string, destDir: string, excludes: string[] = []): void {
  const defaultExcludes = ['.kamox', 'node_modules', '.git', '.DS_Store'];
  const allExcludes = [...defaultExcludes, ...excludes];
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  const files = fs.readdirSync(srcDir);
  
  for (const file of files) {
    if (allExcludes.includes(file)) {
      continue;
    }
    
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else if (file !== 'manifest.json') {
      // manifest.json以外をコピー（manifest.jsonは別途生成）
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * .gitignoreに.kamoxを追加する
 */
export function updateGitignore(projectPath: string): void {
  const gitignorePath = path.join(projectPath, '.gitignore');
  
  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf8');
  }
  
  if (!content.includes('.kamox')) {
    const newContent = content + '\n# KamoX development files\n.kamox/\n';
    fs.writeFileSync(gitignorePath, newContent);
  }
}

/**
 * 開発ディレクトリをクリーンアップする
 */
export function cleanupDevDirectory(devDir: string): void {
  if (fs.existsSync(devDir)) {
    fs.rmSync(devDir, { recursive: true, force: true });
  }
}
