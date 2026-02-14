# KamoX 設計ドキュメント v3.0 (npm化対応版)

## 1. エグゼクティブサマリー

### プロジェクト名
**KamoX** (formerly WEDS - Web Extension Dev Server)

### 一行説明
AIコーディングエージェントがChrome拡張機能・Electronアプリ・VSCode拡張をライブで確認しながら開発できる、npmでインストール可能なプラグイン型HTTP APIサーバー

### 配布方法
- **npmパッケージ**（メイン配布方法）
- GitHubリポジトリ（ソースコード）

### 解決する問題
通常のWeb開発ではMCPやPlaywrightでブラウザを直接操作できるが、Chrome拡張・Electron・VSCode拡張は特殊な環境で動作するため、AIエージェントが自律的に動作確認できない。これにより開発サイクルが「コード修正→手動確認→フィードバック」という人間介入必須のループになっている。

---

## 2. コンセプト

### 2.1 核となるアイデア
**「特殊な実行環境をAIがアクセス可能な統一APIとして公開する」**

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

#### npm化を前提とした配布戦略
- グローバルインストールで即座に利用可能 (`npm i -g kamox`)
- プロジェクトローカルへのインストールもサポート
- `npx` での一時利用も可能

---

## 3. インストールとセットアップ

### 3.1 インストール方法

#### グローバルインストール（推奨）
```bash
# Phase 1（現在）: Chrome拡張のみ対応
npm install -g kamox

# バージョン確認
kamox --version
# kamox 0.1.0 (Chrome extension support)
```

#### プロジェクトローカルインストール
```bash
# 開発依存として追加
cd /path/to/your-extension
npm install --save-dev kamox

# package.jsonに追加
{
  "scripts": {
    "dev": "kamox chrome"
  }
}

# 実行
npm run dev
```

#### npx（インストール不要）
```bash
# 一時的に使用
cd /path/to/your-extension
npx kamox chrome
```

### 3.2 クイックスタート
```bash
# 1. グローバルインストール
npm install -g kamox

# 2. Chrome拡張プロジェクトに移動
cd ~/my-chrome-extension

# 3. プロジェクト検出（オプション）
kamox detect

# 4. サーバー起動
kamox chrome

# 5. 別ターミナルでAIが開発開始
# AIがHTTP APIを使用して自律開発
```

### 3.3 必須要件
**システム要件**:
- Node.js ≥18.0.0
- npm ≥8.0.0
- ディスプレイ（headless不可）

**プロジェクト要件（Chrome拡張）**:
- `dist/` または `build/` ディレクトリにビルド済みコード
- `dist/manifest.json` が存在
- ビルドコマンド（例: `npm run build`）

---

## 4. ディレクトリ構造（npm化対応）

### 4.1 推奨プロジェクト構造
```
~/projects/
│
├── my-chrome-extension/          # 開発プロジェクト
│   ├── src/                      # ソースコード
│   │   ├── popup.tsx
│   │   ├── content.ts
│   │   └── background.ts
│   │
│   ├── dist/                     # ビルド出力
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── manifest.json
│   │
│   ├── .kamox/                   # KamoXの作業ディレクトリ
│   │   ├── screenshots/          # スクリーンショット
│   │   │   ├── popup_1234.png
│   │   │   └── content_5678.png
│   │   └── cache/                # キャッシュ（将来）
│   │
│   ├── kamox.config.json         # KamoX設定（オプション）
│   ├── package.json
│   ├── tsconfig.json
│   └── .gitignore                # .kamox/ を除外
│
└── another-extension/            # 別のプロジェクト
    └── ...
```

### 4.2 .kamoxディレクトリの詳細
**目的**: KamoXの作業ファイルをプロジェクト内に隔離

**内容**:
```
.kamox/
├── screenshots/          # APIが生成するスクリーンショット
│   ├── popup_*.png
│   └── content_*.png
├── cache/               # ビルドキャッシュ（Phase 2）
└── logs/                # ローカルログ（デバッグ用）
```

**特徴**:
- AIから直接アクセス可能（同じプロジェクト内）
- `.gitignore` で除外推奨
- プロジェクトごとに独立
- 自動生成・自動管理

### 4.3 .gitignoreの設定
```bash
# .gitignore

# KamoX作業ディレクトリ
.kamox/

# Node modules
node_modules/

# Build output
dist/
build/
```

---

## 5. 設定ファイル

### 5.1 設定ファイルの優先順位
1. CLI引数（最優先）
   `kamox chrome --port 3001 --output ./build`
2. カレントディレクトリの `kamox.config.json`
3. カレントディレクトリの `.kamoxrc`
4. `package.json` の `"kamox"` フィールド
5. ホームディレクトリの `~/.kamox/config.json`（グローバル設定）
6. 組み込みデフォルト値

### 5.2 kamox.config.json（推奨構成）
```json
{
  "mode": "chrome",
  "output": "./dist",
  "buildCommand": "npm run build",
  "port": 3000,
  
  "chrome": {
    "testUrls": [
      "https://github.com",
      "https://example.com"
    ],
    "popupViewport": {
      "width": 800,
      "height": 600
    }
  },
  
  "screenshots": {
    "directory": ".kamox/screenshots",
    "retentionTime": 3600000,
    "autoCleanup": true
  }
}
```

---

## 6. CLI仕様

### 6.1 基本コマンド
```bash
kamox <environment> [options]
```
**environments**:
- `chrome` - Chrome拡張開発（Phase 1）
- `electron` - Electronアプリ開発（Phase 2）
- `vscode` - VSCode拡張開発（Phase 3）

### 6.2 共通オプション
```bash
kamox chrome [options]

Options:
  -V, --version              Output version number
  -h, --help                 Display help
  -c, --config <path>        Config file path
  -p, --port <number>        Server port (default: 3000)
  -o, --output <path>        Build output directory (default: "dist")
  -b, --build <command>      Build command (default: "npm run build")
  -w, --watch                Enable file watching (future)
  --verbose                  Verbose logging
```

### 6.3 環境検出コマンド
```bash
kamox detect
```
プロジェクトタイプ、出力ディレクトリ、ビルドコマンドを自動検出し、推奨設定を表示します。

---

## 7. プロジェクト自動検出ロジック

### Chrome拡張の検出
1. `dist/manifest.json` の存在確認
2. `build/manifest.json` の存在確認
3. `manifest.json` の存在確認（ルート）

### ビルドコマンドの検出
`package.json` から以下のスクリプトを順に確認:
- `"build"`
- `"compile"`
- `"webpack"`
- `"bundle"`

---

## 8. システムアーキテクチャ

### 8.1 全体構成図
```
┌─────────────────────────────────────────────────────┐
│ AI Coding Agent (Claude, GPT, etc.)                │
└────────────────┬────────────────────────────────────┘
                 │ HTTP Requests (JSON)
                 ↓
┌─────────────────────────────────────────────────────┐
│ KamoX Server (npm package)                          │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ HTTP API Layer (Express.js)                     │ │
│ └──────────────┬──────────────────────────────────┘ │
│                ↓                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Core: BaseDevServer                             │ │
│ └──────────────┬──────────────────────────────────┘ │
│                ↓                                     │
│ ┌──────────────┴──────────────────────────────────┐ │
│ │ Plugins (Adapters)                              │ │
│ │ ┌──────────────────┐  ┌──────────────────┐    │ │
│ │ │ Chrome Adapter   │  │ Electron Adapter │    │ │
│ │ └──────────────────┘  └──────────────────┘    │ │
│ └─────────────────────────────────────────────────┘ │
│                ↓                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Automation Drivers                              │ │
│ │  - Playwright (Chrome, Electron)                │ │
│ └─────────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ User Project (.kamox/)                              │
│  - screenshots/                                     │
│  - logs/                                            │
└─────────────────────────────────────────────────────┘
```

---

## 9. API仕様

### 9.1 共通エンドポイント

#### GET /status
サーバーと環境の状態確認。
```json
{
  "success": true,
  "data": {
    "version": "0.1.0",
    "environment": "chrome",
    "environmentLoaded": true,
    "project": {
      "path": "/Users/hiro/my-extension",
      "workDir": "/Users/hiro/my-extension/.kamox"
    }
  }
}
```

#### POST /rebuild
プロジェクトをリビルドして環境をリロード。
```json
{
  "success": true,
  "data": {
    "buildTime": 1234,
    "environmentReloaded": true
  }
}
```

#### POST /check-ui
UI表示を確認。
```json
{
  "success": true,
  "data": {
    "loaded": true,
    "screenshot": "/abs/path/to/.kamox/screenshots/popup_1234.png",
    "dom": { ... },
    "logs": [...]
  }
}
```
**重要**: `screenshot` フィールドは絶対パスを返す。AIは直接ファイルアクセス可能。

#### GET /logs
すべてのログを取得。

---

## 10. npmパッケージ構造

### 10.1 ディレクトリ構造（npm公開用）
```
kamox/  (リポジトリルート)
├── packages/
│   ├── core/                    # @kamox/core
│   ├── plugin-chrome/           # @kamox/plugin-chrome
│   └── ...
├── cli/                         # CLI実装
│   └── dist/index.js            # binエントリポイント
├── dist/                        # npm公開用ビルド
│   ├── core/
│   ├── plugin-chrome/
│   ├── cli/
│   └── index.js
├── package.json
└── README.md
```

### 10.2 .npmignore
ソースコードやテストファイルを除外し、`dist/` とドキュメントのみを含める。

---

## 11. 実装フェーズ

### Phase 1: Core + Chrome Extension（完了）
- Monorepo構築
- BaseDevServer実装
- ChromeExtensionAdapter実装
- HTTP API実装

### Phase 1.5: npm化対応（Week 2）
- [ ] プロジェクト構造の再編（.kamoxディレクトリ）
- [ ] CLIの改善（detectコマンド）
- [ ] 設定ファイル対応
- [ ] npmパッケージ公開準備

### Phase 2: Electron Plugin（完了）
- ElectronAdapter実装
- IPC確認機能
- IPC / ダイアログモック機能（アプリ無変更でモック注入）
- IPC スパイ機能（双方向通信キャプチャ）

### Phase 3: VSCode Extension Plugin（将来）
- VSCodeExtensionAdapter実装