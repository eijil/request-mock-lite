const RML_STORAGE_KEY = "requestMockLiteState";
const RML_RULES_EVENT = "REQUEST_MOCK_LITE_RULES";
const RML_READY_EVENT = "REQUEST_MOCK_LITE_READY";

void sendRulesToPage();

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.type !== RML_READY_EVENT) return;
  void sendRulesToPage();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[RML_STORAGE_KEY]) return;
  void sendRulesToPage();
});

async function sendRulesToPage() {
  try {
    const data = await chrome.storage.local.get(RML_STORAGE_KEY);
    window.postMessage({
      type: RML_RULES_EVENT,
      state: data[RML_STORAGE_KEY] || { groups: [], rules: [] }
    }, "*");
  } catch (error) {
    if (!String(error?.message || error).includes("Extension context invalidated")) {
      console.error(error);
    }
  }
}
