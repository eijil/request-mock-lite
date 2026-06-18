const RML_STORAGE_KEY = "requestMockLiteState";
const RML_CAPTURE_STORAGE_KEY = "requestMockLiteCaptured";
const RML_RULES_EVENT = "REQUEST_MOCK_LITE_RULES";
const RML_READY_EVENT = "REQUEST_MOCK_LITE_READY";
const RML_CAPTURE_EVENT = "REQUEST_MOCK_LITE_CAPTURE";
const RML_MAX_CAPTURED = 120;
const STATIC_RESOURCE_EXT_RE = /\.(avif|bmp|css|gif|ico|jpe?g|js|mjs|map|mp3|mp4|png|svg|webp|woff2?|ttf|otf)([?#].*)?$/i;
const STATIC_MIME_RE = /^(image|audio|video|font)\//i;
const STATIC_TEXT_MIME_RE = /\btext\/(css|javascript)\b|\bapplication\/(javascript|x-javascript|font-woff|font-woff2|octet-stream)\b/i;
const API_MIME_RE = /\b(application\/(json|graphql\+json|problem\+json|xml|x-www-form-urlencoded)|text\/(plain|xml|event-stream))\b/i;
const API_URL_RE = /\/(api|apis|graphql|gql|rpc|trpc|rest|v\d+)(\/|$|\?)/i;

void sendRulesToPage();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === RML_READY_EVENT) {
    void sendRulesToPage();
    return;
  }
  if (event.data?.type === RML_CAPTURE_EVENT) {
    void storeCapturedRequest(event.data.entry);
  }
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

async function storeCapturedRequest(entry) {
  if (!isCaptureEntry(entry)) return;
  try {
    const data = await chrome.storage.local.get([RML_STORAGE_KEY, RML_CAPTURE_STORAGE_KEY]);
    if (!data[RML_STORAGE_KEY]?.settings?.captureEnabled) return;
    const existing = Array.isArray(data[RML_CAPTURE_STORAGE_KEY]) ? data[RML_CAPTURE_STORAGE_KEY] : [];
    const normalized = {
      id: entry.id || crypto.randomUUID(),
      url: String(entry.url),
      method: String(entry.method || "GET").toUpperCase(),
      status: Number(entry.status || 0),
      mimeType: String(entry.mimeType || ""),
      capturedAt: Number(entry.capturedAt || Date.now()),
      body: typeof entry.body === "string" ? entry.body : "",
      headers: entry.headers && typeof entry.headers === "object" ? entry.headers : {}
    };
    const next = [normalized, ...existing.filter((item) => item.url !== normalized.url || item.method !== normalized.method)]
      .slice(0, RML_MAX_CAPTURED);
    await chrome.storage.local.set({ [RML_CAPTURE_STORAGE_KEY]: next });
  } catch (error) {
    if (!String(error?.message || error).includes("Extension context invalidated")) {
      console.error(error);
    }
  }
}

function isCaptureEntry(entry) {
  if (!entry) return false;
  const url = String(entry.url || "");
  const headers = entry.headers && typeof entry.headers === "object" ? entry.headers : {};
  const mimeType = String(entry.mimeType || headers["content-type"] || headers["Content-Type"] || "");
  if (!/^https?:\/\//i.test(url)) return false;
  if (STATIC_RESOURCE_EXT_RE.test(url)) return false;
  if (STATIC_MIME_RE.test(mimeType) || STATIC_TEXT_MIME_RE.test(mimeType)) return false;
  return API_MIME_RE.test(mimeType) || API_URL_RE.test(url) || !mimeType;
}
