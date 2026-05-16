document.addEventListener("mousemove", (e) => {

  chrome.runtime.sendMessage({
    type: "MOUSE_MOVE",
    x: e.clientX,
    y: e.clientY
  });
});
