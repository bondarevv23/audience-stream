export const NAV_ITEMS = [
  { id: "REALTIME", label: "Live Activity" },
  { id: "TAB_SWITCHED", label: "Navigation Paths" },
  { id: "TAB_CLOSE", label: "Session Time" },
  { id: "TAB_IDLE", label: "Attention Gaps" },
  { id: "TAB_OPEN", label: "Browser Starts" },
  { id: "GEMINI", label: "Audience Ask" }
];

export function getPageTitle(activeView) {
  if (activeView === "REALTIME") {
    return "Live Activity";
  }

  if (activeView === "GEMINI") {
    return "Audience Ask";
  }

  const item = NAV_ITEMS.find((navItem) => navItem.id === activeView);
  return item?.label || "Dashboard";
}
