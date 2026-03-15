// KamoX Renderer Process Spy Script
// Playwright の addInitScript で全レンダラーに注入され、
// ipcRenderer.send / invoke をフックして window.__kamoxRendererSpy に記録する
// 純粋に window コンテキストで動く実装（require 不可）

; (function () {
    'use strict'

    // Electron のレンダラー環境でのみ動作
    var _ipcRenderer = window.require ? window.require('electron').ipcRenderer : null

    // フラグ: このスクリプトが実際にロードされたことを示す
    window.__kamoxHookLoaded = true

    if (!_ipcRenderer) {
        // Electron ではない or contextIsolation=true の場合はマーカーのみ
        window.__kamoxRendererSpy = null
        return
    }

    var log = []
    var idCounter = 0
    var MAX_ENTRIES = 500

    function addEntry(method, channel, args) {
        var entry = {
            id: ++idCounter,
            timestamp: Date.now(),
            direction: 'renderer-to-main',
            method: method,
            channel: channel,
            args: safeClone(args)
        }
        log.push(entry)
        if (log.length > MAX_ENTRIES) { log.shift() }
    }

    function safeClone(args) {
        try {
            return JSON.parse(JSON.stringify(args))
        } catch (_) {
            return args.map(function (a) {
                try { return JSON.parse(JSON.stringify(a)) } catch (_) { return '[Unserializable]' }
            })
        }
    }

    // --- send をフック ---
    var _send = _ipcRenderer.send.bind(_ipcRenderer)
    _ipcRenderer.send = function (channel) {
        var args = Array.prototype.slice.call(arguments, 1)
        addEntry('send', channel, args)
        return _send.apply(_ipcRenderer, arguments)
    }

    // --- sendSync をフック ---
    var _sendSync = _ipcRenderer.sendSync.bind(_ipcRenderer)
    _ipcRenderer.sendSync = function (channel) {
        var args = Array.prototype.slice.call(arguments, 1)
        addEntry('sendSync', channel, args)
        return _sendSync.apply(_ipcRenderer, arguments)
    }

    // --- invoke をフック ---
    var _invoke = _ipcRenderer.invoke.bind(_ipcRenderer)
    _ipcRenderer.invoke = function (channel) {
        var args = Array.prototype.slice.call(arguments, 1)
        addEntry('invoke', channel, args)
        return _invoke.apply(_ipcRenderer, arguments)
    }

    // RendererSpy API (ElectronAdapter から page.evaluate() でアクセス)
    window.__kamoxRendererSpy = {
        getLogs: function () { return log.slice() },
        getLogsSince: function (sinceId) { return log.filter(function (e) { return e.id > sinceId }) },
        clear: function () { log.length = 0; idCounter = 0 }
    }
})()
