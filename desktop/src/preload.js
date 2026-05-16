const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nielsen', {
  // Get full state from main process
  getState: () => ipcRenderer.invoke('get-state'),

  // Toggle tracking on/off
  setTracking: (value) => ipcRenderer.invoke('set-tracking', value),

  // Save consent settings
  saveConsent: (consent) => ipcRenderer.invoke('save-consent', consent),

  // Get current coins
  getCoins: () => ipcRenderer.invoke('get-coins'),

  // Subscribe to events from main
  on: (channel, callback) => {
    const allowed = [
      'coins-update',
      'tracking-changed',
      'consent-changed',
      'events-sent',
      'backend-error',
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
    }
  },

  off: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});