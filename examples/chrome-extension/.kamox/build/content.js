console.log('KamoX Content Script loaded');

// 注入確認用の属性
document.body.setAttribute('data-kamox-injected', 'true');

// メッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getPageInfo') {
        const info = {
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.content || '',
            h1: document.querySelector('h1')?.innerText || '',
            timestamp: Date.now()
        };
        sendResponse(info);
    }
});
