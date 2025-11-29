document.getElementById('getInfo').addEventListener('click', async () => {
    const resultDiv = document.getElementById('result');
    resultDiv.textContent = 'Loading...';

    try {
        // アクティブタブの取得
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            throw new Error('No active tab found');
        }

        // Content Scriptへのメッセージ送信
        let pageInfo = { error: 'Content script not ready' };
        try {
            pageInfo = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
        } catch (e) {
            console.warn('Message failed, trying scripting execution', e);
            // フォールバック: scripting APIで直接実行
            const injection = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.title
            });
            pageInfo = { title: injection[0].result, note: 'Fetched via scripting API' };
        }

        const info = {
            tabId: tab.id,
            tabUrl: tab.url,
            tabTitle: tab.title,
            pageInfo: pageInfo
        };

        resultDiv.textContent = JSON.stringify(info, null, 2);
    } catch (error) {
        resultDiv.textContent = 'Error: ' + error.message;
        resultDiv.classList.add('error');
        console.error(error);
    }
});
