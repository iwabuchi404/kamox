# KamoX シナリオファイル サンプル

このディレクトリには、各サンプル拡張機能用のテストシナリオファイルが含まれています。

## シナリオファイルの場所

各拡張機能の `.kamox/scenarios/` ディレクトリに配置されています。

## 利用可能なシナリオ

### chrome-extension

#### `basic-test.scenario.js`
基本的なChrome拡張機能のテスト用シナリオ
- **用途**: アクティブタブ情報取得機能のテスト
- **特徴**: テスト用ページを1つ開く
- **使用方法**:
  ```bash
  curl -X POST http://localhost:3000/check-ui \
    -H "Content-Type: application/json" \
    -d '{"scenario": "basic-test"}'
  ```

### pomodoro-timer

#### `service-worker-test.scenario.js`
Service Workerの初期化テスト用シナリオ
- **用途**: Service Workerが正しく起動していることを確認
- **特徴**: 
  - `requiresPersistentContext: true` - ストレージ状態を保持
  - `requiresServiceWorkerInit: true` - Service Workerの初期化を要求
- **使用方法**:
  ```bash
  curl -X POST http://localhost:3000/check-ui \
    -H "Content-Type: application/json" \
    -d '{"scenario": "service-worker-test"}'
  ```

#### `timer-state-test.scenario.js`
タイマーの状態テスト用シナリオ
- **用途**: タイマーが実行中の状態をテスト
- **特徴**: Service Workerとストレージの状態を保持
- **使用方法**:
  ```bash
  curl -X POST http://localhost:3000/check-ui \
    -H "Content-Type: application/json" \
    -d '{"scenario": "timer-state-test"}'
  ```

### tab_mixer

#### `tab-mixer.scenario.js`
Tab Mixer拡張機能の基本テスト用シナリオ
- **用途**: 複数のタブを開いてタブ管理機能をテスト
- **特徴**: 3つのタブを順次開く
- **使用方法**:
  ```bash
  curl -X POST http://localhost:3000/check-ui \
    -H "Content-Type: application/json" \
    -d '{"scenario": "tab-mixer"}'
  ```

#### `multi-tabs.scenario.js`
複数タブテスト用シナリオ
- **用途**: 5つのタブを開いてタブ管理機能をテスト
- **特徴**: 順次実行（安定性重視）
- **使用方法**:
  ```bash
  curl -X POST http://localhost:3000/check-ui \
    -H "Content-Type: application/json" \
    -d '{"scenario": "multi-tabs"}'
  ```

#### `many-tabs-parallel.scenario.js`
多数タブ並列テスト用シナリオ
- **用途**: 20個のタブを並列で開いてパフォーマンスをテスト
- **特徴**: 
  - 並列実行（パフォーマンス重視）
  - `warmup.parallel: true`
- **使用方法**:
  ```bash
  curl -X POST http://localhost:3000/check-ui \
    -H "Content-Type: application/json" \
    -d '{"scenario": "many-tabs-parallel"}'
  ```

## シナリオ一覧の取得

利用可能なシナリオ一覧を取得するには:

```bash
curl http://localhost:3000/scenarios
```

レスポンス例:
```json
{
  "success": true,
  "data": {
    "scenarios": [
      {
        "name": "basic-test",
        "description": "Basic Chrome Extension test - Opens a test page for tab info retrieval",
        "version": "1.0",
        "requiresPersistentContext": false,
        "requiresServiceWorkerInit": false
      },
      {
        "name": "service-worker-test",
        "description": "Pomodoro Timer Service Worker test - Ensures SW is initialized and storage is ready",
        "version": "1.0",
        "requiresPersistentContext": true,
        "requiresServiceWorkerInit": true
      }
    ]
  }
}
```

## シナリオファイルの作成方法

新しいシナリオファイルを作成するには、`.kamox/scenarios/` ディレクトリに `.scenario.js` または `.scenario.mjs` 拡張子のファイルを作成します。

### 最小限のシナリオファイル

```javascript
export default {
  version: '1.0',
  name: 'my-scenario',
  description: 'My test scenario',
  
  async setup(context, logger) {
    logger.log('info', 'Setting up scenario...', 'scenario');
    // セットアップ処理
  }
};
```

### 詳細なシナリオファイル

```javascript
export default {
  version: '1.0',
  name: 'my-scenario',
  description: 'My test scenario',
  requiresPersistentContext: true,  // ストレージ状態を保持したい場合
  requiresServiceWorkerInit: true,   // Service Workerの初期化が必要な場合
  warmup: {
    enabled: true,
    parallel: false  // 並列実行するか
  },
  
  async setup(context, logger) {
    // セットアップ処理
  },
  
  async cleanup(context, logger) {
    // カスタムクリーンアップ処理（オプション）
  }
};
```

## 注意事項

- シナリオファイルは `.kamox/scenarios/` ディレクトリ内に配置する必要があります
- ファイル名は `.scenario.js` または `.scenario.mjs` で終わる必要があります
- `version` フィールドは推奨です（将来の破壊的変更への対応）
- `setup` 関数は必須です
- `cleanup` 関数はオプションです（定義しない場合、デフォルトクリーンアップが実行されます）







