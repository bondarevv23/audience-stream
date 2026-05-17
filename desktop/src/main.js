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
      desktopApps: false, 
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

function safeSend(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

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

  // Always use the real userId for coin tracking; anonymization only applies to content
  const record = { user_id: userId, ...filtered, ts: Date.now() };
  db.insertEvent(userId, filtered.type || 'unknown', record);
}

function filterByConsent(event, consent) {
  const browserTypes = ['TAB_OPEN', 'TAB_SWITCHED', 'TAB_CLOSE', 'TAB_IDLE', 'url', 'activity'];
  if (browserTypes.includes(event.type) && !consent.browserHistory) return null;

  if (event.type === 'window' && !consent.desktopApps) return null;

  if (!consent.shareWithNielsen) return null;

  if (consent.anonymousMode) {
    // Anonymize URL content only; user_id is kept real for coin tracking
    const { userId, user_id, ...rest } = event;
    return { ...rest, url: anonymizeUrl(event.url) };
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

  safeSend('outbox-stats', db.getStats());

  if (pending.length === 0) return;

  const ids = pending.map((r) => r.id);
  const batch = pending.map((r) => {
    const event = JSON.parse(r.payload);
    // Ensure snake_case user_id for backend; fall back to the outbox row's user_id
    if (!event.user_id) event.user_id = event.userId ?? r.user_id;
    delete event.userId;
    return event;
  });
  try {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8081/api/events';
  
  const res = await fetch(backendUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Api-Key': '123' },
  body: JSON.stringify(batch),
  signal: AbortSignal.timeout(5000),
  });

  const responseData = await res.json();
  console.log('[Backend] status:', res.status);
  console.log('[Backend] response:', JSON.stringify(responseData));

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const userId = store.get('userId');
  const userEntry = responseData.users?.find(u => u.userId === userId);
  const ratePerEvent = store.get('consent')?.anonymousMode ? 0.1 : 0.3;
  const earned = userEntry?.points ?? (batch.length * ratePerEvent);
  const newCoins = parseFloat((store.get('coins') + earned).toFixed(4));

  db.markSent(ids);

  store.set('coins', newCoins);
  safeSend('coins-update', newCoins);
  safeSend('events-sent', batch.length);
  safeSend('outbox-stats', db.getStats());
} catch (err) {
  console.error('[Backend] Send failed:', err.message);
  db.markFailed(ids);
  safeSend('backend-error', err.message);
  safeSend('outbox-stats', db.getStats());
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
  safeSend('tracking-changed', value);
  return value;
});

ipcMain.handle('save-consent', (_, consent) => {
  store.set('consent', consent);
  store.set('firstRun', false);
  safeSend('consent-changed', consent);
  return consent;
});

ipcMain.handle('get-coins', () => store.get('coins'));