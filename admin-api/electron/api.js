const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

async function requestJson(path, options = {}) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || `Backend request failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function getEvents(filters = {}) {
  return requestJson("/admin/events", {
    method: "POST",
    body: JSON.stringify(filters)
  });
}

async function getEventsByType(eventType, filters = {}) {
  return requestJson("/admin/events/by-type", {
    method: "POST",
    body: JSON.stringify({
      eventType,
      ...filters
    })
  });
}

async function getRecentEvents(limit = 50) {
  return requestJson(`/admin/events/recent?limit=${encodeURIComponent(limit)}`, {
    method: "GET"
  });
}

module.exports = {
  BACKEND_URL,
  getEvents,
  getEventsByType,
  getRecentEvents,
  requestJson
};
