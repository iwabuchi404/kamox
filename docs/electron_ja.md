# KamoX Electron アダプター

KamoX は、**Electron アプリケーション** のための強力な開発および自動化サーバーを提供します。AI エージェントや開発者が、IPC 通信のデバッグ、複数ウィンドウを跨ぐ UI テストの自動化、ライブプレビューを簡単に行えるように設計されています。

## 主な機能

- 🚀 **ワンコマンド起動**: Electron アプリと KamoX サーバーを同時に起動。
- 📺 **複数ウィンドウ対応**: 開いているすべてのウィンドウを自動検知し、個別に操作・検証可能。
- 📡 **IPC 監視**: メインプロセスとレンダラープロセス間の通信をキャプチャしてログ表示。
- 🎭 **IPC / ダイアログモック**: アプリコードを変更せずに `ipcMain.handle` のレスポンスやネイティブダイアログ（`showOpenDialog` 等）をモック可能。
- 🔍 **IPC スパイ**: 双方向の IPC 通信キャプチャ（Renderer→Main / Main→Renderer）。フィルタリングと差分取得に対応。
- 🖱️ **Playwright 統合**: Playwright API を使用して、ウィンドウに対するクリック、入力、要素読み取りなどの操作をウィンドウ指定付きでフルコントロール。
- 🛠️ **統合ログ**: メインプロセスの `stdout/stderr` と、全レンダラーの `console` ログを統合表示。
- 🧪 **シナリオテスト**: 複雑なアプリ状態を再現するための自動操作フローを定義可能。

## セットアップ

### 1. KamoX のインストール

```bash
npm install -g kamox
```

### 2. プロジェクトの設定

Electron プロジェクトのルートに `kamox.config.json` を作成します：

```json
{
  "mode": "electron",
  "entryPoint": "main.js",
  "port": 3000
}
```

- `mode`: `"electron"` を指定します。
- `entryPoint`: メインプロセスを実行するエントリファイル（例: `main.js`, `dist/main.js`）への相対パス。

### 3. 起動

```bash
kamox electron
```

ビルドステップが必要な場合（TypeScript 等）は、自動ビルドオプションを使用できます：

```bash
kamox electron --buildCommand "npm run build" --auto-build
```

## 使い方

### 開発ダッシュボード

KamoX 起動後、`http://localhost:3000` にアクセスしてダッシュボードを利用できます。
- **Restart App**: アプリケーション全体を即座に再起動します。
- **Window Selector**: 検証やスクリーンショット撮影の対象となるウィンドウを切り替えます。
- **IPC Filtering**: "IPC Only" チェックボックスを使用して、プロセス間通信のみを抽出表示できます。

### 自動化 API

AI エージェントは、HTTP API を通じて Electron アプリを操作できます。

#### ログインフォームに入力する（ウィンドウ指定あり）

```bash
curl -X POST http://localhost:3000/playwright/element \
  -H "Content-Type: application/json" \
  -d '{
    "selector": "#username",
    "action": "fill",
    "value": "developer",
    "windowIndex": 1
  }'
```

#### 要素のテキストを取得する

```bash
curl -X POST http://localhost:3000/playwright/element \
  -H "Content-Type: application/json" \
  -d '{
    "selector": "h1",
    "action": "textContent",
    "windowIndex": 1
  }'
# → { "success": true, "data": { "selector": "h1", "action": "textContent", "result": "My App" } }
```

#### 特定のウィンドウの UI をチェックする

```bash
curl -X POST http://localhost:3000/check-ui \
  -H "Content-Type: application/json" \
  -d '{
    "windowIndex": 1
  }'
```

### ウィンドウ指定

すべての Playwright エンドポイント（`/playwright/mouse`, `/playwright/keyboard`, `/playwright/element`, `/playwright/wait`, `/playwright/reload`）は、`windowIndex` と `windowTitle` パラメータをサポートしています。Electron アプリでは DevTools が `windowIndex: 0` になることがあるため、アプリウィンドウを明示的に指定することが重要です。

### 要素読み取りアクション

書き込み系アクション（`click`, `fill`, `select`, `check`, `uncheck`）に加えて、`/playwright/element` エンドポイントは読み取り系アクションをサポートしています：

| Action         | 説明                   | 追加パラメータ        | 戻り値           |
| -------------- | ---------------------- | --------------------- | ---------------- |
| `textContent`  | 要素のテキストを取得   | -                     | `string \| null` |
| `innerHTML`    | 要素の内部 HTML を取得 | -                     | `string`         |
| `isVisible`    | 表示状態を確認         | -                     | `boolean`        |
| `getAttribute` | 属性値を取得           | `attribute`（必須）   | `string \| null` |

読み取り結果は `data.result` に格納されます。

### AI ガイド

`kamox guide --mode electron` を実行すると、AI エージェント向けに最適化された API リファレンスを確認できます。

## IPC / ダイアログモック

KamoX は、アプリケーションコードを一切変更せずに IPC レスポンスやネイティブダイアログをモックできます。Electron の `-r`（require）フラグを利用してメインプロセスにフックを注入する仕組みです。

### IPC モック

```bash
# IPC チャンネルのモックレスポンスを設定
curl -X POST http://localhost:3000/mock-ipc \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "get-user-data",
    "response": { "name": "Test User", "id": 1 }
  }'

# アクティブなモック一覧を取得
curl http://localhost:3000/mocks

# 特定の IPC モックをクリア
curl -X DELETE "http://localhost:3000/mock-ipc?channel=get-user-data"

# 全モックをクリア
curl -X DELETE http://localhost:3000/mocks
```

### ダイアログモック

対応メソッド: `showOpenDialog`, `showSaveDialog`, `showMessageBox`, `showMessageBoxSync`, `showErrorBox`

```bash
# ファイルオープンダイアログをモック
curl -X POST http://localhost:3000/mock-dialog \
  -H "Content-Type: application/json" \
  -d '{
    "method": "showOpenDialog",
    "response": { "canceled": false, "filePaths": ["/tmp/test.txt"] }
  }'

# 特定のダイアログモックをクリア
curl -X DELETE "http://localhost:3000/mock-dialog?method=showOpenDialog"
```

## IPC スパイ（通信モニター）

IPC スパイは双方向の IPC 通信をリアルタイムにキャプチャします:

- **Renderer → Main**: `ipcMain.handle`（invoke）および `ipcMain.on`（send）呼び出し
- **Main → Renderer**: `webContents.send` 呼び出し

### 使い方

```bash
# IPC メッセージのキャプチャを開始
curl -X POST http://localhost:3000/ipc-spy/start

# スパイの状態を確認
curl http://localhost:3000/ipc-spy/status

# キャプチャしたログを全件取得
curl http://localhost:3000/ipc-spy/logs

# 特定 ID 以降の新しいログのみ取得（差分取得）
curl "http://localhost:3000/ipc-spy/logs?since=5"

# キャプチャを停止
curl -X POST http://localhost:3000/ipc-spy/stop

# キャプチャしたログをクリア
curl -X DELETE http://localhost:3000/ipc-spy/logs
```

### ログエントリのフォーマット

```json
{
  "id": 1,
  "timestamp": 1707800000000,
  "direction": "renderer-to-main",
  "channel": "submit-form",
  "method": "on",
  "args": [{ "username": "test" }],
  "webContentsId": 1
}
```

- `direction`: `"renderer-to-main"` または `"main-to-renderer"`
- `method`: `"invoke"`（handle/invoke パターン）、`"on"`（send/on パターン）、`"send"`（webContents.send）
- `webContentsId`: Main→Renderer メッセージのみ。送信先ウィンドウを識別
- ログは循環バッファに保持（最大 1000 件）

## シナリオテスト

`.kamox/scenarios/my-scenario.scenario.js` にシナリオを定義します：

```javascript
export default {
  name: 'login-flow',
  setup: async (context, logger) => {
    const [page] = context.pages();
    await page.fill('#user', 'test-user');
    await page.click('#login-btn');
    logger.log('info', 'Login scenario completed', 'scenario');
  }
};
```

API 経由での実行：
```bash
curl -X POST http://localhost:3000/check-ui \
  -H "Content-Type: application/json" \
  -d '{"scenario": "my-scenario"}'
```

## トラブルシューティング

### Error: Main entry point not found
設定ファイルの `entryPoint` が、実際に存在するメインプロセス用 JS ファイルを指しているか確認してください。

### スクリーンショットが真っ白
アプリが `nodeIntegration: false` や `contextIsolation: true`（Electron のデフォルト）を使用している場合でも、KamoX はスクリーンショットを撮影できます。ウィンドウが非表示（hidden）になっていないか、正しくレンダリングされているか確認してください。
