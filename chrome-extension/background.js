const socket = new WebSocket("ws://localhost:8080"); //check

socket.onerror = () => {};

let currentTab = null;
let startTime = null;

function send(data) {

  console.log(data);

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }

}

function getDuration() {

  if (!startTime) return 0;

  return Date.now() - startTime;

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
    title: tabs[0].title,
    url: tabs[0].url
  };

  send({
    type: "TAB_OPEN",
    title: currentTab.title,
    url: currentTab.url
  });

  startTimer();

});

// User switches tabs
chrome.tabs.onActivated.addListener(async (info) => {

  // Send previous tab time
  if (currentTab && startTime) {

    send({
      type: "TAB_CLOSE",
      title: currentTab.title,
      url: currentTab.url,
      durationMs: getDuration()
    });

  }

  // Get new tab
  const tab = await chrome.tabs.get(info.tabId);

  currentTab = {
    title: tab.title,
    url: tab.url
  };

  // Send new tab event
  send({
    type: "TAB_SWITCHED",
    title: currentTab.title,
    url: currentTab.url
  });

  resetTimer();

});

// User tabs OUT of Chrome
chrome.windows.onFocusChanged.addListener((windowId) => {

  // Chrome unfocused
  if (windowId === chrome.windows.WINDOW_ID_NONE) {

    if (currentTab && startTime) {

      send({
        type: "TAB_IDLE",
        title: currentTab.title,
        url: currentTab.url,
        durationMs: getDuration()
      });

      startTime = null;

    }

  }

  // User returns to Chrome
  else {

    if (currentTab && !startTime) {

      resetTimer();

    }

  }

});