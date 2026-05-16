const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("adminApi", {
  getEvents: (filters = {}) => ipcRenderer.invoke("admin:get-events", filters),
  getEventsByType: (eventType, filters = {}) => {
    return ipcRenderer.invoke("admin:get-events-by-type", eventType, filters);
  },
  getRecentEvents: (limit = 50) => ipcRenderer.invoke("admin:get-recent-events", limit),
  askGemini: (question) => ipcRenderer.invoke("admin:ask-gemini", question)
});
