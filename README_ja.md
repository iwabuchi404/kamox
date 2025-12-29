# ![KamoX Logo](https://raw.githubusercontent.com/iwabuchi404/kamox/main/images/logo_20251127.png) KamoX - Web Extension Dev Server

[![npm version](https://badge.fury.io/js/kamox.svg)](https://badge.fury.io/js/kamox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md) | **日本語**

**KamoX** は、AIコーディングエージェント（Windsurf, Cursor, Devinなど）が **Chrome拡張機能** (Manifest V3)、Electronアプリ、VSCode拡張をライブで確認・デバッグ・開発するために設計された、プラグイン型HTTP APIサーバーです。

AIエージェントとローカル開発環境のギャップを埋め、ビルド、UI確認、ログ取得のための構造化されたAPIを提供します。

## 特徴

- **🤖 AIファースト**: AIエージェントがHTTP API経由で対話（ビルド、検証、ログ取得）できるように設計。
- **🔌 プラグインアーキテクチャ**: Chrome拡張、Electron、VSCode拡張に対応（現在はChromeのみ）。
- **⚡ 自動検証**: **Playwright** を使用してスクリーンショット撮影、DOM情報取得、ログ収集を自動化。
- **🛡️ 堅牢なエラー検出**: 拡張機能のロードエラー、実行時エラー、CSP違反を自動検出し通知。
- 🔄 **ホットリロード**: コード変更時に拡張機能を自動リロード。
- 🐛 **Service Worker デバッグ**:
  - CDP経由でバックグラウンドの Service Worker ログを収集。
  - "Wake Up" ボタンで非アクティブな Service Worker を強制起動。
- 📸 **スクリーンショット機能**: AI分析用にブラウザの状態をキャプチャ。
- 🎬 **デバッグシナリオ機能**: 特定の状態を再現するための再利用可能なテストシナリオを定義・実行可能。
- 📊 **ライブダッシュボード**: サーバーの状態、エラー、ログをブラウザでリアルタイムに確認可能。

> [!TIP]
> **For AI Agents**: 詳細なAPI利用ガイドは [docs/ai-usage.md](https://github.com/iwabuchi404/kamox/blob/main/docs/ai-usage.md) を参照してください。

## インストール

```bash
npm install -g kamox
```

## クイックスタート

### Chrome拡張プロジェクトでの使用

```bash
# 拡張機能プロジェクトのディレクトリに移動
cd /path/to/your-extension

# プロジェクトの設定を自動検出（推奨）
kamox detect

# KamoXサーバーを起動（自動ビルド有効）
kamox chrome --auto-build
```

> **Note**: 開発者としてソースコードから実行する場合は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## 使い方

### 基本コマンド

```bash
# ヘルプを表示
kamox --help

# Chrome拡張開発サーバーを起動
kamox chrome [options]
```

### オプション

| オプション | 説明 | デフォルト |
|------------|------|------------|
| `-p, --port <number>` | サーバーポート番号 | `3000` |
| `-o, --output <path>` | ビルド出力ディレクトリ | `dist` |
| `-b, --build-command <cmd>` | ビルドコマンド | `npm run build` |
| `-c, --config <path>` | 設定ファイルパス | `kamox.config.json` |
| `--verbose` | 詳細なログと設定を表示 | `false` |
| `--auto-build` | 出力ディレクトリがない場合に自動ビルド | `false` |

### 設定ファイル (kamox.config.json)

プロジェクトルートに `kamox.config.json` を作成すると、毎回オプションを指定する必要がなくなります。

```json
{
  "mode": "chrome",
  "output": "./dist",
  "buildCommand": "npm run build",
  "port": 3000
}
```

### API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/rebuild` | プロジェクトのリビルド |
| GET | `/scenarios` | 利用可能なシナリオ一覧の取得 |
| POST | `/check-ui` | UI表示確認（Popup等） |
| POST | `/check-script` | Content Script確認 |
| GET | `/logs` | ログ取得 |
| POST | `/playwright/mouse` | マウス操作 (click, move, drag) |
| POST | `/playwright/keyboard` | キーボード操作 (type, press) |
| POST | `/playwright/element` | 要素操作 (click, fill, check) |
| POST | `/playwright/wait` | 待機操作 (selector, timeout) |
| POST | `/playwright/reload` | ページリロード |
| GET | `/` | 開発ダッシュボード |

### ダッシュボード機能

ダッシュボード（デフォルト: `http://localhost:3000`）には以下の機能があります:

- **サーバーステータス**: 環境と稼働状況の表示
- **最近のログ**: ブラウザとサーバーのランタイムログ（**Service Workerのログ**は `[SW]` プレフィックス付きで表示）
- **アクション**:
  - `Open Popup`: 新しいタブで拡張機能のポップアップを開く
  - `Check UI`: ポップアップやページのスクリーンショットを撮る
  - `Wake Up SW`: 停止している Service Worker を強制的に起動する
- **エラー報告**: 最近のエラーを目立つように表示

### インタラクティブテスト (Playwright API)

KamoXは、AIエージェントがPlaywright互換のAPIを使用して拡張機能を操作することを可能にします。

**例: ボタンをクリック**
```bash
curl -X POST http://localhost:3000/playwright/element \
  -H "Content-Type: application/json" \
  -d '{"selector": "#submit-btn", "action": "click"}'
```

**例: テキスト入力**
```bash
curl -X POST http://localhost:3000/playwright/keyboard \
  -H "Content-Type: application/json" \
  -d '{"action": "type", "text": "Hello World"}'
```

詳細は [docs/ai-usage.md](docs/ai-usage.md) を参照してください。

### シナリオテスト機能

`.kamox/scenarios/*.scenario.js` に再利用可能なテストシナリオを定義することで、特定のタブを開いたりデータをセットアップした状態でUI確認を行えます。

**シナリオ一覧の取得:**
```bash
curl http://localhost:3000/scenarios
```

**シナリオを実行してUI確認:**
```bash
curl -X POST http://localhost:3000/check-ui \
  -H "Content-Type: application/json" \
  -d '{"scenario": "basic-test"}'
```

シナリオファイルの構造やAPIの詳細については [**docs/scenarios.md**](docs/scenarios.md) を参照してください。


## トラブルシューティング

### "Output directory not found" エラー

ビルド出力ディレクトリ（デフォルトは `dist`）が見つからない場合に発生します。

**解決策:**
1. プロジェクトをビルドしてください: `npm run build`
2. または、`--auto-build` オプションを使用してください
3. 出力先が異なる場合は `--output` オプションで指定してください

### 拡張機能がロードされない

**解決策:**
1. `manifest.json` が出力ディレクトリに含まれているか確認してください
2. ダッシュボード (`http://localhost:3000`) でエラーログを確認してください
3. `--verbose` オプションを付けて起動し、詳細なログを確認してください

## ライセンス

MIT
