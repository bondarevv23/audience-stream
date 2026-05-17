// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  userId: null,
  coins: 0,
  isTracking: false,
  consent: { browserHistory: false, anonymousMode: true, activeWindow: false, desktopApps: false, shareWithNielsen: false },
  firstRun: true,
};

let selectedMode = 'anon';
let selectedModeSettings = 'anon';
let totalEvents = 0;
let coinsThisHour = 0;
let hourStart = Date.now();

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  state = await window.nielsen.getState();
  selectedMode = state.consent.anonymousMode ? 'anon' : 'identified';
  selectedModeSettings = selectedMode;

  if (!state.firstRun) {
    showMain();
  }
  // else: consent view is already shown by default

  updateUI();
  setupListeners();
}

function updateUI() {
  document.getElementById('uid-display').textContent = 'uid: ' + (state.userId || '').slice(0, 8) + '…';
  document.getElementById('coins-display').textContent = state.coins.toFixed(4);

  const powerBtn = document.getElementById('power-btn');
  const powerLabel = document.getElementById('power-label');
  if (state.isTracking) {
    powerBtn.className = 'power-ring on';
    powerLabel.textContent = 'TRACKING ON';
  } else {
    powerBtn.className = 'power-ring off';
    powerLabel.textContent = 'TRACKING OFF';
  }

  const modeBadge = document.getElementById('mode-badge');
  if (state.consent.anonymousMode) {
    modeBadge.textContent = 'ANON';
    modeBadge.className = 'mode-badge anon';
  } else {
    modeBadge.textContent = 'IDENTIFIED';
    modeBadge.className = 'mode-badge identified';
  }

  // Sync settings panel toggles
  const sb = document.getElementById('s-browser');
  const sw = document.getElementById('s-window');
  const sa = document.getElementById('s-apps');
  const sn = document.getElementById('s-nielsen');
  if (sb) sb.checked = !!state.consent.browserHistory;
  if (sw) sw.checked = !!state.consent.activeWindow;
  if (sa) sa.checked = !!state.consent.desktopApps;
  if (sn) sn.checked = !!state.consent.shareWithNielsen;
}

// ─── Consent view ─────────────────────────────────────────────────────────────
function selectMode(mode) {
  selectedMode = mode;
  document.getElementById('chip-anon').classList.toggle('selected', mode === 'anon');
  document.getElementById('chip-identified').classList.toggle('selected', mode === 'identified');
}

async function saveConsent() {
  const consent = {
    browserHistory: document.getElementById('c-browser').checked,
    desktopApps: document.getElementById('c-apps').checked,      // ← новый id и ключ
    shareWithNielsen: document.getElementById('c-nielsen').checked,
    anonymousMode: selectedMode === 'anon',
  };
  state.consent = await window.nielsen.saveConsent(consent);
  state.firstRun = false;
  showMain();
  updateUI();
}

// ─── Main view ────────────────────────────────────────────────────────────────
function showMain() {
  document.getElementById('consent-view').classList.remove('active');
  document.getElementById('main-view').classList.add('active');
}

async function toggleTracking() {
  const newVal = !state.isTracking;
  state.isTracking = await window.nielsen.setTracking(newVal);
  updateUI();
  updateStatus(newVal ? 'green' : '', newVal ? 'Collecting data…' : 'Paused');
}

// ─── Settings panel ───────────────────────────────────────────────────────────
function openSettings() {
  updateUI(); // sync toggles
  document.getElementById('settings-panel').classList.add('open');
}

function closeSettings() {
  document.getElementById('settings-panel').classList.remove('open');
}

function selectModeSettings(mode) {
  selectedModeSettings = mode;
  document.getElementById('s-chip-anon').classList.toggle('selected', mode === 'anon');
  document.getElementById('s-chip-identified').classList.toggle('selected', mode === 'identified');
  updateConsentLive();
}

async function updateConsentLive() {
  const consent = {
    browserHistory: document.getElementById('s-browser').checked,
    desktopApps: document.getElementById('s-apps').checked,      // ← новый id и ключ
    shareWithNielsen: document.getElementById('s-nielsen').checked,
    anonymousMode: selectedModeSettings === 'anon',
  };
  state.consent = await window.nielsen.saveConsent(consent);
  updateUI();
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function updateStatus(dotClass, text) {
  const dot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  dot.className = 'status-dot ' + dotClass;
  statusText.textContent = text;
}

// ─── IPC events from main process ────────────────────────────────────────────
function setupListeners() {
  window.nielsen.on('coins-update', (coins) => {
    state.coins = coins;
    document.getElementById('coins-display').textContent = coins.toFixed(4);

    coinsThisHour += 0.0001;
    const hrElapsed = (Date.now() - hourStart) / 3600000;
    const rate = hrElapsed > 0 ? (coinsThisHour / hrElapsed).toFixed(2) : '0.00';
    document.getElementById('rate-display').textContent = `+${rate} / hr`;
  });

  window.nielsen.on('events-sent', (count) => {
    totalEvents += count;
    document.getElementById('events-count').textContent = totalEvents;
    document.getElementById('ws-status').textContent = 'connected';
    document.getElementById('ws-status').style.color = '#2de08b';
    updateStatus('green', `${totalEvents} events sent to Nielsen`);
  });

  window.nielsen.on('tracking-changed', (val) => {
    state.isTracking = val;
    updateUI();
  });

  window.nielsen.on('consent-changed', (consent) => {
    state.consent = consent;
    updateUI();
  });

  window.nielsen.on('backend-error', (msg) => {
    updateStatus('red', 'Backend error — retrying…');
    console.warn('[UI] Backend error:', msg);
  });

  window.nielsen.on('outbox-stats', (stats) => {
    console.log(`[Outbox] pending=${stats.pending} sent=${stats.sent} failed=${stats.failed}`);
    const el = document.getElementById('outbox-pending');
    if (el) el.textContent = stats.pending > 0 ? `${stats.pending} queued` : '';
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();