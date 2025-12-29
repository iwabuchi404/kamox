// KamoX Development Background Worker
// This file is auto-generated for development purposes only
// DO NOT EDIT - This file will be regenerated on each KamoX startup

chrome.runtime.onInstalled.addListener(() => {
  console.log('[KamoX] Development mode active');
});

// タブ情報へのアクセスを可能にする
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'kamox:getTabInfo') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ success: true, tab: tabs[0] });
    });
    return true; // 非同期レスポンス
  }
  
  if (request.action === 'kamox:getAllTabs') {
    chrome.tabs.query({}, (tabs) => {
      sendResponse({ success: true, tabs });
    });
    return true;
  }
});
