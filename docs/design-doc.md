# Chrome拡張開発支援ツール 設計ドキュメント v2.0

## 1. エグゼクティブサマリー

### プロジェクト名
**Web Extension Dev Server (KamoX)** - Web系非ブラウザ環境のための統合開発支援サーバー

### 一行説明
AIコーディングエージェントがChrome拡張機能・Electronアプリ・VSCode拡張をライブで確認しながら開発できる、プラグイン型HTTP APIサーバー

### 解決する問題
通常のWeb開発ではMCPやPlaywrightでブラウザを直接操作できるが、Chrome拡張・Electron・VSCode拡張は特殊な環境で動作するため、AIエージェントが自律的に動作確認できない。これにより開発サイクルが「コード修正→手動確認→フィードバック」という人間介入必須のループになっている。

---

## 2. コンセプト

### 2.1 核となるアイデア

**「特殊な実行環境をAIがアクセス可能な統一APIとして公開する」**

3つの環境の共通課題：
- 通常のブラウザDevToolsが使えない/使いにくい
- Hot reloadが困難または不完全
- AIエージェントが直接操作できない

これらを**プラグイン型アーキテクチャ**で統一的に解決する。

### 2.2 設計哲学

#### プラグイン型アーキテクチャ
```
Core (共通基盤: 70%)
  ├─ HTTP API Layer
  ├─ Base Dev Server (抽象クラス)
  └─ 共通ユーティリティ
  
Plugins (環境固有: 30%)
  ├─ Chrome Extension Adapter
  ├─ Electron Adapter
  └─ VSCode Extension Adapter (将来)
```

#### Phase分離戦略
```
Phase 1: Core + Chrome Extension (Week 1-2)
  - 最速で実用化
  - 実戦投入・フィードバック収集
  
Phase 2: Electron Plugin (Week 3-4)
  - プラグイン追加
  - Chrome拡張の知見を活用
  
Phase 3: VSCode Extension Plugin (将来)
  - 必要になってから実装
  
Phase 4: MCP対応
  - HTTP APIをラップ
```

#### コア処理の独立性
```javascript
// 拡張性を考慮した設計
BaseDevServer (抽象基底クラス)
  ↑
  ├── ChromeExtensionAdapter
  ├── ElectronAdapter
  └── VSCodeExtensionAdapter (将来)
  
DevServerAPI
  ↓
  ├── HTTP Server (Phase 1)
  └── MCP Server (Phase 4)
```

### 2.3 非目標（やらないこと）

- ❌ 本番デプロイ用のテスト自動化（Jest/Playwright Test等が適切）
- ❌ ストアへの公開自動化（Chrome Web Store, VSCode Marketplace等）
- ❌ 複数プロジェクトの同時開発
- ❌ headlessモード対応（技術的制約により不可能）
- ❌ 完全なCI/CD統合（Phase 1では対象外）

---

## 3. 目的

### 3.1 主目的

**AIコーディングエージェントによる自律的な開発サイクルの実現**

```
従来（人間介入必須）:
AI修正 → 人間がビルド → 人間がリロード → 人間が確認 → 人間がフィードバック → AI修正
サイクルタイム: 5-10分

KamoX導入後:
AI修正 → API: rebuild → API: check → AI判断 → AI修正
サイクルタイム: 10-30秒
```

### 3.2 副次的目的

1. **開発体験の向上**: 手動確認の手間削減
2. **フィードバック品質向上**: 構造化されたJSON出力
3. **再現性**: スクリーンショット・ログの自動保存
4. **学習コスト削減**: HTTP APIなのでcurlで即座に試せる
5. **環境間の知識共有**: 一度学べば他の環境にも応用可能

---

## 4. ユースケース

### 4.1 主要ユースケース

#### UC-1: Chrome拡張のPopup UI実装（AIによる段階的開発）

**アクター**: AIコーディングエージェント

**前提条件**:
- Chrome拡張プロジェクトが存在
- KamoXがChrome拡張モードで起動済み

**正常フロー**:
1. AIがPopupのUIコードを生成
2. API `POST /rebuild` でビルド
3. API `POST /check-ui` で確認
4. レスポンスのスクリーンショットとDOM情報を解析
5. 問題があれば修正してステップ2へ
6. 問題なければ次の機能へ

**期待結果**:
- 人間の介入なしで「実装→確認→修正」ループが回る
- 各ステップの証跡が保存される

**頻度**: 開発中は1機能あたり5-20回のループ

---

#### UC-2: Electronアプリのウィンドウ表示確認

**アクター**: AIコーディングエージェント

**前提条件**:
- Electronプロジェクトが存在
- KamoXがElectronモードで起動済み

**正常フロー**:
1. AIがRendererプロセスのコードを修正
2. API `POST /rebuild`
3. API `POST /check-ui` でウィンドウ表示確認
4. API `POST /check-ipc` でIPC通信確認（Electron特有）
5. スクリーンショットとログで動作確認

**期待結果**:
- Main ProcessとRenderer Processの両方を確認
- IPC通信の動作も自動検証

**頻度**: Electron開発時に10-30回

---

#### UC-3: 環境横断的なコンポーネント開発

**アクター**: 開発者 + AIコーディングエージェント

**シナリオ**:
同じUIコンポーネントをChrome拡張とElectronで使いたい

**正常フロー**:
1. Chrome拡張で実装・確認（KamoX Chrome mode）
2. Electronに移植
3. KamoX Electron modeで確認
4. 差異があれば調整

**期待結果**:
- 統一されたAPI仕様により、確認フローが同じ
- 環境差異を早期発見

**頻度**: クロスプラットフォーム開発時

---

### 4.2 環境別ユースケース

#### Chrome拡張固有

**UC-4: Content Scriptのページ注入確認**
- 特定URLでのContent Script動作確認
- DOM操作結果の視覚的確認
- ページリロード時の動作確認

**UC-5: Service Workerのイベント処理**
- Background処理のログ確認
- `chrome.*` API呼び出しの検証
- 権限エラーの検出

---

#### Electron固有

**UC-6: IPC通信の確認**
- Main ⇔ Renderer間の通信確認
- Preloadスクリプトの動作検証
- セキュリティ設定の確認

**UC-7: ネイティブモジュール統合**
- Node.jsモジュールの動作確認
- ファイルシステムアクセス
- システムトレイ・通知等のOS統合

---

#### VSCode拡張固有（将来）

**UC-8: コマンドパレット動作確認**
- 登録コマンドの実行
- WebView表示確認
- エディタ操作の検証

---

### 4.3 エッジケース

#### UC-9: 権限不足の検出

**シナリオ（Chrome拡張）**:
`chrome.storage` APIを使うが、manifestに権限がない

**期待動作**:
1. `POST /check-ui`
2. レスポンスの `errors` に権限エラーが記録
3. AIがmanifest.jsonに `"permissions": ["storage"]` を追加

**シナリオ（Electron）**:
`fs`モジュールを使うが、nodeIntegrationが無効

**期待動作**:
1. `POST /check-ui`
2. レスポンスの `errors` に `fs is not defined` エラー
3. AIがwebPreferencesを修正

---

## 5. システムアーキテクチャ

### 5.1 全体構成図

```
┌─────────────────────────────────────────────────────┐
│ AI Coding Agent (Claude, GPT, Duckflow etc.)       │
└────────────────┬────────────────────────────────────┘
                 │ HTTP Requests (JSON)
                 ↓
┌─────────────────────────────────────────────────────┐
│ Web Extension Dev Server (KamoX)                     │
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ HTTP API Layer (Express.js)                     │ │
│ │  - POST /rebuild                                │ │
│ │  - POST /check-ui                               │ │
│ │  - POST /check-script                           │ │
│ │  - GET  /logs                                   │ │
│ │  - GET  /screenshot/:target                     │ │
│ │  + Plugin-specific endpoints                    │ │
│ └──────────────┬──────────────────────────────────┘ │
│                ↓                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Core: BaseDevServer (抽象クラス)                 │ │
│ │  - rebuild() - 共通                             │ │
│ │  - takeScreenshot() - 共通                       │ │
│ │  - collectLogs() - 共通                         │ │
│ │  + launch() - 抽象メソッド                       │ │
│ │  + reload() - 抽象メソッド                       │ │
│ │  + checkUI() - 抽象メソッド                      │ │
│ └──────────────┬──────────────────────────────────┘ │
│                ↓                                     │
│ ┌──────────────┴──────────────────────────────────┐ │
│ │ Plugins (Adapters)                              │ │
│ │                                                  │ │
│ │ ┌──────────────────┐  ┌──────────────────┐    │ │
│ │ │ Chrome Extension │  │ Electron Adapter │    │ │
│ │ │ Adapter          │  │                  │    │ │
│ │ │                  │  │ + checkIPC()     │    │ │
│ │ │ + checkPopup()   │  │                  │    │ │
│ │ │ + checkContent() │  │                  │    │ │
│ │ └──────────────────┘  └──────────────────┘    │ │
│ │                                                  │ │
│ │ ┌──────────────────┐                           │ │
│ │ │ VSCode Extension │  (Phase 3)                │ │
│ │ │ Adapter          │                           │ │
│ │ │                  │                           │ │
│ │ │ + checkCommand() │                           │ │
│ │ │ + checkWebview() │                           │ │
│ │ └──────────────────┘                           │ │
│ └─────────────────────────────────────────────────┘ │
│                ↓                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Automation Drivers                              │ │
│ │  - Playwright (Chrome, Electron)                │ │
│ │  - @vscode/test-electron (VSCode)               │ │
│ └─────────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ File System                                         │
│  - src/ (source code)                               │
│  - dist/ (built artifacts)                          │
│  - screenshots/ (output)                            │
│  - test-results/ (logs)                             │
└─────────────────────────────────────────────────────┘
```

### 5.2 コンポーネント詳細

#### 5.2.1 HTTP API Layer

**責務**:
- HTTPリクエストの受信
- パラメータバリデーション
- Adapterの呼び出し
- レスポンスのJSON整形

**技術**:
- Express.js 4.x
- body-parser

**共通エンドポイント**:

| Method | Path | 説明 | 対応環境 |
|--------|------|------|---------|
| GET | `/status` | サーバー状態確認 | All |
| POST | `/rebuild` | プロジェクトのリビルド | All |
| POST | `/reload` | 環境のリロード | All |
| POST | `/check-ui` | UI確認 | All |
| POST | `/check-script` | スクリプト確認 | Chrome, Electron |
| GET | `/logs` | ログ取得 | All |
| GET | `/screenshot/:target` | スクリーンショット取得 | All |

**環境固有エンドポイント**:

| Method | Path | 説明 | 対応環境 |
|--------|------|------|---------|
| POST | `/check-popup` | Popup確認 | Chrome |
| POST | `/check-content-script` | Content Script確認 | Chrome |
| POST | `/check-ipc` | IPC通信確認 | Electron |
| POST | `/check-command` | コマンド実行確認 | VSCode |

---

#### 5.2.2 Core: BaseDevServer

**責務**:
- 共通ロジックの提供
- プラグインインターフェースの定義
- ログ管理
- スクリーンショット管理

**状態管理**:
```typescript
interface ServerState {
  context: any;  // Playwright context or equivalent
  isRebuilding: boolean;
  logs: LogCollection;
  config: ServerConfig;
}

interface LogCollection {
  build: LogEntry[];
  runtime: LogEntry[];  // Service Worker, Main Process等
  pages: { [pageId: string]: LogEntry[] };
}
```

**抽象メソッド（プラグインで実装必須）**:
```typescript
abstract class BaseDevServer {
  // 環境起動
  abstract launch(): Promise<void>;
  
  // 環境リロード
  abstract reload(): Promise<void>;
  
  // UI確認
  abstract checkUI(): Promise<UICheckResult>;
  
  // スクリプト確認
  abstract checkScript(url?: string): Promise<ScriptCheckResult>;
}
```

**共通メソッド（コアで実装）**:
```typescript
async rebuild(): Promise<RebuildResult>
async takeScreenshot(path: string): Promise<string>
collectLogs(): LogCollection
getStatus(): ServerStatus
```

---

#### 5.2.3 Plugins (Adapters)

##### Chrome Extension Adapter

**固有機能**:
- Manifest v3 Service Workerの監視
- Popup/Options/Sidepanelページの確認
- Content Scriptの注入確認
- `chrome.*` APIのエラー検出

**実装メソッド**:
```typescript
class ChromeExtensionAdapter extends BaseDevServer {
  async launch(): Promise<void>
  async reload(): Promise<void>
  async checkUI(): Promise<UICheckResult>
  async checkPopup(): Promise<PopupCheckResult>
  async checkContentScript(url: string): Promise<ContentScriptCheckResult>
}
```

**使用技術**:
- Playwright Chromium
- Chrome DevTools Protocol

---

##### Electron Adapter

**固有機能**:
- Main Processの監視
- Renderer Processの確認
- IPC通信の検証
- Node.js統合の確認

**実装メソッド**:
```typescript
class ElectronAdapter extends BaseDevServer {
  async launch(): Promise<void>
  async reload(): Promise<void>
  async checkUI(): Promise<UICheckResult>
  async checkIPC(): Promise<IPCCheckResult>
  async checkMainProcess(): Promise<MainProcessCheckResult>
}
```

**使用技術**:
- Playwright Electron
- Electron API

---

##### VSCode Extension Adapter（Phase 3）

**固有機能**:
- Extension Hostの監視
- コマンドパレットの確認
- WebViewの表示確認
- VSCode API呼び出しの検証

**実装メソッド**:
```typescript
class VSCodeExtensionAdapter extends BaseDevServer {
  async launch(): Promise<void>
  async reload(): Promise<void>
  async checkUI(): Promise<UICheckResult>
  async checkCommand(commandId: string): Promise<CommandCheckResult>
  async checkWebview(): Promise<WebviewCheckResult>
}
```

**使用技術**:
- @vscode/test-electron
- WebDriverIO (optional)

---

### 5.3 データフロー

#### シーケンス図: UI確認フロー（共通）

```
AI Agent       HTTP API      BaseDevServer    Plugin Adapter    Automation
   |              |                |                  |              |
   |--POST /check-ui-------------->|                  |              |
   |              |                |                  |              |
   |              |                |--checkUI()------>|              |
   |              |                |                  |              |
   |              |                |                  |--launch()-->|
   |              |                |                  |<--context---|
   |              |                |                  |              |
   |              |                |                  |--getPage()-->|
   |              |                |                  |<--page------|
   |              |                |                  |              |
   |              |                |                  |--evaluate()->|
   |              |                |                  |<--DOM info---|
   |              |                |                  |              |
   |              |                |<--UICheckResult--|              |
   |              |                |                  |              |
   |              |                |--takeScreenshot()->              |
   |              |                |<--path-----------|              |
   |              |                |                  |              |
   |              |<--JSON response|                  |              |
   |<--JSON-------|                |                  |              |
```

---

## 6. API仕様

### 6.1 共通仕様

#### ベースURL
```
http://localhost:3000
```

#### リクエストヘッダー
```
Content-Type: application/json
```

#### レスポンス形式
```json
{
  "success": true | false,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "environment": "chrome" | "electron" | "vscode",
  "data": { ... },
  "error": "..." // エラー時のみ
}
```

---

### 6.2 共通エンドポイント

#### GET /status

**説明**: サーバーと環境の状態を取得

**レスポンス**:
```json
{
  "success": true,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "data": {
    "serverRunning": true,
    "environment": "chrome",
    "environmentLoaded": true,
    "environmentId": "abcdefghijklmnop",  // Extension ID, App PID等
    "isRebuilding": false,
    "buildCount": 5,
    "lastBuildTime": "2025-01-01T11:55:00.000Z",
    "features": {
      "checkUI": true,
      "checkScript": true,
      "checkIPC": false  // Electronのみtrue
    }
  }
}
```

---

#### POST /rebuild

**説明**: プロジェクトをリビルドして自動リロード

**リクエスト**:
```json
{
  "forceReload": true,  // オプション
  "buildCommand": "npm run build"  // オプション: デフォルト上書き
}
```

**レスポンス**:
```json
{
  "success": true,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "environment": "chrome",
  "data": {
    "buildTime": 1234,
    "logs": [
      {
        "type": "stdout",
        "content": "Build completed successfully"
      }
    ],
    "warnings": [],
    "environmentReloaded": true
  }
}
```

---

#### POST /check-ui

**説明**: UI表示を確認（環境によって対象が異なる）

**対象**:
- Chrome: Popup/Options/Sidepanel
- Electron: Main Window
- VSCode: Extension WebView

**リクエスト**:
```json
{
  "viewport": {  // オプション
    "width": 400,
    "height": 600
  },
  "target": "popup",  // Chrome: "popup" | "options" | "sidepanel"
                      // Electron: "main" | "window-0"
                      // VSCode: "webview"
  "waitTime": 1000
}
```

**レスポンス**:
```json
{
  "success": true,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "environment": "chrome",
  "data": {
    "loaded": true,
    "screenshot": "screenshots/ui_1234567890.png",
    "dom": {
      "title": "My Extension Popup",
      "bodyText": "Welcome...",
      "elementCounts": {
        "input": 2,
        "button": 3
      }
    },
    "logs": [...],
    "errors": [],
    "performance": {
      "loadTime": 234
    }
  }
}
```

---

### 6.3 Chrome拡張固有エンドポイント

#### POST /check-popup

**説明**: Popupページを確認

**リクエスト**:
```json
{
  "viewport": {
    "width": 400,
    "height": 600
  }
}
```

**レスポンス**: `/check-ui` と同様

---

#### POST /check-content-script

**説明**: Content Scriptの注入を確認

**リクエスト**:
```json
{
  "url": "https://example.com",
  "waitTime": 2000
}
```

**レスポンス**:
```json
{
  "success": true,
  "environment": "chrome",
  "data": {
    "url": "https://example.com",
    "injected": true,
    "checks": {
      "dataAttributes": 5,
      "customClasses": 3,
      "windowKeys": ["myExtension"]
    },
    "screenshot": "screenshots/content_1234567890.png",
    "logs": [...],
    "domChanges": {
      "added": 3,
      "modified": 7
    }
  }
}
```

---

### 6.4 Electron固有エンドポイント

#### POST /check-ipc

**説明**: IPC通信を確認

**リクエスト**:
```json
{
  "channel": "ping",  // テストするチャンネル
  "payload": { "message": "test" }
}
```

**レスポンス**:
```json
{
  "success": true,
  "environment": "electron",
  "data": {
    "channel": "ping",
    "responded": true,
    "response": { "message": "pong" },
    "responseTime": 45,
    "errors": []
  }
}
```

---

#### POST /check-main-process

**説明**: Main Processの状態確認

**レスポンス**:
```json
{
  "success": true,
  "environment": "electron",
  "data": {
    "running": true,
    "logs": [...],
    "errors": [],
    "modules": {
      "fs": true,
      "path": true,
      "electron": true
    }
  }
}
```

---

### 6.5 VSCode拡張固有エンドポイント（Phase 3）

#### POST /check-command

**説明**: 登録コマンドを実行して確認

**リクエスト**:
```json
{
  "commandId": "extension.helloWorld"
}
```

**レスポンス**:
```json
{
  "success": true,
  "environment": "vscode",
  "data": {
    "commandId": "extension.helloWorld",
    "executed": true,
    "output": "Hello World!",
    "errors": []
  }
}
```

---

## 7. データモデル

### 7.1 共通型定義

```typescript
// ビルド結果
interface RebuildResult {
  success: boolean;
  buildTime: number;  // ms
  logs: LogEntry[];
  warnings: string[];
  environmentReloaded: boolean;
}

// ログエントリ
interface LogEntry {
  timestamp: number;
  type: 'stdout' | 'stderr' | 'log' | 'warn' | 'error';
  content: string;
  source?: string;  // 'build', 'serviceWorker', 'mainProcess'等
}

// UI確認結果（共通ベース）
interface UICheckResult {
  loaded: boolean;
  screenshot: string;
  dom: DOMInfo;
  logs: LogEntry[];
  errors: string[];
  performance: {
    loadTime: number;
  };
}

interface DOMInfo {
  title: string;
  bodyText: string;
  elementCounts: { [tagName: string]: number };
  hasErrors: boolean;
}

// サーバー状態
interface ServerStatus {
  serverRunning: boolean;
  environment: 'chrome' | 'electron' | 'vscode';
  environmentLoaded: boolean;
  environmentId: string | null;
  isRebuilding: boolean;
  buildCount: number;
  lastBuildTime: string | null;
  features: {
    checkUI: boolean;
    checkScript: boolean;
    checkIPC: boolean;
    checkCommand: boolean;
  };
}
```

### 7.2 環境固有型定義

#### Chrome拡張

```typescript
interface PopupCheckResult extends UICheckResult {
  extensionId: string;
}

interface ContentScriptCheckResult {
  url: string;
  injected: boolean;
  checks: {
    dataAttributes: number;
    customClasses: number;
    windowKeys: string[];
  };
  screenshot: string;
  logs: LogEntry[];
  domChanges?: {
    added: number;
    modified: number;
  };
}
```

#### Electron

```typescript
interface IPCCheckResult {
  channel: string;
  responded: boolean;
  response: any;
  responseTime: number;
  errors: string[];
}

interface MainProcessCheckResult {
  running: boolean;
  logs: LogEntry[];
  errors: string[];
  modules: { [moduleName: string]: boolean };
}
```

#### VSCode拡張

```typescript
interface CommandCheckResult {
  commandId: string;
  executed: boolean;
  output: string;
  errors: string[];
}

interface WebviewCheckResult extends UICheckResult {
  webviewId: string;
  visible: boolean;
}
```

---

## 8. 技術スタック

### 8.1 Core

| パッケージ | バージョン | 用途 |
|-----------|----------|------|
| Node.js | ≥18.0.0 | ランタイム |
| Express | ^4.18.0 | HTTP サーバー |
| TypeScript | ^5.0.0 | 型安全性 |

### 8.2 Plugins

#### Chrome Extension

| パッケージ | バージョン | 用途 |
|-----------|----------|------|
| Playwright | ^1.40.0 | Chrome制御 |

#### Electron

| パッケージ | バージョン | 用途 |
|-----------|----------|------|
| Playwright | ^1.40.0 | Electron制御 |

#### VSCode Extension

| パッケージ | バージョン | 用途 |
|-----------|----------|------|
| @vscode/test-electron | ^2.3.0 | VSCode制御 |
| WebDriverIO | ^8.0.0 | UI自動化（オプション） |

### 8.3 開発環境要件

- OS: Windows/macOS/Linux
- ディスプレイ: 必須（headless不可のため）
  - CI環境では Xvfb 等の仮想ディスプレイ
- メモリ: 2GB以上推奨
- ストレージ: 1GB以上（複数環境のランタイム含む）

---

## 9. ファイル構造

```
KamoX/  (Web Extension Dev Server)
├── packages/
│   ├── core/                           # 共通コア
│   │   ├── src/
│   │   │   ├── BaseDevServer.ts        # 抽象基底クラス
│   │   │   ├── DevServerAPI.ts         # HTTP API
│   │   │   ├── types/
│   │   │   │   ├── common.ts           # 共通型定義
│   │   │   │   └── plugin.ts           # プラグインインターフェース
│   │   │   └── utils/
│   │   │       ├── logger.ts
│   │   │       ├── screenshot.ts
│   │   │       └── rebuild.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── plugin-chrome/                  # Chrome拡張プラグイン
│   │   ├── src/
│   │   │   ├── ChromeExtensionAdapter.ts
│   │   │   ├── types.ts                # Chrome固有型
│   │   │   └── utils/
│   │   │       ├── popup.ts
│   │   │       └── content-script.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── plugin-electron/                # Electronプラグイン
│   │   ├── src/
│   │   │   ├── ElectronAdapter.ts
│   │   │   ├── types.ts                # Electron固有型
│   │   │   └── utils/
│   │   │       ├── ipc.ts
│   │   │       └── main-process.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── plugin-vscode/                  # VSCode拡張プラグイン（Phase 3）
│       ├── src/
│       │   ├── VSCodeExtensionAdapter.ts
│       │   ├── types.ts
│       │   └── utils/
│       │       ├── command.ts
│       │       └── webview.ts
│       ├── package.json
│       └── tsconfig.json
│
├── cli/                                # CLI起動スクリプト
│   ├── index.ts
│   └── config.ts
│
├── examples/                           # サンプルプロジェクト
│   ├── chrome-extension/
│   │   ├── src/
│   │   ├── dist/
│   │   └── manifest.json
│   ├── electron-app/
│   │   ├── main.js
│   │   ├── renderer.js
│   │   └── package.json
│   └── vscode-extension/
│       ├── src/
│       └── package.json
│
├── docs/
│   ├── design-doc.md                   # 本ドキュメント
│   ├── api-reference.md                # API詳細リファレンス
│   ├── plugin-development.md           # プラグイン開発ガイド
│   └── migration-to-mcp.md             # MCP移行ガイド
│
├── screenshots/                        # 自動生成
├── test-results/                       # 自動生成
│
├── package.json                        # Monorepo設定
├── lerna.json                          # Monorepo管理
├── tsconfig.base.json                  # 共通TypeScript設定
└── README.md
```

---

## 10. 実装フェーズ

### Phase 1: Core + Chrome Extension（Week 1-2）

#### Week 1: コア実装

**Day 1-2: アーキテクチャ設計・セットアップ**
- Monorepo構造構築（Lerna or npm workspaces）
- BaseDevServer抽象クラス設計
- 共通型定義
- HTTP API骨組み

**Day 3-4: コア機能実装**
- `rebuild()` 実装（共通）
- `takeScreenshot()` 実装（共通）
- ログ管理システム
- HTTP APIエンドポイント実装

**Day 5-7: Chrome Extension Adapter**
- `ChromeExtensionAdapter` 実装
- Playwright統合
- Service Worker監視
- 基本的な動作確認

**成果物**:
- 動作するChrome拡張開発サーバー
- サンプル拡張で動作確認

---

#### Week 2: 実戦投入・改善

**Day 1-3: 実際のプロジェクトで使用**
- 自身のChrome拡張開発に投入
- 問題点の洗い出し
- パフォーマンス改善

**Day 4-5: 機能追加**
- Popup確認の精度向上
- Content Script確認機能
- エラーハンドリング強化

**Day 6-7: ドキュメント整備**
- README作成
- API仕様書
- サンプルコード

**成果物**:
- 実用レベルのChrome拡張開発サーバー
- ドキュメント一式

---

### Phase 2: Electron Plugin（Week 3-4）

#### Week 3: Electron Adapter実装

**Day 1-2: Adapter骨組み**
- `ElectronAdapter` クラス実装
- Playwright Electron統合
- 基本的なlaunch/reload

**Day 3-4: Electron固有機能**
- IPC通信確認機能
- Main Process監視
- Renderer Process確認

**Day 5-7: 統合テスト**
- サンプルElectronアプリで確認
- バグ修正
- パフォーマンス調整

**成果物**:
- 動作するElectron開発サーバー

---

#### Week 4: 統合・ドキュメント

**Day 1-3: 環境切り替え機能**
- CLI引数で環境選択
- 設定ファイル対応
- 複数環境のサンプル

**Day 4-5: ドキュメント更新**
- Electronガイド追加
- 環境間の違いを説明
- トラブルシューティング

**Day 6-7: オープンソース準備**
- ライセンス選定
- CONTRIBUTING.md作成
- GitHub Actions設定

**成果物**:
- Chrome + Electron対応完了
- オープンソースリリース準備完了

---

### Phase 3: VSCode Extension Plugin（将来）

**必要になったら実装**

**想定期間**: 2-3週間

**主要タスク**:
- VSCodeExtensionAdapter実装
- @vscode/test-electron統合
- コマンド実行機能
- WebView確認機能

---

### Phase 4: MCP対応（将来）

**HTTP APIが安定してから実装**

**想定期間**: 1-2週間

**主要タスク**:
- MCPサーバー実装
- HTTP APIのラッパー化
- Claude Desktop統合
- ドキュメント更新

---

## 11. プラグイン開発ガイド

### 11.1 プラグインの作成方法

新しい環境に対応するプラグインを作成する手順：

#### Step 1: 抽象メソッドの実装

```typescript
// packages/plugin-myenv/src/MyEnvAdapter.ts
import { BaseDevServer } from '@KamoX/core';

export class MyEnvAdapter extends BaseDevServer {
  async launch(): Promise<void> {
    // 環境を起動する処理
  }
  
  async reload(): Promise<void> {
    // 環境をリロードする処理
  }
  
  async checkUI(): Promise<UICheckResult> {
    // UIを確認する処理
  }
  
  async checkScript(url?: string): Promise<ScriptCheckResult> {
    // スクリプトを確認する処理
  }
}
```

#### Step 2: 環境固有機能の追加

```typescript
export class MyEnvAdapter extends BaseDevServer {
  // ... 抽象メソッド実装 ...
  
  // 環境固有のメソッド
  async checkMySpecialFeature(): Promise<SpecialFeatureResult> {
    // 特殊な機能の確認
  }
}
```

#### Step 3: HTTP APIへの登録

```typescript
// packages/core/src/DevServerAPI.ts
export class DevServerAPI {
  private setupRoutes() {
    // 共通エンドポイント...
    
    // 環境固有エンドポイント
    if ('checkMySpecialFeature' in this.adapter) {
      this.app.post('/check-special', async (req, res) => {
        const result = await (this.adapter as any).checkMySpecialFeature();
        res.json(result);
      });
    }
  }
}
```

### 11.2 プラグインのベストプラクティス

1. **共通機能は継承する**: `rebuild()`, `takeScreenshot()`等は再実装不要
2. **型安全性を保つ**: TypeScriptの型定義を活用
3. **エラーハンドリング**: 常にtry-catchで囲む
4. **ログを充実させる**: デバッグしやすくする
5. **ドキュメントを書く**: 環境固有の注意点を明記

---

## 12. セキュリティ考慮事項

### 12.1 脅威モデル

#### 想定する脅威

1. **ローカル攻撃**: 同一マシン上の悪意あるプロセスがAPIを叩く
2. **コードインジェクション**: AIが生成したコードに悪意あるコードが混入
3. **情報漏洩**: スクリーンショットやログに機密情報が含まれる

#### 想定しない脅威

- リモート攻撃（localhostバインドのため）
- DDoS攻撃（開発環境のため）

### 12.2 対策

| 脅威 | 対策 | 優先度 | 実装Phase |
|------|------|--------|-----------|
| localhost以外からのアクセス | `127.0.0.1`のみバインド | 必須 | Phase 1 |
| スクリーンショット漏洩 | 定期的なクリーンアップ | 推奨 | Phase 1 |
| ログ漏洩 | センシティブ情報のフィルタリング | 推奨 | Phase 2 |
| コードインジェクション | sandboxビルド実行 | 検討 | Phase 3 |

### 12.3 実装

```typescript
// localhostのみバインド
app.listen(3000, '127.0.0.1', () => {
  console.log('Server running on http://127.0.0.1:3000');
});

// スクリーンショットの自動クリーンアップ
setInterval(() => {
  const files = fs.readdirSync('screenshots/');
  const now = Date.now();
  files.forEach(file => {
    const stat = fs.statSync(`screenshots/${file}`);
    const age = now - stat.mtimeMs;
    if (age > 3600000) {  // 1時間以上古い
      fs.unlinkSync(`screenshots/${file}`);
    }
  });
}, 600000);  // 10分ごと
```

---

## 13. パフォーマンス要件

### 13.1 レスポンスタイム目標

| 操作 | Chrome | Electron | VSCode | 許容時間 |
|------|--------|----------|--------|---------|
| `/status` | <50ms | <50ms | <50ms | <100ms |
| `/rebuild` | <5s | <8s | <6s | <15s |
| `/check-ui` | <2s | <3s | <2s | <7s |
| `/check-script` | <3s | <4s | N/A | <10s |

### 13.2 リソース使用量

| 環境 | CPU（平均） | CPU（ビルド時） | メモリ |
|------|-----------|---------------|--------|
| Chrome | 10-20% | 50-80% | 300-500MB |
| Electron | 15-25% | 60-90% | 400-600MB |
| VSCode | 10-20% | 50-80% | 350-550MB |

### 13.3 最適化戦略

```typescript
// キャッシュ機構（Phase 2）
class BuildCache {
  private lastBuildHash: string;
  
  async shouldRebuild(): Promise<boolean> {
    const currentHash = await this.calculateHash();
    return currentHash !== this.lastBuildHash;
  }
}

// 並列処理（Phase 2）
async checkAll(): Promise<AllCheckResult> {
  const [uiResult, scriptResult] = await Promise.all([
    this.checkUI(),
    this.checkScript()
  ]);
  return { uiResult, scriptResult };
}
```

---

## 14. エラーハンドリング

### 14.1 エラー分類

| カテゴリ | HTTPステータス | 例 |
|---------|---------------|-----|
| クライアントエラー | 400 | 不正なパラメータ |
| サーバーエラー | 500 | Automation driver異常終了 |
| 環境エラー | 200 (success: false) | ビルド失敗、環境起動失敗 |

### 14.2 環境別エラー

#### Chrome拡張

| エラー | 原因 | 解決策 |
|--------|------|--------|
| Extension not loading | manifest.json不正 | `/rebuild` でログ確認 |
| Popup真っ白 | JavaScript エラー | `/check-ui` のerrors確認 |
| Content script未注入 | manifest の matches 設定 | manifest.json修正 |

#### Electron

| エラー | 原因 | 解決策 |
|--------|------|--------|
| App not launching | main.js エラー | `/logs` で確認 |
| IPC not working | preload未設定 | webPreferences確認 |
| White screen | Renderer エラー | `/check-ui` のerrors確認 |

#### VSCode拡張

| エラー | 原因 | 解決策 |
|--------|------|--------|
| Extension not activating | activation events 不正 | package.json確認 |
| Command not found | contribution points 未登録 | package.json確認 |

### 14.3 エラーレスポンス形式

```json
{
  "success": false,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "environment": "chrome",
  "error": {
    "code": "BUILD_FAILED",
    "message": "TypeScript compilation failed",
    "details": {
      "file": "src/popup.ts",
      "line": 42,
      "column": 15,
      "suggestion": "Add type annotation"
    }
  }
}
```

---

## 15. テスト戦略

### 15.1 テストレベル

#### 単体テスト（Phase 2）
- BaseDevServerの各メソッド
- 共通ユーティリティ関数
- モック使用

#### 統合テスト（Phase 1）
- HTTP API → Adapter → Automation driver
- 実際のサンプルプロジェクトで確認

#### E2Eテスト（Phase 3）
- AIエージェントのシミュレーション
- 一連の開発フローを自動実行

### 15.2 環境別テストケース

#### Chrome拡張

```typescript
describe('ChromeExtensionAdapter', () => {
  it('should load extension and get extension ID', async () => {
    const adapter = new ChromeExtensionAdapter({ ... });
    await adapter.launch();
    expect(adapter.getExtensionId()).toBeTruthy();
  });
  
  it('should check popup and return screenshot', async () => {
    const result = await adapter.checkPopup();
    expect(result.success).toBe(true);
    expect(result.screenshot).toMatch(/\.png$/);
  });
});
```

#### Electron

```typescript
describe('ElectronAdapter', () => {
  it('should launch app and get window', async () => {
    const adapter = new ElectronAdapter({ ... });
    await adapter.launch();
    const window = await adapter.getMainWindow();
    expect(window).toBeTruthy();
  });
  
  it('should check IPC communication', async () => {
    const result = await adapter.checkIPC('ping', {});
    expect(result.responded).toBe(true);
  });
});
```

---

## 16. デプロイメント

### 16.1 インストール手順

```bash
# 1. リポジトリクローン
git clone https://github.com/username/KamoX.git
cd KamoX

# 2. 依存関係インストール
npm install

# 3. ビルド
npm run build

# 4. Playwrightブラウザインストール
npx playwright install chromium

# 5. サーバー起動（Chrome拡張モード）
npm run start:chrome -- --extension-path ./examples/chrome-extension/dist

# または（Electronモード）
npm run start:electron -- --app-path ./examples/electron-app
```

### 16.2 設定ファイル

```json
// KamoX.config.json
{
  "environment": "chrome",  // "chrome" | "electron" | "vscode"
  "port": 3000,
  "chrome": {
    "extensionPath": "./dist",
    "buildCommand": "npm run build"
  },
  "electron": {
    "appPath": "./main.js",
    "buildCommand": "npm run build"
  },
  "vscode": {
    "extensionPath": "./out",
    "buildCommand": "npm run compile"
  },
  "screenshots": {
    "retentionTime": 3600000,  // 1時間
    "directory": "./screenshots"
  },
  "logLevel": "info"
}
```

### 16.3 npm scripts

```json
{
  "scripts": {
    "build": "lerna run build",
    "start:chrome": "node cli/index.js chrome",
    "start:electron": "node cli/index.js electron",
    "start:vscode": "node cli/index.js vscode",
    "test": "lerna run test",
    "dev": "lerna run dev --parallel"
  }
}
```

---

## 17. 運用・保守

### 17.1 ログ管理

```typescript
// Winston使用（Phase 2）
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
    new winston.transports.Console({ 
      format: winston.format.simple() 
    })
  ]
});
```

### 17.2 モニタリング

```typescript
// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    memory: process.memoryUsage(),
    environment: this.adapter.getEnvironment(),
    environmentLoaded: this.adapter.isLoaded()
  };
  
  const status = health.environmentLoaded ? 200 : 503;
  res.status(status).json(health);
});
```

### 17.3 トラブルシューティング

#### 共通問題

| 問題 | 原因 | 解決策 |
|------|------|--------|
| Server not starting | Port already in use | ポート番号変更 |
| Build failed | 不正なコード | `/rebuild` のログ確認 |
| Screenshot empty | タイミング問題 | waitTime増加 |

#### 環境別問題

**Chrome拡張**:
- Extension ID取得失敗 → Service Worker起動待機時間を増やす
- Popup表示されない → manifest.jsonのdefault_popup確認

**Electron**:
- App起動失敗 → main.jsのパス確認
- IPC応答なし → preloadスクリプトの読み込み確認

**VSCode拡張**:
- Extension起動失敗 → activation events確認
- Command実行失敗 → package.jsonのcontributions確認

---

## 18. 将来の拡張

### 18.1 Phase 3以降の機能

#### 高度な分析機能
- パフォーマンスプロファイリング
- メモリリーク検出
- ネットワークトラフィック分析

#### CI/CD統合
- GitHub Actions ワークフロー
- 自動テストレポート生成
- Slack/Discord通知

#### 複数プロジェクト管理
- ワークスペース機能
- プロジェクト切り替え
- 比較分析

### 18.2 追加プラグイン（検討中）

- **React Native**: Metro bundler統合
- **Tauri**: Rust + Web統合
- **Browser Extension (Firefox)**: WebExtensions API
- **Mobile (Capacitor/Cordova)**: ハイブリッドアプリ

### 18.3 AI統合強化

- **MCP Native Support**: HTTP API → MCP変換
- **LangChain Integration**: AI Agentフレームワーク統合
- **Auto-Fix機能**: エラーの自動修正提案

---

## 19. 参考資料

### 19.1 技術ドキュメント

**共通**:
- [Playwright Documentation](https://playwright.dev/)
- [Express.js Guide](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

**Chrome拡張**:
- [Chrome Extensions Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)

**Electron**:
- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [Playwright for Electron](https://playwright.dev/docs/api/class-electron)

**VSCode拡張**:
- [VSCode Extension API](https://code.visualstudio.com/api)
- [@vscode/test-electron](https://www.npmjs.com/package/@vscode/test-electron)

**MCP**:
- [Model Context Protocol](https://modelcontextprotocol.io/)

### 19.2 関連プロジェクト

- [web-ext](https://github.com/mozilla/web-ext) - Firefox拡張開発ツール
- [Spectron](https://github.com/electron-userland/spectron) - Electron E2Eテスト（非推奨）
- [vscode-extension-tester](https://github.com/redhat-developer/vscode-extension-tester)

---

## 20. 変更履歴

| バージョン | 日付 | 変更内容 | 作成者 |
|-----------|------|---------|--------|
| 1.0.0 | 2025-01-01 | 初版作成（Chrome拡張のみ） | Hiro & Claude |
| 2.0.0 | 2025-01-01 | プラグイン型アーキテクチャに刷新<br>Electron/VSCode対応追加 | Hiro & Claude |

---

## 21. 承認

| 役割 | 氏名 | 承認日 | 署名 |
|------|------|--------|------|
| 設計者 | Hiro | 2025-01-01 | |
| レビュアー | - | - | |

---

## 付録A: 実装例

### A.1 BaseDevServer抽象クラス

```typescript
// packages/core/src/BaseDevServer.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export interface ServerConfig {
  projectPath: string;
  buildCommand: string;
  port?: number;
}

export abstract class BaseDevServer {
  protected context: any;
  protected logs: LogCollection;
  protected config: ServerConfig;
  protected isRebuilding: boolean = false;
  
  constructor(config: ServerConfig) {
    this.config = config;
    this.logs = {
      build: [],
      runtime: [],
      pages: {}
    };
  }
  
  // 抽象メソッド（プラグインで実装）
  abstract launch(): Promise<void>;
  abstract reload(): Promise<void>;
  abstract checkUI(): Promise<UICheckResult>;
  abstract checkScript(url?: string): Promise<ScriptCheckResult>;
  abstract getEnvironment(): string;
  abstract isLoaded(): boolean;
  
  // 共通メソッド
  async rebuild(): Promise<RebuildResult> {
    this.isRebuilding = true;
    const startTime = Date.now();
    this.logs.build = [];
    
    try {
      const { stdout, stderr } = await execAsync(
        this.config.buildCommand,
        { cwd: this.config.projectPath }
      );
      
      this.logs.build.push({ 
        timestamp: Date.now(),
        type: 'stdout', 
        content: stdout 
      });
      
      if (stderr) {
        this.logs.build.push({ 
          timestamp: Date.now(),
          type: 'stderr', 
          content: stderr 
        });
      }
      
      await this.reload();
      
      return {
        success: true,
        buildTime: Date.now() - startTime,
        logs: this.logs.build,
        warnings: [],
        environmentReloaded: true
      };
    } catch (error: any) {
      this.logs.build.push({ 
        timestamp: Date.now(),
        type: 'error', 
        content: error.message 
      });
      
      return {
        success: false,
        buildTime: Date.now() - startTime,
        logs: this.logs.build,
        warnings: [],
        environmentReloaded: false
      };
    } finally {
      this.isRebuilding = false;
    }
  }
  
  async takeScreenshot(path: string): Promise<string> {
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path;
  }
  
  collectLogs(): LogCollection {
    return this.logs;
  }
  
  getStatus(): ServerStatus {
    return {
      serverRunning: true,
      environment: this.getEnvironment() as any,
      environmentLoaded: this.isLoaded(),
      environmentId: this.getEnvironmentId(),
      isRebuilding: this.isRebuilding,
      buildCount: this.getBuildCount(),
      lastBuildTime: this.getLastBuildTime(),
      features: this.getFeatures()
    };
  }
  
  protected abstract getEnvironmentId(): string | null;
  protected abstract getBuildCount(): number;
  protected abstract getLastBuildTime(): string | null;
  protected abstract getFeatures(): any;
}
```

### A.2 Chrome Extension Adapter

```typescript
// packages/plugin-chrome/src/ChromeExtensionAdapter.ts
import { BaseDevServer, UICheckResult, ScriptCheckResult } from '@KamoX/core';
import { chromium, BrowserContext } from 'playwright';

export class ChromeExtensionAdapter extends BaseDevServer {
  private extensionId: string | null = null;
  private buildCount: number = 0;
  private lastBuildTime: string | null = null;
  
  async launch(): Promise<void> {
    this.context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${this.config.projectPath}`,
        `--load-extension=${this.config.projectPath}`
      ]
    });
    
    const workers = this.context.serviceWorkers();
    if (workers.length === 0) {
      await this.context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    
    const worker = this.context.serviceWorkers()[0];
    this.extensionId = worker.url().split('/')[2];
    
    worker.on('console', msg => {
      this.logs.runtime.push({
        timestamp: Date.now(),
        type: msg.type() as any,
        content: msg.text(),
        source: 'serviceWorker'
      });
    });
  }
  
  async reload(): Promise<void> {
    await this.context?.close();
    await this.launch();
    this.buildCount++;
    this.lastBuildTime = new Date().toISOString();
  }
  
  async checkUI(): Promise<UICheckResult> {
    return this.checkPopup();
  }
  
  async checkPopup(): Promise<UICheckResult> {
    const popup = await this.context.newPage();
    await popup.setViewportSize({ width: 400, height: 600 });
    
    const pageId = `popup_${Date.now()}`;
    this.logs.pages[pageId] = [];
    
    popup.on('console', msg => {
      this.logs.pages[pageId].push({
        timestamp: Date.now(),
        type: msg.type() as any,
        content: msg.text(),
        source: 'popup'
      });
    });
    
    const errors: string[] = [];
    popup.on('pageerror', err => errors.push(err.message));
    
    await popup.goto(`chrome-extension://${this.extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');
    const loadTime = Date.now();
    
    const screenshotPath = `screenshots/popup_${Date.now()}.png`;
    await popup.screenshot({ path: screenshotPath });
    
    const domInfo = await popup.evaluate(() => {
      return {
        title: document.title,
        bodyText: document.body.innerText.substring(0, 500),
        elementCounts: {
          input: document.querySelectorAll('input').length,
          button: document.querySelectorAll('button').length,
          select: document.querySelectorAll('select').length
        },
        hasErrors: !!document.querySelector('.error')
      };
    });
    
    return {
      loaded: true,
      screenshot: screenshotPath,
      dom: domInfo,
      logs: this.logs.pages[pageId],
      errors,
      performance: {
        loadTime: Date.now() - loadTime
      }
    };
  }
  
  async checkScript(url: string): Promise<ScriptCheckResult> {
    const page = await this.context.newPage();
    
    const pageId = `content_${Date.now()}`;
    this.logs.pages[pageId] = [];
    
    page.on('console', msg => {
      this.logs.pages[pageId].push({
        timestamp: Date.now(),
        type: msg.type() as any,
        content: msg.text(),
        source: 'contentScript'
      });
    });
    
    await page.goto(url);
    await page.waitForTimeout(2000);
    
    const injectionCheck = await page.evaluate(() => {
      return {
        dataAttributes: Array.from(
          document.querySelectorAll('[data-extension-id]')
        ).length,
        customClasses: Array.from(
          document.querySelectorAll('[class*="ext-"]')
        ).length,
        windowKeys: Object.keys(window).filter(k => k.includes('extension'))
      };
    });
    
    const screenshotPath = `screenshots/content_${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath });
    
    const injected = Object.values(injectionCheck).some(v => 
      (typeof v === 'number' && v > 0) || 
      (Array.isArray(v) && v.length > 0)
    );
    
    return {
      url,
      injected,
      checks: injectionCheck,
      screenshot: screenshotPath,
      logs: this.logs.pages[pageId]
    };
  }
  
  getEnvironment(): string {
    return 'chrome';
  }
  
  isLoaded(): boolean {
    return !!this.extensionId;
  }
  
  getExtensionId(): string | null {
    return this.extensionId;
  }
  
  protected getEnvironmentId(): string | null {
    return this.extensionId;
  }
  
  protected getBuildCount(): number {
    return this.buildCount;
  }
  
  protected getLastBuildTime(): string | null {
    return this.lastBuildTime;
  }
  
  protected getFeatures() {
    return {
      checkUI: true,
      checkScript: true,
      checkIPC: false,
      checkCommand: false
    };
  }
}
```

### A.3 HTTP API統合

```typescript
// packages/core/src/DevServerAPI.ts
import express, { Application } from 'express';
import { BaseDevServer } from './BaseDevServer';

export class DevServerAPI {
  private app: Application;
  private adapter: BaseDevServer;
  
  constructor(adapter: BaseDevServer) {
    this.adapter = adapter;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }
  
  private setupRoutes() {
    // 共通エンドポイント
    this.app.get('/status', async (req, res) => {
      const status = this.adapter.getStatus();
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        environment: this.adapter.getEnvironment(),
        data: status
      });
    });
    
    this.app.post('/rebuild', async (req, res) => {
      const result = await this.adapter.rebuild();
      res.json({
        success: result.success,
        timestamp: new Date().toISOString(),
        environment: this.adapter.getEnvironment(),
        data: result
      });
    });
    
    this.app.post('/check-ui', async (req, res) => {
      try {
        const result = await this.adapter.checkUI();
        res.json({
          success: true,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          data: result
        });
      } catch (error: any) {
        res.json({
          success: false,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          error: error.message
        });
      }
    });
    
    this.app.post('/check-script', async (req, res) => {
      try {
        const { url } = req.body;
        const result = await this.adapter.checkScript(url);
        res.json({
          success: true,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          data: result
        });
      } catch (error: any) {
        res.json({
          success: false,
          timestamp: new Date().toISOString(),
          environment: this.adapter.getEnvironment(),
          error: error.message
        });
      }
    });
    
    this.app.get('/logs', async (req, res) => {
      const logs = this.adapter.collectLogs();
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        environment: this.adapter.getEnvironment(),
        data: logs
      });
    });
    
    // 環境固有エンドポイント
    if ('checkPopup' in this.adapter) {
      this.app.post('/check-popup', async (req, res) => {
        try {
          const result = await (this.adapter as any).checkPopup();
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: result
          });
        } catch (error: any) {
          res.json({
            success: false,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            error: error.message
          });
        }
      });
    }
    
    if ('checkIPC' in this.adapter) {
      this.app.post('/check-ipc', async (req, res) => {
        try {
          const { channel, payload } = req.body;
          const result = await (this.adapter as any).checkIPC(channel, payload);
          res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            data: result
          });
        } catch (error: any) {
          res.json({
            success: false,
            timestamp: new Date().toISOString(),
            environment: this.adapter.getEnvironment(),
            error: error.message
          });
        }
      });
    }
  }
  
  start(port: number = 3000) {
    this.app.listen(port, '127.0.0.1', () => {
      console.log(`KamoX running on http://127.0.0.1:${port}`);
      console.log(`Environment: ${this.adapter.getEnvironment()}`);
    });
  }
}
```

### A.4 CLI起動スクリプト

```typescript
// cli/index.ts
import { DevServerAPI } from '@KamoX/core';
import { ChromeExtensionAdapter } from '@KamoX/plugin-chrome';
import { ElectronAdapter } from '@KamoX/plugin-electron';
import fs from 'fs';
import path from 'path';

interface CLIArgs {
  environment: 'chrome' | 'electron' | 'vscode';
  extensionPath?: string;
  appPath?: string;
  port?: number;
  config?: string;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const environment = args[0] as any;
  
  let config: any = {};
  const configPath = args.find(arg => arg.startsWith('--config='));
  if (configPath) {
    const configFile = configPath.split('=')[1];
    config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  }
  
  return {
    environment,
    extensionPath: args.find(arg => arg.startsWith('--extension-path='))?.split('=')[1],
    appPath: args.find(arg => arg.startsWith('--app-path='))?.split('=')[1],
    port: parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000'),
    config: configPath?.split('=')[1]
  };
}

async function main() {
  const args = parseArgs();
  
  let adapter;
  
  switch (args.environment) {
    case 'chrome':
      adapter = new ChromeExtensionAdapter({
        projectPath: args.extensionPath || './dist',
        buildCommand: 'npm run build'
      });
      break;
      
    case 'electron':
      adapter = new ElectronAdapter({
        projectPath: args.appPath || '.',
        buildCommand: 'npm run build'
      });
      break;
      
    case 'vscode':
      // Phase 3で実装
      throw new Error('VSCode extension support coming in Phase 3');
      
    default:
      console.error('Unknown environment:', args.environment);
      console.error('Usage: KamoX <chrome|electron|vscode> [options]');
      process.exit(1);
  }
  
  console.log('Launching environment...');
  await adapter.launch();
  
  console.log('Starting API server...');
  const api = new DevServerAPI(adapter);
  api.start(args.port);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

---

## 付録B: AIクライアント実装例

```python
# AIエージェント実装例（Python）
import requests
import time

class KamoXClient:
    def __init__(self, base_url='http://localhost:3000', environment='chrome'):
        self.base_url = base_url
        self.environment = environment
    
    def rebuild(self):
        response = requests.post(f'{self.base_url}/rebuild')
        return response.json()
    
    def check_ui(self, target='popup'):
        response = requests.post(
            f'{self.base_url}/check-ui',
            json={'target': target}
        )
        return response.json()
    
    def check_script(self, url):
        response = requests.post(
            f'{self.base_url}/check-script',
            json={'url': url}
        )
        return response.json()
    
    def develop_feature(self, code_generator, max_iterations=10):
        """AIによる開発ループ"""
        for iteration in range(max_iterations):
            print(f"Iteration {iteration + 1}/{max_iterations}")
            
            # コード生成
            code = code_generator.generate()
            
            # ビルド
            build_result = self.rebuild()
            if not build_result['success']:
                print("Build failed, fixing...")
                code_generator.fix_errors(build_result['data']['logs'])
                continue
            
            # 確認
            check_result = self.check_ui()
            if check_result['success'] and not check_result['data']['errors']:
                print(f"✅ Success in {iteration + 1} iterations!")
                return check_result
            
            # フィードバック
            print("Issues found, improving...")
            code_generator.improve(check_result)
            time.sleep(1)
        
        print("❌ Max iterations reached")
        return None

# 使用例
client = KamoXClient(environment='chrome')

# 状態確認
status = requests.get('http://localhost:3000/status').json()
print(f"Environment: {status['data']['environment']}")

# ビルド
result = client.rebuild()
print(f"Build: {'✅' if result['success'] else '❌'}")

# UI確認
ui_result = client.check_ui()
print(f"UI Check: {'✅' if ui_result['success'] else '❌'}")
print(f"Screenshot: {ui_result['data']['screenshot']}")
```

---

## 付録C: FAQ

**Q: 複数の環境を同時に起動できますか？**
A: Phase 1では単一環境のみです。異なるポートで起動すれば可能ですが、推奨しません。

**Q: headlessモードは対応予定ですか？**
A: Chrome拡張・Electronの制約により、headlessモードは技術的に不可能です。CI環境ではXvfb等の仮想ディスプレイをご使用ください。

**Q: どの環境から始めるべきですか？**
A: Chrome拡張から開始することを推奨します。最も開発が進んでおり、安定しています。

**Q: 自分の環境用のプラグインを作れますか？**
A: はい。`BaseDevServer`を継承して実装してください。詳細は「プラグイン開発ガイド」を参照。

**Q: MCP対応はいつですか？**
A: Phase 4（HTTP API安定後）を予定しています。

**Q: 商用利用できますか？**
A: オープンソースライセンス（MIT予定）に従って自由に利用できます。

---

以上で設計ドキュメント v2.0 は完成です。実装に進みますか？それとも設計について質問や修正がありますか？