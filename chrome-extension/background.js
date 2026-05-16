let socket = null;

function connectWebSocket() {

  socket = new WebSocket("ws://localhost:8080");

  socket.onopen = () => {
    console.log("WebSocket connected");
  };

  socket.onclose = () => {

    console.log("WebSocket disconnected");

    // Retry after 2 sec
    setTimeout(connectWebSocket, 2000);

  };

  socket.onerror = () => {

    socket.close();

  };

}

connectWebSocket();

let currentTab = null;
let startTime = null;

const SAFE_PARAMS = [
  "q",
  "v",
  "id",
  "search_query",
  "term",
  "query",
  "search"
];

function generateEventId() {

  return "evt_" + Math.random().toString(36).substring(2, 10);

}

function sanitizeUrl(rawUrl) {

  try {

    const url = new URL(rawUrl);

    const cleanParams = new URLSearchParams();

    let searchIntent = "";

    for (const key of SAFE_PARAMS) {

      const value = url.searchParams.get(key);

      if (value) {

        cleanParams.set(key, value);

        if (
              key === "q" ||
              key === "search_query" ||
              key === "term" ||
              key === "query" ||
              key === "search"
            ) {
              searchIntent = value;
            }

      }

    }

    url.search = cleanParams.toString();

    return {
      cleanUrl: url.toString(),
      domain: url.hostname,
      searchIntent: searchIntent
    };

  } catch {

    return {
      cleanUrl: rawUrl,
      domain: "",
      searchIntent: ""
    };

  }

}

function createEvent(eventType, durationSeconds = 0) {

  if (!currentTab) return null;

  const sanitized = sanitizeUrl(currentTab.url);

  return {
    event_id: generateEventId(),

    timestamp: new Date().toISOString(),

    event_type: eventType,

    duration_seconds: durationSeconds,

    payload: {
      domain: sanitized.domain,

      full_url: sanitized.cleanUrl,

      title: currentTab.title,

      search_intent: sanitized.searchIntent,

      browser: "Chrome",

      device: navigator.platform
    }
  };

}

function send(data) {

  if (!data) return;

  console.log("EVENT SENT:");
  console.log(data);

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}
  
function getDurationSeconds() {

  if (!startTime) return 0;

  return Math.floor((Date.now() - startTime) / 1000);

}

function startTimer() {

  startTime = Date.now();

}

function resetTimer() {

  startTime = Date.now();

}

// Initial active tab
chrome.tabs.query({
  active: true,
  currentWindow: true
}, (tabs) => {

  if (!tabs[0]) return;

  currentTab = {
    id: tabs[0].id,
    title: tabs[0].title,
    url: tabs[0].url
  };

  send(createEvent("TAB_OPEN"));

  startTimer();

});

// User switches tabs
chrome.tabs.onActivated.addListener(async (info) => {

  // Close previous tab
  if (currentTab && startTime) {

    send(
      createEvent(
        "TAB_CLOSE",
        getDurationSeconds()
      )
    );

  }

  // New active tab
  const tab = await chrome.tabs.get(info.tabId);

  currentTab = {
    id: tab.id,
    title: tab.title,
    url: tab.url
  };

  send(createEvent("TAB_SWITCHED"));

  resetTimer();

});

// User tabs out of Chrome
chrome.windows.onFocusChanged.addListener((windowId) => {

  // Chrome unfocused
  if (windowId === chrome.windows.WINDOW_ID_NONE) {

    if (currentTab && startTime) {

      send(
        createEvent(
          "TAB_IDLE",
          getDurationSeconds()
        )
      );

      startTime = null;

    }

  }

  // User returned to Chrome
  else {

    if (currentTab && !startTime) {

      resetTimer();

    }

  }

});

// Detect URL changes / searches
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

  // Only track current active tab
  if (!tab.active) return;

  // URL changed
  if (changeInfo.url) {

    currentTab = {
      id: tab.id,
      title: tab.title,
      url: changeInfo.url
    };

    const sanitized = sanitizeUrl(changeInfo.url);

    // Only emit SEARCHED if meaningful search exists
    if (sanitized.searchIntent) {

      send(createEvent("SEARCHED"));

    }

  }

});