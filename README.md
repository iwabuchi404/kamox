# KamoX - Web Extension Dev Server

AIコーディングエージェントがChrome拡張機能・Electronアプリ・VSCode拡張をライブで確認しながら開発できる、プラグイン型HTTP APIサーバー。

## 特徴

- **AIフレンドリー**: HTTP API経由でビルド、UI確認、ログ取得が可能
- **プラグインアーキテクチャ**: Chrome拡張、Electron、VSCode拡張に対応（現在はChromeのみ）
- **自動化**: スクリーンショット撮影、DOM情報取得、ログ収集を自動化

## インストール

```bash
npm install
npm run build
```

## 使い方（Chrome拡張）

1. Chrome拡張プロジェクトをビルドします（`dist`ディレクトリ等に出力）
2. KamoXサーバーを起動します：

```bash
# CLIから起動
node cli/dist/index.js chrome --project-path=/absolute/path/to/dist
```

## API

| Method | Path | 説明 |
|--------|------|------|
| GET | `/status` | サーバー状態確認 |
| POST | `/rebuild` | プロジェクトのリビルド |
| POST | `/check-ui` | UI表示確認（Popup等） |
| POST | `/check-script` | Content Script確認 |
| GET | `/logs` | ログ取得 |

## ライセンス

MIT
