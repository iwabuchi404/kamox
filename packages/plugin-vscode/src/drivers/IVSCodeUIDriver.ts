export interface VSCodeLaunchConfig {
  vscodePath?: string        // VSCode実行ファイルパス（省略時は自動検出）
  extensionPath: string      // 拡張機能のプロジェクトパス
  workspacePath?: string     // ワークスペースフォルダ
  additionalArgs?: string[]  // 追加起動引数
}

export interface NotificationInfo {
  message: string
  type: 'info' | 'warning' | 'error'
  actions: string[]
}

export interface IVSCodeUIDriver {
  // ライフサイクル
  launch(config: VSCodeLaunchConfig): Promise<void>
  quit(): Promise<void>
  openFile(path: string): Promise<void>

  // スクリーンショット
  takeScreenshot(): Promise<Buffer>

  // VSCode固有操作
  executeCommand(id: string): Promise<void>
  getNotifications(): Promise<NotificationInfo[]>
  dismissNotification(message: string): Promise<void>
  getStatusBarItemText(labelPattern: string): Promise<string | null>
  getOutputChannelText(channelName: string): Promise<string>

  // 汎用UI操作（Step 2以降）
  clickActivityBarItem(label: string): Promise<void>
  getTreeViewItems(viewId: string): Promise<string[]>
  selectQuickPickItem(label: string): Promise<void>
  getProblems(): Promise<any[]>

  // 汎用セレクター操作（フォールバック用）
  click(selector: string): Promise<void>
  typeText(text: string): Promise<void>
  evaluate(script: string): Promise<any>
}
