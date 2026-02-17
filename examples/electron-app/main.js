const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow(page = 'index.html', title = 'Main Window') {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        title: title,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile(page);
    win.webContents.openDevTools();
    return win;
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.handle('open-dialog', async (event, options) => {
        console.log('[IPC] Received open-dialog request');
        return await dialog.showOpenDialog(options);
    });

    ipcMain.handle('greet', async (event, name) => {
        console.log(`[IPC] Received greet request for ${name}`);
        return `Hello, ${name}!`;
    });

    ipcMain.on('open-settings', () => {
        console.log('[IPC] Received open-settings request');
        createWindow('settings.html', 'Settings Window');
    });

    ipcMain.on('submit-form', (event, data) => {
        console.log(`[IPC] Received form submission: ${JSON.stringify(data)}`);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
