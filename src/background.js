const MANAGER_PATH = "src/panel.html";
const MANAGER_URL = chrome.runtime.getURL(MANAGER_PATH);

chrome.action.onClicked.addListener((tab) => {
  void openManager(tab);
});

if (chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "open-manager") {
      void openManager();
    }
  });
}

async function openManager(tab) {
  if (await tryOpenSidePanel(tab)) return;
  await chrome.tabs.create({ url: MANAGER_URL });
}

async function tryOpenSidePanel(tab) {
  if (!chrome.sidePanel?.open) return false;

  try {
    const windowId = typeof tab?.windowId === "number"
      ? tab.windowId
      : await getFocusedWindowId();
    if (typeof windowId !== "number") return false;

    await chrome.sidePanel.open({ windowId });
    return true;
  } catch {
    return false;
  }
}

async function getFocusedWindowId() {
  if (!chrome.windows?.getLastFocused) return undefined;
  try {
    const window = await chrome.windows.getLastFocused();
    return window?.id;
  } catch {
    return undefined;
  }
}
