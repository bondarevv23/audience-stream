const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Store = require('electron-store');
const { startWSServer, stopWSServer } = require('./ws-server');

// ─── Persistent store (survives app restart, NOT reinstall) ───────────────────
const store = new Store({
  name: 'nielsen-data',
  defaults: {
    userId: null,
    coins: 0,
    isTracking: false,
    consent: {
      browserHistory: false,
      anonymousMode: true,
      activeWindow: false,
      shareWithNielsen: false,
    },
    firstRun: true,
  },
});

// ─── Generate userId once per install ────────────────────────────────────────
if (!store.get('userId')) {
  store.set('userId', uuidv4());
}

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    resizable: false,
    frame: false,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    backgroundColor: '#0f0f13',
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of closing
    e.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  // Use a blank image if no icon file — replace with real 16x16 png
  const img = nativeImage.createEmpty();
  tray = new Tray(img);
  tray.setToolTip('Nielsen Tracker');

  const menu = Menu.buildFromTemplate([
    { label: 'Open', click: () => mainWindow.show() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        gracefulShutdown();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => mainWindow.show());
}

async function gracefulShutdown() {
  console.log('[App] Graceful shutdown...');
  try {
    await stopWSServer();
  } catch (e) {
    console.error('[App] WS stop error:', e.message);
  }
  app.exit(0);
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createWindow();
  createTray();

  // Start WebSocket server (port 8080)
  startWSServer(8080, {
    onEvent: handleTrackingEvent,
    getConsent: () => store.get('consent'),
    isTracking: () => store.get('isTracking'),
    getUserId: () => store.get('userId'),
  });

  // Auto-restart WS if it crashes (handled inside ws-server.js)
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  // Keep app alive in tray on Windows/Linux
  if (process.platform === 'darwin') app.quit();
});

// ─── Tracking event handler ───────────────────────────────────────────────────
let pendingEvents = [];
let retryTimer = null;

function handleTrackingEvent(event) {
  if (!store.get('isTracking')) return;

  const consent = store.get('consent');
  const userId = store.get('userId');

  // Apply consent filters
  const filtered = filterByConsent(event, consent);
  if (!filtered) return;

  // Add to pending queue, then try to send
  pendingEvents.push({ userId, ...filtered, ts: Date.now() });
  flushEvents();
}

function filterByConsent(event, consent) {
  if (event.type === 'url' && !consent.browserHistory) return null;
  if (event.type === 'window' && !consent.activeWindow) return null;

  // Anonymize if needed
  if (consent.anonymousMode) {
    return { ...event, userId: 'anon', url: anonymizeUrl(event.url) };
  }
  return event;
}

function anonymizeUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    return u.hostname; // only domain, no path
  } catch {
    return 'unknown';
  }
}

// async function flushEvents() {
//   if (pendingEvents.length === 0) return;
//   const batch = [...pendingEvents];
//   pendingEvents = [];

//   try {
//     const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000/api/events';
//     const res = await fetch(backendUrl, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ events: batch }),
//       signal: AbortSignal.timeout(5000),
//     });

//     if (!res.ok) throw new Error(`HTTP ${res.status}`);

//     const data = await res.json();
//     const earned = data.coinsEarned || 0;

//     // Update coins
//     const newCoins = parseFloat((store.get('coins') + earned).toFixed(4));
//     store.set('coins', newCoins);

//     // Notify renderer
//     mainWindow?.webContents.send('coins-update', newCoins);
//     mainWindow?.webContents.send('events-sent', batch.length);

//     // Clear retry timer
//     if (retryTimer) {
//       clearTimeout(retryTimer);
//       retryTimer = null;
//     }
//   } catch (err) {
//     console.error('[Backend] Send failed:', err.message);
//     // Put events back and retry in 10s
//     pendingEvents = [...batch, ...pendingEvents];
//     if (!retryTimer) {
//       retryTimer = setTimeout(() => {
//         retryTimer = null;
//         flushEvents();
//       }, 10_000);
//     }
//     mainWindow?.webContents.send('backend-error', err.message);
//   }
// }

async function flushEvents() {
  if (pendingEvents.length === 0) return;
  const batch = [...pendingEvents];
  pendingEvents = [];

  // MOCK — убрать когда бэкенд будет готов
  const earned = batch.length * 0.1;
  const newCoins = parseFloat((store.get('coins') + earned).toFixed(4));
  store.set('coins', newCoins);
  mainWindow?.webContents.send('coins-update', newCoins);
  mainWindow?.webContents.send('events-sent', batch.length);
  console.log('[Mock] Events:', batch);
}

// ─── IPC handlers (renderer ↔ main) ─────────────────────────────────────────
ipcMain.handle('get-state', () => ({
  userId: store.get('userId'),
  coins: store.get('coins'),
  isTracking: store.get('isTracking'),
  consent: store.get('consent'),
  firstRun: store.get('firstRun'),
}));

ipcMain.handle('set-tracking', (_, value) => {
  store.set('isTracking', value);
  mainWindow?.webContents.send('tracking-changed', value);
  return value;
});

ipcMain.handle('save-consent', (_, consent) => {
  store.set('consent', consent);
  store.set('firstRun', false);
  mainWindow?.webContents.send('consent-changed', consent);
  return consent;
});

ipcMain.handle('get-coins', () => store.get('coins'));