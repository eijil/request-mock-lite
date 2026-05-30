const STORAGE_KEY = "requestMockLiteState";
const MAX_CAPTURED = 120;

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
  captureStateText: document.querySelector("#captureStateText"),
  captureSearch: document.querySelector("#captureSearch"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  contextNotice: document.querySelector("#contextNotice"),
  dialog: document.querySelector("#ruleDialog"),
  ruleForm: document.querySelector("#ruleForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  ruleName: document.querySelector("#ruleName"),
  ruleMethod: document.querySelector("#ruleMethod"),
  ruleMatchType: document.querySelector("#ruleMatchType"),
  ruleStatus: document.querySelector("#ruleStatus"),
  ruleDelay: document.querySelector("#ruleDelay"),
  ruleUrlPattern: document.querySelector("#ruleUrlPattern"),
  ruleHeaders: document.querySelector("#ruleHeaders"),
  ruleBody: document.querySelector("#ruleBody"),
  ruleEnabled: document.querySelector("#ruleEnabled"),
  saveRuleBtn: document.querySelector("#saveRuleBtn")
};

let state = makeDefaultState();
let activeGroupId = state.groups[0].id;
let captured = [];
let editingRuleId = null;

init();

async function init() {
  state = await loadState();
  activeGroupId = state.groups[0]?.id || createGroup("Default").id;
  bindEvents();
  bindNetworkCapture();
  render();
}

function makeDefaultState() {
  return {
    settings: {
      captureEnabled: true
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

function bindEvents() {
  els.addGroupBtn.addEventListener("click", async () => {
    const name = prompt("Group name", "New group");
    if (!name?.trim()) return;
    const group = createGroup(name.trim());
    activeGroupId = group.id;
    await saveState();
    render();
  });

  els.addRuleBtn.addEventListener("click", () => openRuleDialog());
  els.renameGroupBtn.addEventListener("click", renameActiveGroup);
  els.deleteGroupBtn.addEventListener("click", deleteActiveGroup);
  document.querySelector("#closeDialogBtn").addEventListener("click", () => els.dialog.close());
  document.querySelector("#cancelRuleBtn").addEventListener("click", () => els.dialog.close());
  els.clearCapturedBtn.addEventListener("click", () => {
    captured = [];
    renderCaptured();
  });
  els.captureToggle.addEventListener("change", async (event) => {
    state.settings.captureEnabled = event.target.checked;
    await saveState();
    renderCaptured();
  });
  els.captureSearch.addEventListener("input", renderCaptured);
  els.exportBtn.addEventListener("click", exportRules);
  els.importInput.addEventListener("change", importRules);
  document.querySelectorAll("[data-delay]").forEach((button) => {
    button.addEventListener("click", () => {
      els.ruleDelay.value = button.dataset.delay;
    });
  });
  document.querySelector("#formatHeadersBtn").addEventListener("click", () => formatJsonField(els.ruleHeaders, "Response headers"));
  document.querySelector("#validateHeadersBtn").addEventListener("click", () => validateJsonField(els.ruleHeaders, "Response headers"));
  document.querySelector("#formatBodyBtn").addEventListener("click", () => formatJsonField(els.ruleBody, "Response body"));
  document.querySelector("#validateBodyBtn").addEventListener("click", () => validateJsonField(els.ruleBody, "Response body"));

  els.ruleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveRuleFromDialog();
  });
}

function bindNetworkCapture() {
  chrome.devtools.network.onRequestFinished.addListener((request) => {
    if (!state.settings.captureEnabled) return;
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
      renderCaptured();
    });
  });
}

function isMockableUrl(url) {
  return /^https?:\/\//i.test(url);
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
    els.rulesList.append(empty("No rules yet. Capture a request and turn it into a mock."));
    return;
  }

  rules.forEach((rule) => {
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
          <div class="meta"><span class="method">${rule.method}</span> · ${rule.matchType} · <span class="status ${rule.status >= 400 ? "error" : ""}">${rule.status}</span>${rule.delayMs ? ` · ${formatDelay(rule.delayMs)} delay` : ""}</div>
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
  const name = prompt("Group name", group.name);
  if (!name?.trim()) return;
  group.name = name.trim();
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
      ? "Open or refresh the inspected page. Captured fetch/XHR requests will appear here."
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
  const body = capturedRequest?.body || rule?.body || "{\n  \"ok\": true\n}";
  const headers = rule?.headers || deriveHeaders(capturedRequest);

  els.dialogTitle.textContent = rule ? "Edit mock rule" : "Create mock rule";
  els.ruleName.value = rule?.name || capturedRequest?.url?.split("?")[0].split("/").slice(-1)[0] || "New mock";
  els.ruleMethod.value = rule?.method || capturedRequest?.method || "GET";
  els.ruleMatchType.value = rule?.matchType || (capturedRequest ? "path" : "exact");
  els.ruleStatus.value = rule?.status || capturedRequest?.status || 200;
  els.ruleDelay.value = rule?.delayMs || 0;
  els.ruleUrlPattern.value = rule?.urlPattern || patternFromCapturedUrl(capturedRequest?.url) || "";
  els.ruleHeaders.value = JSON.stringify(headers, null, 2);
  els.ruleBody.value = prettyBody(body);
  els.ruleEnabled.checked = rule?.enabled ?? true;
  els.dialog.showModal();
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

async function saveRuleFromDialog() {
  let headers;
  try {
    headers = els.ruleHeaders.value.trim() ? JSON.parse(els.ruleHeaders.value) : {};
  } catch {
    alert("Response headers must be valid JSON.");
    return;
  }

  if (shouldValidateBodyJson(els.ruleBody.value, headers) &&
    !validateJsonText(els.ruleBody.value, "Response body", { allowEmpty: true })) return;

  const delayMs = Number(els.ruleDelay.value || 0);
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    alert("Delay must be a non-negative number.");
    return;
  }

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
    body: els.ruleBody.value,
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

function formatJsonField(field, label) {
  const value = field.value.trim();
  if (!value) return;
  try {
    field.value = JSON.stringify(JSON.parse(value), null, 2);
  } catch (error) {
    alert(`${label} is not valid JSON.\n\n${error.message}`);
  }
}

function validateJsonField(field, label) {
  if (validateJsonText(field.value, label, { allowEmpty: true })) {
    alert(`${label} is valid JSON.`);
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
      captureEnabled: saved.settings?.captureEnabled ?? true
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
  els.contextNotice.hidden = false;
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
