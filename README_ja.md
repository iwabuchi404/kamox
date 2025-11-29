# ![KamoX Logo](images/logo_20251127.png) KamoX - Web Extension Dev Server

[English](README.md) | **日本語**

AIコーディングエージェントがChrome拡張機能・Electronアプリ・VSCode拡張をライブで確認しながら開発できる、プラグイン型HTTP APIサーバー。

## 特徴

- **AIフレンドリー**: HTTP API経由でビルド、UI確認、ログ取得が可能
- **プラグインアーキテクチャ**: Chrome拡張、Electron、VSCode拡張に対応（現在はChromeのみ）
- **自動化**: スクリーンショット撮影、DOM情報取得、ログ収集を自動化
- **堅牢なエラー検出**: 拡張機能のロードエラーや実行時エラーを自動検出し、ログとダッシュボードで通知
- **開発ダッシュボード**: サーバーの状態、エラー、ログをブラウザでリアルタイムに確認可能

> [!TIP]
> **For AI Agents**: 詳細なAPI利用ガイドは [docs/ai-usage.md](docs/ai-usage.md) を参照してください。

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

`kamox detect` コマンドを使用すると、プロジェクト構造から推奨設定を表示できます。

## ダッシュボード

KamoXサーバー起動後、コンソールに表示されるURL（例: `http://localhost:3000/`）にアクセスすると、以下の機能を持つダッシュボードが表示されます：

- **ステータス確認**: サーバーの稼働状況や環境情報の確認
- **エラー通知**: 拡張機能のロードエラーや実行時エラーの即時確認
- **ログ閲覧**: 直近のシステムログの確認
- **リビルド**: ワンクリックで拡張機能の再ビルドと再読み込み

## API

| Method | Path | 説明 |
|--------|------|------|
| GET | `/status` | サーバー状態確認 |
| POST | `/rebuild` | プロジェクトのリビルド |
| POST | `/check-ui` | UI表示確認（Popup等） |
| POST | `/check-script` | Content Script確認 |
| GET | `/logs` | ログ取得 |
| GET | `/` | 開発ダッシュボード |

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
