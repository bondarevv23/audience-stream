const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const { getEvents, getEventsByType, getRecentEvents } = require("./api");
const { askGemini } = require("./gemini");

const VITE_DEV_URL = process.env.VITE_DEV_URL || "http://localhost:5173";
const isDev = !app.isPackaged;

let mainWindow = null;

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
    title: "Administrator Statistics",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle("admin:get-events", async (_event, filters = {}) => {
    try {
      return await getEvents(filters);
    } catch (err) {
      console.error("[ipc] admin:get-events failed:", err.message);
      throw err;
    }
  });

  ipcMain.handle("admin:get-events-by-type", async (_event, eventType, filters = {}) => {
    try {
      return await getEventsByType(eventType, filters);
    } catch (err) {
      console.error("[ipc] admin:get-events-by-type failed:", err.message);
      throw err;
    }
  });

  ipcMain.handle("admin:get-recent-events", async (_event, limit = 50) => {
    try {
      return await getRecentEvents(limit);
    } catch (err) {
      console.error("[ipc] admin:get-recent-events failed:", err.message);
      throw err;
    }
  });

  ipcMain.handle("admin:ask-gemini", async (_event, question) => {
    try {
      return await askGemini(question);
    } catch (err) {
      console.error("[ipc] admin:ask-gemini failed:", err.message);
      throw err;
    }
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
