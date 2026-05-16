const socket = new WebSocket("ws://localhost:8080");

socket.onerror = () => {};

let currentTab = null;
let startTime = null;

function send(data) {

  console.log(data);

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }

}

function stopTimer() {

  if (!currentTab || !startTime) return;

  send({
    type: "PAGE_TIME",
    title: currentTab.title,
    url: currentTab.url,
    durationMs: Date.now() - startTime
  });

  startTime = null;

}

function startTimer() {

  startTime = Date.now();

}

// Start tracking currently active tab on extension load
chrome.tabs.query({
  active: true,
  currentWindow: true
}, (tabs) => {

  if (!tabs[0]) return;

  currentTab = {
    title: tabs[0].title,
    url: tabs[0].url
  };

  send({
    type: "PAGE_CHANGED",
    title: currentTab.title,
    url: currentTab.url
  });

  startTimer();

});

// User switches tabs
chrome.tabs.onActivated.addListener(async (info) => {

  stopTimer();

  const tab = await chrome.tabs.get(info.tabId);

  currentTab = {
    title: tab.title,
    url: tab.url
  };

  send({
    type: "PAGE_CHANGED",
    title: currentTab.title,
    url: currentTab.url
  });

  startTimer();

});

// User tabs OUT of Chrome
chrome.windows.onFocusChanged.addListener((windowId) => {

  // Lost focus
  if (windowId === chrome.windows.WINDOW_ID_NONE) {

    stopTimer();

  }

  // Focused Chrome again
  else {

    if (currentTab && !startTime) {
      startTimer();
    }

  }

});