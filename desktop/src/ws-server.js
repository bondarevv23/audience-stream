const { WebSocketServer, WebSocket } = require('ws');

let wss = null;
let restartTimer = null;
let callbacks = {};

/**
 * Start WebSocket server on given port.
 * Auto-restarts on crash after 3 seconds.
 */
function startWSServer(port = 8080, cbs = {}) {
  callbacks = cbs;
  _start(port);
}

function _start(port) {
  try {
    wss = new WebSocketServer({ port, host: '127.0.0.1' });

    wss.on('listening', () => {
      console.log(`[WS] Server listening on ws://127.0.0.1:${port}`);
    });

    wss.on('connection', (socket, req) => {
      console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);
      console.log(`[WS] ✅ Extension connected`);

      socket.on('message', (raw) => {
        try {
          const event = JSON.parse(raw.toString());
          handleMessage(event, socket);
        } catch (e) {
          console.error('[WS] Bad message:', e.message);
        }
      });

      socket.on('close', () => {
        console.log('[WS] Client disconnected');
      });

      socket.on('error', (err) => {
        console.error('[WS] Socket error:', err.message);
      });

      // Send current state to newly connected client
      const state = {
        type: 'state',
        isTracking: callbacks.isTracking?.() ?? false,
        consent: callbacks.getConsent?.() ?? {},
        userId: callbacks.getUserId?.() ?? null,
      };
      socket.send(JSON.stringify(state));
    });

    wss.on('error', (err) => {
      console.error('[WS] Server error:', err.message);
      scheduleRestart(port);
    });

    wss.on('close', () => {
      console.warn('[WS] Server closed unexpectedly');
      console.log('[WS] ❌ Extension disconnected (browser closed or extension stopped)');
      scheduleRestart(port);
    });
  } catch (err) {
    console.error('[WS] Failed to start:', err.message);
    scheduleRestart(port);
  }
}

function handleMessage(event, socket) {
  switch (event.type) {
    case 'ping':
      socket.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'TAB_OPEN':
      console.log(`[TRACK] ${timestamp()} | 🟢 Opened browser/tab`);
      console.log(`         URL:   ${event.url}`);
      console.log(`         Title: "${event.title}"`);
      callbacks.onEvent?.(event);
      socket.send(JSON.stringify({ type: 'ack', received: true }));
      break;

    case 'TAB_SWITCHED':
      console.log(`[TRACK] ${timestamp()} | 🔄 Switched to another tab`);
      console.log(`         URL:   ${event.url}`);
      console.log(`         Title: "${event.title}"`);
      callbacks.onEvent?.(event);
      socket.send(JSON.stringify({ type: 'ack', received: true }));
      break;

    case 'TAB_CLOSE':
      const secClose = event.durationMs ? (event.durationMs / 1000).toFixed(1) : '?';
      console.log(`[TRACK] ${timestamp()} | 🔴 Closed/switched tab`);
      console.log(`         URL:      ${event.url}`);
      console.log(`         Title:    "${event.title}"`);
      console.log(`         Duration: ${secClose}s`);
      callbacks.onEvent?.(event);
      socket.send(JSON.stringify({ type: 'ack', received: true }));
      break;

    case 'TAB_IDLE':
      const secIdle = event.durationMs ? (event.durationMs / 1000).toFixed(1) : '?';
      console.log(`[TRACK] ${timestamp()} | 💤 Left browser`);
      console.log(`         URL:      ${event.url}`);
      console.log(`         Title:    "${event.title}"`);
      console.log(`         Duration: ${secIdle}s`);
      callbacks.onEvent?.(event);
      socket.send(JSON.stringify({ type: 'ack', received: true }));
      break;

    // For future event types like 'activity' or 'window' focus changes
    case 'url':
    case 'activity':
    case 'window':
      console.log(`[TRACK] ${timestamp()} | ${event.type.toUpperCase()} | ${event.url}`);
      callbacks.onEvent?.(event);
      socket.send(JSON.stringify({ type: 'ack', received: true }));
      break;

    default:
      console.warn('[WS] Unknown event type:', event.type);
  }
}

function timestamp() {
  return new Date().toLocaleTimeString();
}

function scheduleRestart(port) {
  if (restartTimer) return;
  console.log('[WS] Scheduling restart in 3s...');
  restartTimer = setTimeout(() => {
    restartTimer = null;
    _start(port);
  }, 3000);
}

async function stopWSServer() {
  return new Promise((resolve) => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }

    if (!wss) return resolve();

    // Close all open sockets
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1001, 'Server shutting down');
      }
    });

    wss.close(() => {
      console.log('[WS] Server stopped.');
      wss = null;
      resolve();
    });
  });
}

/**
 * Broadcast a message to all connected clients.
 */
function broadcast(data) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

module.exports = { startWSServer, stopWSServer, broadcast };