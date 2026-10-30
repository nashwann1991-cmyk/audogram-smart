const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { verifyKey } = require("./license");
const { isActivated, saveActivation } = require("./storage");

let mainWindow;

function createWindow() {

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 1000,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true
        }
    });

    mainWindow.loadFile("splash.html");

    setTimeout(() => {

        const status = isActivated(); // ❌ بدون await

        if (!status || status.expired) {
            mainWindow.loadFile("activation.html");
        } else {
            mainWindow.loadFile("dist/index.html");
        }

    }, 1500);
}

// 🔑 التفعيل + الحفظ هنا (مهم جدًا)
ipcMain.handle("activate-key", async (event, key) => {

    const result = await verifyKey(key);

    if (result.success) {

        // 💾 لازم تحفظ هنا (إجباري)
        saveActivation({
            key,
            active: true,
            expiresAt: result.expiresAt,
            daysLeft: result.daysLeft
        });
    }

    return result;
});

app.whenReady().then(createWindow);