const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Store = require('electron-store');
const { startWSServer, stopWSServer } = require('./ws-server');
const db = require('./db');

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
let flushInterval = null;

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
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
  try { await flushWorker(); } catch (e) { console.error('[App] Final flush error:', e.message); }
  try { await stopWSServer(); } catch (e) { console.error('[App] WS stop error:', e.message); }
  app.exit(0);
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createWindow();
  createTray();

  await db.init();

  // Start WebSocket server (port 8080)
  startWSServer(8080, {
    onEvent: handleTrackingEvent,
    getConsent: () => store.get('consent'),
    isTracking: () => store.get('isTracking'),
    getUserId: () => store.get('userId'),
  });

  // Background flush worker — drain outbox every 5 seconds
  flushInterval = setInterval(flushWorker, 5_000);
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  // Keep app alive in tray on Windows/Linux
  if (process.platform === 'darwin') app.quit();
});

// ─── Tracking event handler ───────────────────────────────────────────────────
function handleTrackingEvent(event) {
  if (!store.get('isTracking')) return;

  const consent = store.get('consent');
  const userId = store.get('userId');

  // Apply consent filters
  const filtered = filterByConsent(event, consent);
  if (!filtered) return;

  // Persist to SQLite outbox — survives crashes and network outages
  const record = { userId, ...filtered, ts: Date.now() };
  db.insertEvent(record.userId, filtered.type || 'unknown', record);
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

async function flushWorker() {
  // Re-queue eligible failed events before fetching pending
  db.retryFailed();

  const pending = db.getPendingEvents(50);

  mainWindow?.webContents.send('outbox-stats', db.getStats());

  if (pending.length === 0) return;

  const ids = pending.map((r) => r.id);
  const batch = pending.map((r) => JSON.parse(r.payload));

  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8081/api/events';
    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': '123' },
      body: JSON.stringify({ events: batch }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const earned = data.coinsEarned || 0;

    db.markSent(ids);

    const newCoins = parseFloat((store.get('coins') + earned).toFixed(4));
    store.set('coins', newCoins);

    mainWindow?.webContents.send('coins-update', newCoins);
    mainWindow?.webContents.send('events-sent', batch.length);
    mainWindow?.webContents.send('outbox-stats', db.getStats());
  } catch (err) {
    console.error('[Backend] Send failed:', err.message);
    db.markFailed(ids);
    mainWindow?.webContents.send('backend-error', err.message);
    mainWindow?.webContents.send('outbox-stats', db.getStats());
  }
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