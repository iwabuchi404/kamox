// KamoX Main Process Hook Script
// Electron の -r (--require) フラグで読み込まれ、ipcMain.handle と dialog をフックする
// 純粋な CommonJS で記述（Electron メインプロセス内で実行されるため）
console.log('[KamoX] Main process hook loaded')

const { app, ipcMain } = require('electron')

// ========== IPC Spy ==========
let spyEnabled = false
let spyIdCounter = 0
const spyLog = []
const SPY_MAX_ENTRIES = 1000

// args を安全にシリアライズ可能な形式にコピー
function safeCloneArgs(args) {
  try {
    return JSON.parse(JSON.stringify(args))
  } catch {
    return args.map(a => {
      try { return JSON.parse(JSON.stringify(a)) } catch { return '[Unserializable]' }
    })
  }
}

// スパイログにエントリを追加（循環バッファ）
function addSpyEntry(direction, channel, method, args, webContentsId) {
  if (!spyEnabled) return
  const entry = {
    id: ++spyIdCounter,
    timestamp: Date.now(),
    direction,
    channel,
    method,
    args: safeCloneArgs(args)
  }
  if (webContentsId !== undefined) {
    entry.webContentsId = webContentsId
  }
  spyLog.push(entry)
  // 循環バッファ: 最大件数を超えたら古いものを削除
  if (spyLog.length > SPY_MAX_ENTRIES) {
    spyLog.shift()
  }
}

// ========== IPC Mock ==========
const mocks = new Map()
const originalHandlers = new Map()

// ipcMain.handle をフック（app ready 前でも安全）
const originalHandle = ipcMain.handle.bind(ipcMain)

ipcMain.handle = (channel, handler) => {
  originalHandlers.set(channel, handler)

  return originalHandle(channel, async (event, ...args) => {
    // スパイログ記録
    addSpyEntry('renderer-to-main', channel, 'invoke', args)

    if (mocks.has(channel)) {
      const response = mocks.get(channel)
      console.log(`[KamoX Mock] Intercepted IPC invoke: ${channel} -> ${JSON.stringify(response).substring(0, 100)}${JSON.stringify(response).length > 100 ? '...' : ''}`)
      return response
    }
    return handler(event, ...args)
  })
}

// ipcMain.on をフック（fire-and-forget パターン）
const originalOn = ipcMain.on.bind(ipcMain)

ipcMain.on = (channel, listener) => {
  return originalOn(channel, (event, ...args) => {
    // スパイログ記録
    addSpyEntry('renderer-to-main', channel, 'on', args)

    return listener(event, ...args)
  })
}

// Main→Renderer フック: webContents.send を全 webContents でインターセプト
app.on('web-contents-created', (event, webContents) => {
  const originalSend = webContents.send.bind(webContents)
  webContents.send = (channel, ...args) => {
    addSpyEntry('main-to-renderer', channel, 'send', args, webContents.id)
    return originalSend(channel, ...args)
  }
})

// ========== Native Dialog Mock ==========
const dialogMocks = new Map()
const DIALOG_METHODS = [
  'showOpenDialog',
  'showSaveDialog',
  'showMessageBox',
  'showMessageBoxSync',
  'showErrorBox'
]
const SYNC_METHODS = ['showMessageBoxSync', 'showErrorBox']
const originalDialogMethods = {}

// dialog は app.whenReady() 後でないとアクセスできないため遅延フック
app.whenReady().then(() => {
  const { dialog } = require('electron')

  for (const method of DIALOG_METHODS) {
    if (typeof dialog[method] === 'function') {
      originalDialogMethods[method] = dialog[method].bind(dialog)

      dialog[method] = function (...args) {
        if (dialogMocks.has(method)) {
          const response = dialogMocks.get(method)
          console.log(`[KamoX Mock] Intercepted dialog.${method}`)
          if (SYNC_METHODS.includes(method)) {
            return response
          }
          return Promise.resolve(response)
        }
        return originalDialogMethods[method](...args)
      }
    }
  }
  console.log('[KamoX] Dialog hooks installed')
})

// ========== Global Mock API (Playwright evaluate() からアクセス) ==========
global.__kamoxMocks = {
  // IPC Mock API
  setMock: (channel, response) => {
    mocks.set(channel, response)
    console.log(`[KamoX Hook] IPC mock set: ${channel}`)
  },
  clearMock: (channel) => {
    mocks.delete(channel)
    console.log(`[KamoX Hook] IPC mock cleared: ${channel}`)
  },
  clearAllMocks: () => {
    mocks.clear()
    console.log('[KamoX Hook] All IPC mocks cleared')
  },
  getMocks: () => {
    const result = {}
    mocks.forEach((value, key) => { result[key] = value })
    return result
  },

  // Dialog Mock API
  setDialogMock: (method, response) => {
    dialogMocks.set(method, response)
    console.log(`[KamoX Hook] Dialog mock set: ${method}`)
  },
  clearDialogMock: (method) => {
    dialogMocks.delete(method)
    console.log(`[KamoX Hook] Dialog mock cleared: ${method}`)
  },
  clearAllDialogMocks: () => {
    dialogMocks.clear()
    console.log('[KamoX Hook] All dialog mocks cleared')
  },
  getDialogMocks: () => {
    const result = {}
    dialogMocks.forEach((value, key) => { result[key] = value })
    return result
  },

  // 全モック一括クリア
  clearAll: () => {
    mocks.clear()
    dialogMocks.clear()
    console.log('[KamoX Hook] All mocks cleared')
  }
}

// ========== Global Spy API ==========
global.__kamoxSpy = {
  start: () => {
    spyEnabled = true
    console.log('[KamoX Spy] Started')
  },
  stop: () => {
    spyEnabled = false
    console.log('[KamoX Spy] Stopped')
  },
  isActive: () => spyEnabled,
  getLogs: () => [...spyLog],
  clear: () => {
    spyLog.length = 0
    spyIdCounter = 0
    console.log('[KamoX Spy] Logs cleared')
  },
  // 指定 ID より後のログのみ返す（差分取得用）
  getLogsSince: (sinceId) => spyLog.filter(e => e.id > sinceId)
}
