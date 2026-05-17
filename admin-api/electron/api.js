const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

async function requestJson(path, options = {}) {
  const url = `${BACKEND_URL}${path}`;
  const method = options.method || "GET";
  console.log(`[admin-api] ${method} ${url}`);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      ...options
    });
  } catch (networkError) {
    console.error(`[admin-api] Network error for ${method} ${url}:`, networkError.message);
    throw new Error(`Cannot reach backend at ${BACKEND_URL} — is it running? (${networkError.message})`);
  }

  const text = await response.text();
  console.log(`[admin-api] ${method} ${url} → ${response.status} (${text.length} bytes)`);

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (parseError) {
    console.error(`[admin-api] Failed to parse JSON from ${method} ${url}:`, text.slice(0, 500));
    throw new Error(`Backend returned non-JSON response (status ${response.status})`);
  }

  if (!response.ok) {
    const message = data?.message || data?.error || data?.detail || `Backend request failed with ${response.status}`;
    console.error(`[admin-api] Error response from ${method} ${url}:`, { status: response.status, data });
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
