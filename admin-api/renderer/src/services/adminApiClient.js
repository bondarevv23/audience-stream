function getBridge() {
  return window.adminApi || null;
}

export function hasElectronBridge() {
  return Boolean(getBridge());
}

export function normalizeEvents(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.events)) {
    return response.events;
  }

  return [];
}

export async function fetchRecentEvents(limit = 100) {
  const bridge = getBridge();

  if (!bridge) {
    throw new Error("Electron bridge is not available");
  }

  const response = await bridge.getRecentEvents(limit);
  return normalizeEvents(response);
}

export async function fetchEventsByType(eventType, filters = {}) {
  const bridge = getBridge();

  if (!bridge) {
    throw new Error("Electron bridge is not available");
  }

  const response = await bridge.getEventsByType(eventType, filters);
  return normalizeEvents(response);
}

export async function askGemini(question) {
  const bridge = getBridge();

  if (!bridge) {
    throw new Error("Electron bridge is not available");
  }

  return bridge.askGemini(question);
}
