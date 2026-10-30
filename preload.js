const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {

  // 🔐 التفعيل فقط
  activateApp: (key) => ipcRenderer.invoke("activate-key", key),

  // 📊 (اختياري إذا تحتاجه لاحقًا)
  saveHistory: (data) => ipcRenderer.invoke("save-history", data),
  getHistory: () => ipcRenderer.invoke("get-history")

});