chrome.runtime.onInstalled.addListener(() => {
    console.log('KamoX Sample Extension installed');
});

// メッセージリスナー（テスト用）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    if (message.action === 'ping') {
        sendResponse({ status: 'pong' });
    }
});
