const STORAGE_KEY = "requestMockLiteState";
const CAPTURE_STORAGE_KEY = "requestMockLiteCaptured";
const MAX_CAPTURED = 120;
const canCaptureRequests = Boolean(globalThis.chrome?.devtools?.network?.onRequestFinished);
const canToolbarCapture = Boolean(globalThis.chrome?.runtime?.onMessage && globalThis.chrome?.storage?.local);
const canCapture = canCaptureRequests || canToolbarCapture;
const STATIC_RESOURCE_EXT_RE = /\.(avif|bmp|css|gif|ico|jpe?g|js|mjs|map|mp3|mp4|png|svg|webp|woff2?|ttf|otf)([?#].*)?$/i;
const STATIC_MIME_RE = /^(image|audio|video|font)\//i;
const STATIC_TEXT_MIME_RE = /\btext\/(css|javascript)\b|\bapplication\/(javascript|x-javascript|font-woff|font-woff2|octet-stream)\b/i;
const API_MIME_RE = /\b(application\/(json|graphql\+json|problem\+json|xml|x-www-form-urlencoded)|text\/(plain|xml|event-stream))\b/i;
const API_URL_RE = /\/(api|apis|graphql|gql|rpc|trpc|rest|v\d+)(\/|$|\?)/i;

const els = {
  groupsList: document.querySelector("#groupsList"),
  rulesList: document.querySelector("#rulesList"),
  capturedList: document.querySelector("#capturedList"),
  activeGroupName: document.querySelector("#activeGroupName"),
  activeGroupMeta: document.querySelector("#activeGroupMeta"),
  addGroupBtn: document.querySelector("#addGroupBtn"),
  renameGroupBtn: document.querySelector("#renameGroupBtn"),
  deleteGroupBtn: document.querySelector("#deleteGroupBtn"),
  addRuleBtn: document.querySelector("#addRuleBtn"),
  clearCapturedBtn: document.querySelector("#clearCapturedBtn"),
  captureToggle: document.querySelector("#captureToggle"),
  captureCollapseBtn: document.querySelector("#captureCollapseBtn"),
  captureStateText: document.querySelector("#captureStateText"),
  captureSearch: document.querySelector("#captureSearch"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  topbarSubtitle: document.querySelector("#topbarSubtitle"),
  contextNotice: document.querySelector("#contextNotice"),
  dialog: document.querySelector("#ruleDialog"),
  ruleForm: document.querySelector("#ruleForm"),
  groupDialog: document.querySelector("#groupDialog"),
  groupForm: document.querySelector("#groupForm"),
  groupDialogTitle: document.querySelector("#groupDialogTitle"),
  groupDialogHint: document.querySelector("#groupDialogHint"),
  groupNameInput: document.querySelector("#groupNameInput"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogHint: document.querySelector("#dialogHint"),
  curlImportBlock: document.querySelector("#curlImportBlock"),
  curlInput: document.querySelector("#curlInput"),
  parseCurlBtn: document.querySelector("#parseCurlBtn"),
  curlParseStatus: document.querySelector("#curlParseStatus"),
  ruleName: document.querySelector("#ruleName"),
  responseTypeRadios: Array.from(document.querySelectorAll('input[name="responseType"]')),
  bodyModeHint: document.querySelector("#bodyModeHint"),
  ruleMethod: document.querySelector("#ruleMethod"),
  ruleMatchType: document.querySelector("#ruleMatchType"),
  ruleStatus: document.querySelector("#ruleStatus"),
  ruleDelayPreset: document.querySelector("#ruleDelayPreset"),
  ruleDelay: document.querySelector("#ruleDelay"),
  ruleUrlPattern: document.querySelector("#ruleUrlPattern"),
  ruleHeaders: document.querySelector("#ruleHeaders"),
  ruleBody: document.querySelector("#ruleBody"),
  ruleBodyEditor: document.querySelector("#ruleBodyEditor"),
  fullscreenDialog: document.querySelector("#fullscreenEditorDialog"),
  fullscreenBodyEditor: document.querySelector("#fullscreenBodyEditor"),
  playgroundDialog: document.querySelector("#templatePlaygroundDialog"),
  playgroundInput: document.querySelector("#playgroundInput"),
  playgroundOutput: document.querySelector("#playgroundOutput"),
  copyTokenFeedback: document.querySelector("#copyTokenFeedback"),
  ruleEnabled: document.querySelector("#ruleEnabled"),
  saveRuleBtn: document.querySelector("#saveRuleBtn")
};

let state = makeDefaultState();
let activeGroupId = state.groups[0].id;
let captured = [];
let editingRuleId = null;
let editingGroupId = null;
let bodyEditor = null;
let fullscreenEditor = null;
let fullscreenOriginalBody = "";
let lastResponseType = "json";
let responseDrafts = { json: null, function: null, merge: null };
let extensionContextInvalidated = false;

const STATIC_DEFAULT_BODY = "{}";
const MERGE_DEFAULT_BODY = "{}";
const FUNCTION_DEFAULT_BODY = `function (req) {
  return req.responseJSON;
}`;

function defaultBodyForType(type) {
  if (type === "function") return FUNCTION_DEFAULT_BODY;
  if (type === "merge") return MERGE_DEFAULT_BODY;
  return STATIC_DEFAULT_BODY;
}

init();

async function init() {
  state = await loadState();
  captured = await loadCaptured();
  activeGroupId = state.groups[0]?.id || createGroup("Default").id;
  applyRuntimeMode();
  bindEvents();
  if (canCaptureRequests) bindNetworkCapture();
  if (canToolbarCapture) bindCapturedStorage();
  render();
}

function applyRuntimeMode() {
  const mode = canCaptureRequests ? "devtools" : canToolbarCapture ? "toolbar" : "standalone";
  document.documentElement.dataset.runtime = mode;
  document.body.dataset.runtime = mode;
  applyCaptureCollapsedState();

  if (canCapture) {
    if (mode === "toolbar") {
      els.topbarSubtitle.textContent = "Manage rules and capture fetch/XHR from pages after capture is enabled.";
    }
    return;
  }

  els.topbarSubtitle.textContent = "Manage mock rules from the toolbar. Open DevTools only when you need live request capture.";
  els.contextNotice.hidden = true;
  els.captureToggle.checked = false;
  els.captureToggle.disabled = true;
  els.clearCapturedBtn.disabled = true;
  els.captureSearch.disabled = true;
  els.captureStateText.textContent = "Capture requires DevTools";
}

function makeDefaultState() {
  return {
    settings: {
      captureEnabled: false,
      capturePanelExpanded: false
    },
    groups: [
      {
        id: crypto.randomUUID(),
        name: "Default",
        enabled: true,
        createdAt: Date.now()
      }
    ],
    rules: []
  };
}

function createGroup(name) {
  const group = {
    id: crypto.randomUUID(),
    name,
    enabled: true,
    createdAt: Date.now()
  };
  state.groups.push(group);
  return group;
}

async function loadState() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const saved = data[STORAGE_KEY];
    if (!saved?.groups?.length) return makeDefaultState();
    return normalizeSavedState(saved);
  } catch (error) {
    handleExtensionContextError(error);
    return makeDefaultState();
  }
}

async function saveState() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    return true;
  } catch (error) {
    handleExtensionContextError(error);
    return false;
  }
}

async function loadCaptured() {
  try {
    const data = await chrome.storage.local.get(CAPTURE_STORAGE_KEY);
    return normalizeCaptured(data[CAPTURE_STORAGE_KEY]);
  } catch (error) {
    handleExtensionContextError(error);
    return [];
  }
}

async function saveCaptured() {
  try {
    await chrome.storage.local.set({ [CAPTURE_STORAGE_KEY]: captured.slice(0, MAX_CAPTURED) });
    return true;
  } catch (error) {
    handleExtensionContextError(error);
    return false;
  }
}

function bindCapturedStorage() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[CAPTURE_STORAGE_KEY]) return;
    captured = normalizeCaptured(changes[CAPTURE_STORAGE_KEY].newValue);
    renderCaptured();
  });
}

function normalizeCaptured(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && item.url && item.method)
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      url: String(item.url),
      method: String(item.method || "GET").toUpperCase(),
      status: Number(item.status || 0),
      mimeType: String(item.mimeType || ""),
      capturedAt: Number(item.capturedAt || Date.now()),
      body: typeof item.body === "string" ? item.body : "",
      headers: item.headers && typeof item.headers === "object" ? item.headers : {}
    }))
    .filter(isApiCaptureEntry)
    .slice(0, MAX_CAPTURED);
}

function applyCaptureCollapsedState() {
  const expanded = Boolean(state.settings.capturePanelExpanded);
  document.documentElement.dataset.captureCollapsed = String(!expanded);
  document.body.dataset.captureCollapsed = String(!expanded);
  els.captureCollapseBtn.textContent = expanded ? "›" : "‹";
  els.captureCollapseBtn.title = expanded ? "Collapse capture panel" : "Expand capture panel";
  els.captureCollapseBtn.setAttribute("aria-label", els.captureCollapseBtn.title);
}

function bindEvents() {
  els.addGroupBtn.addEventListener("click", () => openGroupDialog());

  els.addRuleBtn.addEventListener("click", () => openRuleDialog());
  els.renameGroupBtn.addEventListener("click", renameActiveGroup);
  els.deleteGroupBtn.addEventListener("click", deleteActiveGroup);
  document.querySelector("#closeGroupDialogBtn").addEventListener("click", () => els.groupDialog.close());
  document.querySelector("#cancelGroupBtn").addEventListener("click", () => els.groupDialog.close());
  document.querySelector("#closeDialogBtn").addEventListener("click", () => els.dialog.close());
  document.querySelector("#cancelRuleBtn").addEventListener("click", () => els.dialog.close());
  document.querySelector("#closeFullscreenBtn").addEventListener("click", closeFullscreenEditor);
  document.querySelector("#cancelFullscreenBtn").addEventListener("click", cancelFullscreenEditor);
  document.querySelector("#applyFullscreenBtn").addEventListener("click", applyFullscreenEditor);
  document.querySelector("#closePlaygroundBtn").addEventListener("click", closeTemplatePlayground);
  els.playgroundInput.addEventListener("input", renderTemplatePlayground);
  document.querySelector("#templateTokenGrid").addEventListener("click", copyTemplateToken);
  els.clearCapturedBtn.addEventListener("click", () => {
    captured = [];
    void saveCaptured();
    renderCaptured();
  });
  els.captureCollapseBtn.addEventListener("click", async () => {
    state.settings.capturePanelExpanded = !state.settings.capturePanelExpanded;
    applyCaptureCollapsedState();
    await saveState();
  });
  els.captureToggle.addEventListener("change", async (event) => {
    state.settings.captureEnabled = event.target.checked;
    await saveState();
    renderCaptured();
  });
  els.captureSearch.addEventListener("input", renderCaptured);
  els.exportBtn.addEventListener("click", exportRules);
  els.importInput.addEventListener("change", importRules);
  els.curlInput.addEventListener("input", () => applyCurlInput({ silent: true }));
  els.parseCurlBtn.addEventListener("click", () => applyCurlInput({ silent: false }));
  els.ruleDelayPreset.addEventListener("change", () => {
    if (els.ruleDelayPreset.value !== "custom") {
      els.ruleDelay.value = els.ruleDelayPreset.value;
    }
  });
  els.ruleDelay.addEventListener("input", () => {
    syncDelayPreset(Number(els.ruleDelay.value || 0));
  });
  els.responseTypeRadios.forEach((radio) => {
    radio.addEventListener("change", onResponseTypeChange);
  });
  document.querySelector("#templateHelpBtn").addEventListener("click", openTemplatePlayground);
  document.querySelector("#expandBodyBtn").addEventListener("click", openFullscreenEditor);
  document.querySelector("#formatHeadersBtn").addEventListener("click", () => formatJsonField(els.ruleHeaders, "Response headers"));
  document.querySelector("#formatBodyBtn").addEventListener("click", () => formatBodyEditor(bodyEditor, "Response body"));
  document.querySelector("#fullscreenHelpBtn").addEventListener("click", openTemplatePlayground);
  document.querySelector("#fullscreenFormatBtn").addEventListener("click", () => formatBodyEditor(fullscreenEditor, "Response body"));

  els.ruleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveRuleFromDialog();
  });

  els.groupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveGroupFromDialog();
  });
}

function ensureEditors() {
  if (bodyEditor || !window.RequestMockLiteEditor) return;
  bodyEditor = window.RequestMockLiteEditor.create({
    parent: els.ruleBodyEditor,
    doc: els.ruleBody.value,
    onChange: (value) => {
      els.ruleBody.value = value;
    }
  });
  fullscreenEditor = window.RequestMockLiteEditor.create({
    parent: els.fullscreenBodyEditor,
    doc: ""
  });
}

function bindNetworkCapture() {
  if (!canCaptureRequests) return;
  chrome.devtools.network.onRequestFinished.addListener((request) => {
    if (!state.settings.captureEnabled) return;
    if (!isFetchOrXhrRequest(request)) return;
    const method = request.request?.method || "GET";
    const url = request.request?.url || "";
    if (!url || !isMockableUrl(url)) return;

    const entry = {
      id: crypto.randomUUID(),
      url,
      method,
      status: request.response?.status || 0,
      mimeType: request.response?.content?.mimeType || "",
      capturedAt: Date.now(),
      body: "",
      headers: headersToObject(request.response?.headers || [])
    };

    request.getContent((content) => {
      entry.body = content || "";
      captured = [entry, ...captured.filter((item) => item.url !== url || item.method !== method)]
        .slice(0, MAX_CAPTURED);
      void saveCaptured();
      renderCaptured();
    });
  });
}

function isMockableUrl(url) {
  return /^https?:\/\//i.test(url);
}

function isFetchOrXhrRequest(request) {
  const url = request?.request?.url || "";
  const accept = getRequestHeader(request, "accept");
  const requestContentType = getRequestHeader(request, "content-type");
  const responseContentType = getResponseHeader(request, "content-type") || request?.response?.content?.mimeType || "";
  if (!isApiRequestCandidate(url, responseContentType || requestContentType || accept)) return false;

  const resourceType = String(request?._resourceType || request?.resourceType || request?.type || "").toLowerCase();
  if (resourceType) return ["fetch", "xhr", "xmlhttprequest"].includes(resourceType);

  return API_MIME_RE.test(`${accept} ${requestContentType} ${responseContentType}`) || API_URL_RE.test(url);
}

function isApiCaptureEntry(entry) {
  const headers = entry?.headers || {};
  const mimeType = String(entry?.mimeType || headers["content-type"] || headers["Content-Type"] || "");
  return isApiRequestCandidate(entry?.url || "", mimeType);
}

function isApiRequestCandidate(url, contentHint = "") {
  const normalizedUrl = String(url || "");
  const hint = String(contentHint || "");
  if (!isMockableUrl(normalizedUrl)) return false;
  if (STATIC_RESOURCE_EXT_RE.test(normalizedUrl)) return false;
  if (STATIC_MIME_RE.test(hint) || STATIC_TEXT_MIME_RE.test(hint)) return false;
  return API_MIME_RE.test(hint) || API_URL_RE.test(normalizedUrl) || !hint;
}

function getRequestHeader(request, name) {
  return getHeaderValue(request?.request?.headers, name);
}

function getResponseHeader(request, name) {
  return getHeaderValue(request?.response?.headers, name);
}

function getHeaderValue(headers, name) {
  const normalized = String(name).toLowerCase();
  const found = (headers || []).find((header) => String(header.name || "").toLowerCase() === normalized);
  return found?.value || "";
}

function headersToObject(headers) {
  return headers.reduce((acc, header) => {
    if (header.name && header.value) acc[header.name.toLowerCase()] = header.value;
    return acc;
  }, {});
}

function render() {
  renderGroups();
  renderRules();
  renderCaptured();
}

function renderGroups() {
  els.groupsList.replaceChildren();

  state.groups.forEach((group) => {
    const count = state.rules.filter((rule) => rule.groupId === group.id).length;
    const row = document.createElement("div");
    row.className = `group-row${group.id === activeGroupId ? " active" : ""}`;
    row.innerHTML = `
      <span>
        <span class="group-name">${escapeHtml(group.name)}</span>
        <span class="meta">${count} rules</span>
      </span>
      <label class="switch" title="Enable group">
        <input type="checkbox" ${group.enabled ? "checked" : ""}>
        <span></span>
      </label>
    `;

    row.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest(".switch")) return;
      activeGroupId = group.id;
      render();
    });

    row.querySelector(".switch").addEventListener("click", (event) => {
      event.stopPropagation();
    });

    row.querySelector("input").addEventListener("change", async (event) => {
      group.enabled = event.target.checked;
      await saveState();
      renderRules();
    });

    els.groupsList.append(row);
  });
}

function renderRules() {
  const group = state.groups.find((item) => item.id === activeGroupId) || state.groups[0];
  if (!group) return;
  const rules = state.rules.filter((rule) => rule.groupId === group.id);
  els.activeGroupName.textContent = group.name;
  els.activeGroupMeta.textContent = `${rules.length} rule${rules.length === 1 ? "" : "s"} in this group`;
  els.deleteGroupBtn.disabled = state.groups.length <= 1;
  els.rulesList.replaceChildren();

  if (!rules.length) {
    els.rulesList.append(empty(canCapture
      ? "No rules yet. Capture a request and turn it into a mock."
      : "No rules yet. Click Add and paste a cURL command, or import an existing rules JSON."));
    return;
  }

  rules.forEach((rule) => {
    const modeTag = rule.responseMode === "function" ? ` · <span class="mode-tag">fn</span>`
      : rule.responseMode === "merge" ? ` · <span class="mode-tag">merge</span>` : "";
    const card = document.createElement("article");
    card.className = "rule-card";
    card.innerHTML = `
      <div class="rule-head">
        <label class="switch" title="Enable rule">
          <input type="checkbox" ${rule.enabled ? "checked" : ""}>
          <span></span>
        </label>
        <div>
          <div class="rule-title">${escapeHtml(rule.name)}</div>
          <div class="meta"><span class="method">${rule.method}</span> · ${rule.matchType} · <span class="status ${rule.status >= 400 ? "error" : ""}">${rule.status}</span>${modeTag}${rule.delayMs ? ` · ${formatDelay(rule.delayMs)} delay` : ""}</div>
        </div>
        <span class="badge">${rule.enabled && group.enabled ? "active" : "off"}</span>
      </div>
      <div class="rule-pattern">${escapeHtml(rule.urlPattern)}</div>
      <div class="rule-actions">
        <button class="small-btn edit">Edit</button>
        <button class="small-btn ghost duplicate">Duplicate</button>
        <button class="small-btn ghost delete">Delete</button>
      </div>
    `;

    card.querySelector("input").addEventListener("change", async (event) => {
      rule.enabled = event.target.checked;
      await saveState();
      renderRules();
    });
    card.querySelector(".edit").addEventListener("click", () => openRuleDialog(rule));
    card.querySelector(".duplicate").addEventListener("click", async () => {
      state.rules.unshift({
        ...rule,
        id: crypto.randomUUID(),
        name: `${rule.name} copy`,
        createdAt: Date.now()
      });
      await saveState();
      renderRules();
    });
    card.querySelector(".delete").addEventListener("click", async () => {
      if (!confirm(`Delete "${rule.name}"?`)) return;
      state.rules = state.rules.filter((item) => item.id !== rule.id);
      await saveState();
      renderRules();
    });

    els.rulesList.append(card);
  });
}

async function renameActiveGroup() {
  const group = state.groups.find((item) => item.id === activeGroupId);
  if (!group) return;
  openGroupDialog(group);
}

function openGroupDialog(group = null) {
  editingGroupId = group?.id || null;
  els.groupDialogTitle.textContent = group ? "Rename group" : "New group";
  els.groupDialogHint.textContent = group
    ? "Update the label for this mock state group."
    : "Create a group for related mock states.";
  els.groupNameInput.value = group?.name || "";
  document.querySelector("#saveGroupBtn").textContent = group ? "Save name" : "Save group";
  els.groupDialog.showModal();
  els.groupNameInput.focus();
  els.groupNameInput.select();
}

async function saveGroupFromDialog() {
  const name = els.groupNameInput.value.trim();
  if (!name) return;
  if (editingGroupId) {
    const group = state.groups.find((item) => item.id === editingGroupId);
    if (group) group.name = name;
  } else {
    const group = createGroup(name);
    activeGroupId = group.id;
  }
  editingGroupId = null;
  els.groupDialog.close();
  await saveState();
  render();
}

async function deleteActiveGroup() {
  if (state.groups.length <= 1) return;
  const group = state.groups.find((item) => item.id === activeGroupId);
  if (!group) return;
  const ruleCount = state.rules.filter((rule) => rule.groupId === group.id).length;
  if (!confirm(`Delete "${group.name}" and ${ruleCount} rule${ruleCount === 1 ? "" : "s"}?`)) return;
  state.groups = state.groups.filter((item) => item.id !== group.id);
  state.rules = state.rules.filter((rule) => rule.groupId !== group.id);
  activeGroupId = state.groups[0].id;
  await saveState();
  render();
}

function renderCaptured() {
  if (!canCapture) {
    els.captureToggle.checked = false;
    els.captureStateText.textContent = "Capture requires DevTools";
    els.capturedList.replaceChildren(empty("Open DevTools and select Mock Lite when you need to capture live requests."));
    return;
  }

  const captureEnabled = state.settings.captureEnabled;
  els.captureToggle.checked = captureEnabled;
  els.captureStateText.textContent = captureEnabled
    ? "Listening for fetch/XHR"
    : "Capture paused";

  const query = els.captureSearch.value.trim().toLowerCase();
  const items = captured.filter((item) => {
    const haystack = `${item.method} ${item.status} ${item.url}`.toLowerCase();
    return haystack.includes(query);
  });

  els.capturedList.replaceChildren();
  if (!items.length) {
    els.capturedList.append(empty(captureEnabled
      ? "Open or refresh pages after capture is on. Captured fetch/XHR requests will appear here."
      : "Capture is paused. Turn it on when you want to collect new requests."));
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "capture-card";
    card.innerHTML = `
      <div class="capture-head">
        <span class="method">${item.method}</span>
        <div class="capture-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</div>
        <span class="status ${item.status >= 400 ? "error" : ""}">${item.status || "?"}</span>
      </div>
      <div class="meta">${item.mimeType || "unknown"} · ${formatBytes(item.body.length)}</div>
      <div class="capture-actions">
        <button class="small-btn primary">Mock this</button>
        <button class="small-btn ghost">Copy URL</button>
      </div>
    `;
    card.querySelector(".primary").addEventListener("click", () => openRuleDialog(null, item));
    card.querySelector(".ghost").addEventListener("click", () => navigator.clipboard.writeText(item.url));
    els.capturedList.append(card);
  });
}

function openRuleDialog(rule = null, capturedRequest = null) {
  editingRuleId = rule?.id || null;
  const body = capturedRequest?.body || rule?.body || STATIC_DEFAULT_BODY;
  const headers = rule?.headers || deriveHeaders(capturedRequest);

  const isCurlImport = !rule && !capturedRequest;
  els.dialogTitle.textContent = rule ? "Edit mock rule" : "Create mock rule";
  els.dialogHint.textContent = isCurlImport
    ? "Paste a cURL command copied from DevTools. URL and method are parsed automatically."
    : "Exact URL matching is safest for captured APIs.";
  els.curlImportBlock.hidden = !isCurlImport;
  els.curlInput.value = "";
  setCurlParseStatus(isCurlImport ? "Paste cURL here, then review the generated rule." : "", "");
  els.ruleName.value = rule?.name || capturedRequest?.url?.split("?")[0].split("/").slice(-1)[0] || "New mock";
  els.ruleMethod.value = rule?.method || capturedRequest?.method || "GET";
  els.ruleMatchType.value = rule?.matchType || (capturedRequest ? "path" : "exact");
  els.ruleStatus.value = rule?.status || capturedRequest?.status || 200;
  setDelayValue(rule?.delayMs || 0);
  els.ruleUrlPattern.value = rule?.urlPattern || patternFromCapturedUrl(capturedRequest?.url) || "";
  const isFunction = rule?.responseMode === "function";
  const isMerge = rule?.responseMode === "merge";
  const initialType = isFunction ? "function" : isMerge ? "merge" : "json";
  let initialBody;
  if (isFunction) initialBody = rule?.body || FUNCTION_DEFAULT_BODY;
  else if (isMerge) initialBody = rule?.body ? prettyBody(rule.body) : MERGE_DEFAULT_BODY;
  else initialBody = prettyBody(body);
  setResponseType(initialType);
  lastResponseType = initialType;
  const savedBodies = rule?.responseBodies || {};
  responseDrafts = {
    json: savedBodies.json != null ? savedBodies.json : null,
    merge: savedBodies.merge != null ? savedBodies.merge : null,
    function: savedBodies.function != null ? savedBodies.function : null
  };
  responseDrafts[initialType] = initialBody;
  els.ruleHeaders.value = JSON.stringify(headers, null, 2);
  setBodyValue(initialBody);
  els.ruleEnabled.checked = rule?.enabled ?? true;
  els.dialog.showModal();
  ensureEditors();
  updateResponseTypeUi();
  if (isCurlImport) els.curlInput.focus();
  else bodyEditor.focus();
}

function onResponseTypeChange() {
  const next = getResponseType();
  if (next === lastResponseType) return;
  responseDrafts[lastResponseType] = getBodyValue();
  const draft = responseDrafts[next];
  setBodyValue(draft != null ? draft : defaultBodyForType(next));
  lastResponseType = next;
  updateResponseTypeUi();
}

function getResponseType() {
  const checked = els.responseTypeRadios.find((radio) => radio.checked);
  return checked ? checked.value : "json";
}

function setResponseType(value) {
  els.responseTypeRadios.forEach((radio) => {
    radio.checked = radio.value === value;
  });
}

const RESPONSE_TYPE_HINTS = {
  merge: "Only write the fields you want to override — deep-merged into the real response (arrays are replaced).",
  function: "function(req) { … } — req has url, method, path, query, headers, body and the real response, responseJSON, status."
};

function updateResponseTypeUi() {
  const type = getResponseType();
  const hint = RESPONSE_TYPE_HINTS[type] || "";
  els.bodyModeHint.textContent = hint;
  els.bodyModeHint.hidden = !hint;
  bodyEditor?.setLanguage?.(type === "function" ? "javascript" : "json");
  fullscreenEditor?.setLanguage?.(type === "function" ? "javascript" : "json");
}

function deriveHeaders(capturedRequest) {
  const headers = capturedRequest?.headers || {};
  const contentType = headers["content-type"] || capturedRequest?.mimeType || "application/json";
  return { "content-type": contentType };
}

function patternFromCapturedUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function applyCurlInput({ silent = false } = {}) {
  const source = els.curlInput.value.trim();
  if (!source) {
    setCurlParseStatus("Paste cURL here, then review the generated rule.", "");
    return false;
  }

  const parsed = parseCurlCommand(source);
  if (!parsed.url || !isMockableUrl(parsed.url)) {
    setCurlParseStatus(
      silent ? "Waiting for a cURL command with an http(s) URL." : "Could not find an http(s) URL in the cURL command.",
      silent ? "" : "error"
    );
    return false;
  }

  applyParsedCurl(parsed);
  const bodyNote = parsed.requestBody ? " with request body" : "";
  setCurlParseStatus(`Parsed ${parsed.method} ${parsed.url}${bodyNote}.`, "ok");
  return true;
}

function applyParsedCurl(parsed) {
  const supportedMethod = Array.from(els.ruleMethod.options).some((option) => option.value === parsed.method)
    ? parsed.method
    : "ANY";
  els.ruleMethod.value = supportedMethod;
  els.ruleMatchType.value = "exact";
  els.ruleUrlPattern.value = parsed.url;
  if (!els.ruleName.value.trim() || els.ruleName.value === "New mock") {
    els.ruleName.value = nameFromUrl(parsed.url);
  }
  els.ruleHeaders.value = JSON.stringify(inferResponseHeadersFromCurl(parsed.requestHeaders), null, 2);
}

function setCurlParseStatus(message, stateName) {
  els.curlParseStatus.textContent = message;
  if (stateName) {
    els.curlParseStatus.dataset.state = stateName;
  } else {
    delete els.curlParseStatus.dataset.state;
  }
}

function parseCurlCommand(source) {
  const tokens = tokenizeCurlCommand(source);
  const requestHeaders = {};
  const dataParts = [];
  let method = "";
  let methodExplicit = false;
  let url = "";
  let appendDataToUrl = false;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token || /^curl(?:\.exe)?$/i.test(token)) continue;

    if (token === "--url") {
      url = tokens[index + 1] || url;
      index += 1;
      continue;
    }
    if (token.startsWith("--url=")) {
      url = token.slice("--url=".length);
      continue;
    }

    if (token === "-X" || token === "--request") {
      method = String(tokens[index + 1] || method).toUpperCase();
      methodExplicit = true;
      index += 1;
      continue;
    }
    if (token.startsWith("--request=")) {
      method = token.slice("--request=".length).toUpperCase();
      methodExplicit = true;
      continue;
    }
    if (token.startsWith("-X") && token.length > 2) {
      method = token.slice(2).toUpperCase();
      methodExplicit = true;
      continue;
    }

    if (token === "-H" || token === "--header") {
      addCurlHeader(tokens[index + 1] || "", requestHeaders);
      index += 1;
      continue;
    }
    if (token.startsWith("--header=")) {
      addCurlHeader(token.slice("--header=".length), requestHeaders);
      continue;
    }
    if (token.startsWith("-H") && token.length > 2) {
      addCurlHeader(token.slice(2), requestHeaders);
      continue;
    }

    if (token === "-A" || token === "--user-agent") {
      addCurlHeader(`user-agent: ${tokens[index + 1] || ""}`, requestHeaders);
      index += 1;
      continue;
    }
    if (token.startsWith("--user-agent=")) {
      addCurlHeader(`user-agent: ${token.slice("--user-agent=".length)}`, requestHeaders);
      continue;
    }

    if (token === "-e" || token === "--referer") {
      addCurlHeader(`referer: ${tokens[index + 1] || ""}`, requestHeaders);
      index += 1;
      continue;
    }
    if (token.startsWith("--referer=")) {
      addCurlHeader(`referer: ${token.slice("--referer=".length)}`, requestHeaders);
      continue;
    }

    if (token === "-b" || token === "--cookie") {
      addCurlHeader(`cookie: ${tokens[index + 1] || ""}`, requestHeaders);
      index += 1;
      continue;
    }
    if (token.startsWith("--cookie=")) {
      addCurlHeader(`cookie: ${token.slice("--cookie=".length)}`, requestHeaders);
      continue;
    }
    if (token.startsWith("-b") && token.length > 2) {
      addCurlHeader(`cookie: ${token.slice(2)}`, requestHeaders);
      continue;
    }

    if (isCurlDataFlag(token)) {
      const value = tokens[index + 1] || "";
      dataParts.push(value);
      if (token === "--json") addJsonCurlHeaders(requestHeaders);
      if (!method && !appendDataToUrl) method = "POST";
      index += 1;
      continue;
    }

    const dataValue = curlDataFlagValue(token);
    if (dataValue) {
      dataParts.push(dataValue.value);
      if (dataValue.json) addJsonCurlHeaders(requestHeaders);
      if (!method && !appendDataToUrl) method = "POST";
      continue;
    }

    if (token === "-G" || token === "--get") {
      appendDataToUrl = true;
      if (!methodExplicit) method = "GET";
      continue;
    }

    if (token === "-I" || token === "--head") {
      method = "HEAD";
      methodExplicit = true;
      continue;
    }

    if (curlFlagNeedsValue(token)) {
      index += 1;
      continue;
    }

    if (isUrlToken(token)) {
      url = token;
    }
  }

  const requestBody = appendDataToUrl ? "" : dataParts.join("&");
  if (appendDataToUrl && dataParts.length && url) {
    url = appendCurlDataToUrl(url, dataParts.join("&"));
  }

  return {
    url,
    method: (method || (requestBody ? "POST" : "GET")).toUpperCase(),
    requestHeaders,
    requestBody
  };
}

function tokenizeCurlCommand(source) {
  const input = source.replace(/\^\r?\n/g, " ");
  const tokens = [];
  let token = "";
  let quote = "";

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote === "'") {
      if (char === "'") quote = "";
      else token += char;
      continue;
    }

    if (quote === "\"") {
      if (char === "\"") {
        quote = "";
      } else if (char === "\\") {
        const next = input[index + 1];
        if (next === "\r" && input[index + 2] === "\n") {
          index += 2;
        } else if (next === "\n") {
          index += 1;
        } else if (next != null) {
          token += next;
          index += 1;
        }
      } else {
        token += char;
      }
      continue;
    }

    if (/\s/.test(char)) {
      if (token) {
        tokens.push(token);
        token = "";
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (char === "\\") {
      const next = input[index + 1];
      if (next === "\r" && input[index + 2] === "\n") {
        index += 2;
      } else if (next === "\n") {
        index += 1;
      } else if (next != null) {
        token += next;
        index += 1;
      }
      continue;
    }

    token += char;
  }

  if (token) tokens.push(token);
  return tokens;
}

function addCurlHeader(headerLine, headers) {
  const separator = headerLine.indexOf(":");
  if (separator <= 0) return;
  const name = headerLine.slice(0, separator).trim().toLowerCase();
  const value = headerLine.slice(separator + 1).trim();
  if (name) headers[name] = value;
}

function addJsonCurlHeaders(headers) {
  if (!headers.accept) headers.accept = "application/json";
  if (!headers["content-type"]) headers["content-type"] = "application/json";
}

function isCurlDataFlag(token) {
  return [
    "-d",
    "--data",
    "--data-raw",
    "--data-binary",
    "--data-ascii",
    "--data-urlencode",
    "--json"
  ].includes(token);
}

function curlDataFlagValue(token) {
  const prefixes = [
    "--data=",
    "--data-raw=",
    "--data-binary=",
    "--data-ascii=",
    "--data-urlencode="
  ];
  for (const prefix of prefixes) {
    if (token.startsWith(prefix)) return { value: token.slice(prefix.length), json: false };
  }
  if (token.startsWith("--json=")) return { value: token.slice("--json=".length), json: true };
  if (token.startsWith("-d") && token.length > 2) return { value: token.slice(2), json: false };
  return null;
}

function curlFlagNeedsValue(token) {
  return [
    "-F",
    "--form",
    "-u",
    "--user",
    "-o",
    "--output",
    "-x",
    "--proxy",
    "--cacert",
    "--cert",
    "--connect-timeout",
    "--key",
    "--max-time",
    "--resolve"
  ].includes(token);
}

function isUrlToken(token) {
  return /^https?:\/\//i.test(token);
}

function appendCurlDataToUrl(url, data) {
  const separator = url.includes("?")
    ? (url.endsWith("?") || url.endsWith("&") ? "" : "&")
    : "?";
  return `${url}${separator}${data}`;
}

function inferResponseHeadersFromCurl(requestHeaders) {
  return {
    "content-type": pickAcceptedContentType(requestHeaders.accept) || "application/json"
  };
}

function pickAcceptedContentType(accept) {
  if (!accept) return "";
  const accepted = accept
    .split(",")
    .map((item) => item.split(";")[0].trim())
    .find((item) => item && item !== "*/*" && !item.endsWith("/*"));
  return accepted || "";
}

function nameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").filter(Boolean).pop();
    return segment || parsed.hostname || "New mock";
  } catch {
    return "New mock";
  }
}

async function saveRuleFromDialog() {
  if (!editingRuleId && !els.curlImportBlock.hidden && els.curlInput.value.trim() && !els.ruleUrlPattern.value.trim()) {
    if (!applyCurlInput({ silent: false })) return;
  }

  let headers;
  try {
    headers = els.ruleHeaders.value.trim() ? JSON.parse(els.ruleHeaders.value) : {};
  } catch {
    alert("Response headers must be valid JSON.");
    return;
  }

  const responseType = getResponseType();
  const body = getBodyValue();
  let responseMode;
  if (responseType === "function") {
    responseMode = "function";
    if (!body.trim()) {
      alert("Response function cannot be empty.");
      return;
    }
  } else if (responseType === "merge") {
    responseMode = "merge";
    if (body.trim() && !hasTemplateTokens(body) &&
      !validateJsonText(body, "Merge patch", { allowEmpty: true })) return;
  } else {
    responseMode = hasTemplateTokens(body) ? "template" : "static";
    if (!hasTemplateTokens(body) && shouldValidateBodyJson(body, headers) &&
      !validateJsonText(body, "Response body", { allowEmpty: true })) return;
  }

  const delayMs = Number(els.ruleDelay.value || 0);
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    alert("Delay must be a non-negative number.");
    return;
  }

  responseDrafts[responseType] = body;
  const responseBodies = {};
  ["json", "merge", "function"].forEach((type) => {
    const value = responseDrafts[type];
    if (value != null && value !== "") responseBodies[type] = value;
  });

  const payload = {
    id: editingRuleId || crypto.randomUUID(),
    groupId: activeGroupId,
    name: els.ruleName.value.trim(),
    method: els.ruleMethod.value,
    matchType: els.ruleMatchType.value,
    urlPattern: els.ruleUrlPattern.value.trim(),
    status: Number(els.ruleStatus.value),
    delayMs,
    headers,
    responseMode,
    body,
    responseBodies,
    enabled: els.ruleEnabled.checked,
    createdAt: Date.now()
  };

  if (!payload.name || !payload.urlPattern || !payload.status) return;

  const index = state.rules.findIndex((rule) => rule.id === payload.id);
  if (index >= 0) {
    state.rules[index] = { ...state.rules[index], ...payload };
  } else {
    state.rules.unshift(payload);
  }

  await saveState();
  els.dialog.close();
  renderRules();
}

function prettyBody(body) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function setDelayValue(delayMs) {
  els.ruleDelay.value = String(delayMs || 0);
  syncDelayPreset(delayMs || 0);
}

function syncDelayPreset(delayMs) {
  const value = String(delayMs || 0);
  const option = Array.from(els.ruleDelayPreset.options).find((item) => item.value === value);
  els.ruleDelayPreset.value = option ? value : "custom";
}

function getBodyValue(editor = bodyEditor) {
  return editor?.getValue() ?? els.ruleBody.value;
}

function setBodyValue(value, editor = bodyEditor) {
  els.ruleBody.value = value || "";
  if (editor) editor.setValue(value || "");
}

function hasTemplateTokens(value) {
  return /\{\{\s*[^{}]+?\s*\}\}/.test(value || "");
}

function formatBodyEditor(editor, label) {
  if (getResponseType() === "function") {
    editor?.format?.();
    return;
  }
  const value = getBodyValue(editor).trim();
  if (!value) return;
  try {
    const formatted = JSON.stringify(JSON.parse(value), null, 2);
    setBodyValue(formatted, editor);
  } catch (error) {
    alert(`${label} is not valid JSON.\n\n${error.message}`);
  }
}

function openFullscreenEditor() {
  ensureEditors();
  fullscreenOriginalBody = getBodyValue();
  fullscreenEditor.setValue(fullscreenOriginalBody);
  els.fullscreenDialog.showModal();
  fullscreenEditor.view?.requestMeasure?.();
  fullscreenEditor.focus();
}

function closeFullscreenEditor() {
  els.fullscreenDialog.close();
}

function cancelFullscreenEditor() {
  fullscreenEditor.setValue(fullscreenOriginalBody);
  els.fullscreenDialog.close();
}

function applyFullscreenEditor() {
  setBodyValue(fullscreenEditor.getValue());
  els.fullscreenDialog.close();
  bodyEditor.focus();
}

function openTemplatePlayground() {
  els.playgroundInput.value = sampleTemplateBody();
  renderTemplatePlayground();
  els.playgroundDialog.showModal();
  els.playgroundInput.focus();
}

function closeTemplatePlayground() {
  els.playgroundDialog.close();
}

function renderTemplatePlayground() {
  const body = els.playgroundInput.value;
  const preview = hasTemplateTokens(body)
    ? resolveTemplateBody(body, sampleRequest())
    : body;
  els.playgroundOutput.value = prettyBody(preview);
}

function resolveTemplateBody(body, request) {
  return body.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, token) => {
    const value = resolveTemplateToken(token, request);
    return value == null ? _match : String(value);
  });
}

function resolveTemplateToken(token, request) {
  const normalized = String(token || "").trim();
  if (normalized === "uuid") return crypto.randomUUID();
  if (normalized === "timestamp") return Date.now();
  if (normalized === "isoDate") return new Date().toISOString();
  if (normalized === "boolean") return Math.random() >= 0.5;
  if (normalized === "name") return randomFrom(["Alex Chen", "Maya Patel", "Sam Rivera", "Nora Lee"]);
  if (normalized === "email") return `mock.${randomInt(100, 999)}@example.com`;
  if (normalized.startsWith("randomInt(") && normalized.endsWith(")")) {
    const [min, max] = normalized.slice(10, -1).split(",").map((item) => Number(item.trim()));
    return randomInt(Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : 100);
  }
  if (normalized.startsWith("randomFloat(") && normalized.endsWith(")")) {
    const [min, max, decimals] = normalized.slice(12, -1).split(",").map((item) => Number(item.trim()));
    return randomFloat(
      Number.isFinite(min) ? min : 0,
      Number.isFinite(max) ? max : 1,
      Number.isFinite(decimals) ? decimals : 2
    );
  }
  if (normalized === "request.url") return request.url;
  if (normalized === "request.method") return request.method;
  if (normalized === "request.path") return new URL(request.url).pathname;
  if (normalized.startsWith("request.query.")) {
    return new URL(request.url).searchParams.get(normalized.slice("request.query.".length)) || "";
  }
  return undefined;
}

function sampleRequest() {
  return {
    method: els.ruleMethod.value === "ANY" ? "GET" : els.ruleMethod.value,
    url: "https://example.com/api/users?page=1&id=42"
  };
}

function sampleTemplateBody() {
  return `{
  "uuid": "{{uuid}}",
  "timestamp": {{timestamp}},
  "isoDate": "{{isoDate}}",
  "randomInt": {{randomInt(1,100)}},
  "randomFloat": {{randomFloat(0,1,2)}},
  "boolean": {{boolean}},
  "profile": {
    "name": "{{name}}",
    "email": "{{email}}"
  },
  "request": {
    "url": "{{request.url}}",
    "method": "{{request.method}}",
    "path": "{{request.path}}",
    "page": "{{request.query.page}}"
  }
}`;
}

function randomInt(min, max) {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function randomFloat(min, max, decimals) {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const precision = Math.max(0, Math.min(8, Math.trunc(decimals)));
  return Number((Math.random() * (high - low) + low).toFixed(precision));
}

function randomFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function copyTemplateToken(event) {
  const tokenEl = event.target.closest("[data-token]");
  if (!tokenEl) return;
  const token = tokenEl.dataset.token;
  try {
    await navigator.clipboard.writeText(token);
    tokenEl.dataset.copied = "true";
    els.copyTokenFeedback.textContent = `Copied ${token}`;
    window.setTimeout(() => {
      delete tokenEl.dataset.copied;
      if (els.copyTokenFeedback.textContent === `Copied ${token}`) {
        els.copyTokenFeedback.textContent = "";
      }
    }, 900);
  } catch (error) {
    els.copyTokenFeedback.textContent = "Copy failed";
    console.warn("[Request Mock Lite] failed to copy template token", error);
  }
}

function formatJsonField(field, label) {
  const value = field.value.trim();
  if (!value) return;
  try {
    field.value = JSON.stringify(JSON.parse(value), null, 2);
  } catch (error) {
    alert(`${label} is not valid JSON.\n\n${error.message}`);
  }
}

function validateJsonText(value, label, options = {}) {
  const text = value.trim();
  if (!text && options.allowEmpty) return true;
  try {
    JSON.parse(text);
    return true;
  } catch (error) {
    alert(`${label} must be valid JSON.\n\n${error.message}`);
    return false;
  }
}

function shouldValidateBodyJson(body, headers) {
  const contentType = String(headers["content-type"] || headers["Content-Type"] || "").toLowerCase();
  const text = body.trim();
  return contentType.includes("json") || text.startsWith("{") || text.startsWith("[");
}

function exportRules() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "request-mock-lite-rules.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importRules(event) {
  const [file] = event.target.files;
  if (!file) return;
  const text = await file.text();
  try {
    const imported = JSON.parse(text);
    if (!Array.isArray(imported.groups) || !Array.isArray(imported.rules)) throw new Error();
    state = normalizeSavedState(imported);
    activeGroupId = state.groups[0]?.id;
    await saveState();
    render();
  } catch {
    alert("Import failed. Choose a Request Mock Lite JSON export.");
  } finally {
    event.target.value = "";
  }
}

function normalizeSavedState(saved) {
  return {
    settings: {
      captureEnabled: saved.settings?.captureEnabled ?? false,
      capturePanelExpanded: saved.settings?.capturePanelExpanded ?? false
    },
    groups: saved.groups,
    rules: saved.rules || []
  };
}

function handleExtensionContextError(error) {
  const message = String(error?.message || error || "");
  if (!message.includes("Extension context invalidated")) {
    console.error(error);
    return;
  }
  extensionContextInvalidated = true;
  els.contextNotice.hidden = false;
  els.contextNotice.textContent = "Extension reloaded. Reopen Request Mock Lite.";
}

function empty(message) {
  const node = document.createElement("div");
  node.className = "empty";
  node.textContent = message;
  return node;
}

function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDelay(delayMs) {
  if (delayMs < 1000) return `${delayMs}ms`;
  return `${delayMs / 1000}s`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}
