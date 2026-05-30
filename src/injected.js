(() => {
  if (window.__requestMockLite?.installed) return;

  const RULES_EVENT = "REQUEST_MOCK_LITE_RULES";
  const READY_EVENT = "REQUEST_MOCK_LITE_READY";
  const RULES_READY_TIMEOUT_MS = 1200;
  const nativeFetch = window.fetch;
  const NativeRequest = window.Request;
  const NativeResponse = window.Response;
  const NativeHeaders = window.Headers;
  const NativeXMLHttpRequest = window.XMLHttpRequest;

  let mockState = { groups: [], rules: [] };
  let hasReceivedRules = false;
  let indicator = null;
  let indicatorHitTimer = 0;
  let resolveRulesReady;
  const rulesReady = new Promise((resolve) => {
    resolveRulesReady = resolve;
  });

  window.__requestMockLite = {
    installed: true,
    version: "0.1.9-dev",
    state: () => mockState,
    ready: () => hasReceivedRules,
    activeRules: () => activeRules(),
    test: (url, method = "GET") => findMock(absolutizeUrl(url), String(method).toUpperCase()),
    renderTemplate: (body, url = window.location.href, method = "GET") => {
      const request = {
        url: absolutizeUrl(url),
        method: String(method || "GET").toUpperCase()
      };
      return resolveResponseBody({ body, responseMode: "template" }, request);
    },
    debugRule: (url, method = "GET") => {
      const request = {
        url: absolutizeUrl(url),
        method: String(method || "GET").toUpperCase()
      };
      const rule = findMock(request.url, request.method);
      if (!rule) return null;
      return {
        name: rule.name,
        enabled: rule.enabled,
        method: rule.method,
        status: rule.status,
        matchType: rule.matchType,
        urlPattern: rule.urlPattern,
        responseMode: rule.responseMode || "static",
        hasTemplateTokens: hasTemplateTokens(rule.body || ""),
        rawBody: rule.body || "",
        renderedBody: resolveResponseBody(rule, request)
      };
    }
  };

  window.postMessage({ type: READY_EVENT }, "*");
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== RULES_EVENT) return;
    mockState = normalizeState(event.data.state);
    updateIndicator();
    if (!hasReceivedRules) {
      hasReceivedRules = true;
      resolveRulesReady();
    }
  });

  window.fetch = async function requestMockLiteFetch(input, init = {}) {
    const request = toRequestInfo(input, init);
    await waitForRules();
    const match = findMock(request.url, request.method);
    if (!match) return nativeFetch.apply(this, arguments);
    logHit("fetch", request, match);
    await wait(match.delayMs || 0);
    return new NativeResponse(resolveResponseBody(match, request), {
      status: match.status || 200,
      headers: new NativeHeaders(safeResponseHeaders(match.headers || {}))
    });
  };

  patchXhr();

  function patchXhr() {
    const proto = NativeXMLHttpRequest.prototype;
    const nativeOpen = proto.open;
    const nativeSend = proto.send;
    const nativeSetRequestHeader = proto.setRequestHeader;
    const nativeGetAllResponseHeaders = proto.getAllResponseHeaders;
    const nativeGetResponseHeader = proto.getResponseHeader;

    proto.open = function open(method, url) {
      this.__rml = {
        method: String(method || "GET").toUpperCase(),
        url: absolutizeUrl(url),
        requestHeaders: {}
      };
      return nativeOpen.apply(this, arguments);
    };

    proto.setRequestHeader = function setRequestHeader(name, value) {
      if (this.__rml) this.__rml.requestHeaders[String(name).toLowerCase()] = String(value);
      return nativeSetRequestHeader.apply(this, arguments);
    };

    proto.getAllResponseHeaders = function getAllResponseHeaders() {
      if (this.__rmlMock) return headersToString(this.__rmlMock.headers);
      return nativeGetAllResponseHeaders.apply(this, arguments);
    };

    proto.getResponseHeader = function getResponseHeader(name) {
      if (this.__rmlMock) {
        return this.__rmlMock.headers[String(name).toLowerCase()] || null;
      }
      return nativeGetResponseHeader.apply(this, arguments);
    };

    proto.send = function send() {
      const request = this.__rml || {};
      const args = arguments;
      waitForRules().then(() => {
        const match = findMock(request.url, request.method);
        if (!match) {
          nativeSend.apply(this, args);
          return;
        }
        logHit("xhr", request, match);
        this.__rmlMock = {
          body: resolveResponseBody(match, request),
          status: match.status || 200,
          headers: safeResponseHeaders(match.headers || {}),
          url: request.url
        };
        respondToXhr(this, this.__rmlMock, match.delayMs || 0);
      });
      return undefined;
    };
  }

  function respondToXhr(xhr, mock, delayMs) {
    setXhrProps(xhr, {
      readyState: 2,
      status: mock.status,
      statusText: statusText(mock.status),
      responseURL: mock.url
    });
    dispatch(xhr, "readystatechange");

    window.setTimeout(() => {
      const response = coerceXhrResponse(mock.body, xhr.responseType);
      setXhrProps(xhr, {
        readyState: 4,
        status: mock.status,
        statusText: statusText(mock.status),
        responseURL: mock.url,
        responseText: typeof response === "string" ? response : mock.body,
        response
      });
      dispatch(xhr, "readystatechange");
      dispatch(xhr, "load");
      dispatch(xhr, "loadend");
    }, delayMs);
  }

  function setXhrProps(xhr, props) {
    Object.entries(props).forEach(([key, value]) => {
      try {
        Object.defineProperty(xhr, key, { configurable: true, get: () => value });
      } catch {
        try {
          xhr[key] = value;
        } catch {
          // Native XHR properties can be read-only in some engines.
        }
      }
    });
  }

  function dispatch(xhr, type) {
    const event = new Event(type);
    xhr.dispatchEvent(event);
  }

  function findMock(url, method) {
    if (!url) return null;
    return activeRules().find((rule) => {
      if (rule.method !== "ANY" && rule.method !== method) return false;
      return matchUrl(rule, url);
    }) || null;
  }

  function activeRules() {
    const enabledGroups = new Set(
      mockState.groups.filter((group) => group.enabled).map((group) => group.id)
    );
    return mockState.rules.filter((rule) => rule.enabled && enabledGroups.has(rule.groupId));
  }

  function matchUrl(rule, url) {
    if (rule.matchType === "path") return urlWithoutSearch(url) === rule.urlPattern;
    if (rule.matchType === "contains") return url.includes(rule.urlPattern);
    if (rule.matchType === "regex") {
      try {
        return new RegExp(rule.urlPattern).test(url);
      } catch {
        return false;
      }
    }
    return url === rule.urlPattern;
  }

  function urlWithoutSearch(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url.split("?")[0].split("#")[0];
    }
  }

  function toRequestInfo(input, init) {
    if (input instanceof NativeRequest) {
      return {
        url: input.url,
        method: String(init.method || input.method || "GET").toUpperCase()
      };
    }
    return {
      url: absolutizeUrl(input),
      method: String(init.method || "GET").toUpperCase()
    };
  }

  function absolutizeUrl(url) {
    try {
      return new URL(String(url), window.location.href).href;
    } catch {
      return String(url || "");
    }
  }

  function normalizeState(state) {
    return {
      groups: Array.isArray(state?.groups) ? state.groups : [],
      rules: Array.isArray(state?.rules) ? state.rules.map((rule) => ({
        ...rule,
        method: String(rule.method || "GET").toUpperCase(),
        headers: lowerCaseHeaders(rule.headers || {})
      })) : []
    };
  }

  function lowerCaseHeaders(headers) {
    return Object.entries(headers).reduce((acc, [key, value]) => {
      acc[String(key).toLowerCase()] = String(value);
      return acc;
    }, {});
  }

  function safeResponseHeaders(headers) {
    const blocked = new Set([
      "content-length",
      "content-encoding",
      "transfer-encoding",
      "connection",
      "set-cookie",
      "set-cookie2"
    ]);
    return Object.entries(lowerCaseHeaders(headers)).reduce((acc, [key, value]) => {
      if (!blocked.has(key)) acc[key] = value;
      return acc;
    }, {});
  }

  function headersToString(headers) {
    return Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join("\r\n");
  }

  function coerceXhrResponse(body, responseType) {
    if (responseType === "json") {
      try {
        return JSON.parse(body);
      } catch {
        return null;
      }
    }
    if (responseType === "blob") {
      return new Blob([body]);
    }
    if (responseType === "arraybuffer") {
      return new TextEncoder().encode(body).buffer;
    }
    return body;
  }

  function statusText(status) {
    const map = {
      200: "OK",
      201: "Created",
      204: "No Content",
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      500: "Internal Server Error",
      503: "Service Unavailable"
    };
    return map[status] || "";
  }

  function logHit(kind, request, rule) {
    const hasTokens = hasTemplateTokens(rule.body || "");
    console.info(
      `[Request Mock Lite] mocked ${kind.toUpperCase()} ${request.method} ${request.url}`,
      {
        rule: rule.name,
        status: rule.status,
        matchType: rule.matchType,
        responseMode: rule.responseMode || "static",
        hasTemplateTokens: hasTokens
      }
    );
    showIndicatorHit(request, rule);
  }

  function resolveResponseBody(rule, request) {
    const body = rule.body || "";
    if (rule.responseMode !== "template" && !hasTemplateTokens(body)) return body;
    return body.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, token) => {
      const value = resolveTemplateToken(token, request);
      return value == null ? _match : String(value);
    });
  }

  function hasTemplateTokens(value) {
    return /\{\{\s*[^{}]+?\s*\}\}/.test(value || "");
  }

  function resolveTemplateToken(token, request) {
    const normalized = String(token || "").trim();
    if (normalized === "uuid") return randomUuid();
    if (normalized === "timestamp") return Date.now();
    if (normalized === "isoDate") return new Date().toISOString();
    if (normalized === "boolean") return Math.random() >= 0.5;
    if (normalized === "name") return randomFrom(["Alex Chen", "Maya Patel", "Sam Rivera", "Nora Lee", "Jordan Kim"]);
    if (normalized === "email") return `${randomFrom(["alex", "maya", "sam", "nora", "jordan"])}.${randomInt(100, 999)}@example.com`;
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
    if (normalized === "request.path") return requestPath(request.url);
    if (normalized.startsWith("request.query.")) {
      return requestQuery(request.url).get(normalized.slice("request.query.".length)) || "";
    }
    return undefined;
  }

  function requestPath(url) {
    try {
      return new URL(url).pathname;
    } catch {
      return "";
    }
  }

  function requestQuery(url) {
    try {
      return new URL(url).searchParams;
    } catch {
      return new URLSearchParams();
    }
  }

  function randomUuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const value = Math.random() * 16 | 0;
      return (char === "x" ? value : (value & 0x3 | 0x8)).toString(16);
    });
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

  function updateIndicator() {
    if (!canShowIndicator()) return;
    const rules = activeRules();
    if (!rules.length) {
      if (indicator) indicator.host.hidden = true;
      return;
    }
    const ui = ensureIndicator();
    ui.host.hidden = false;
    ui.host.dataset.hit = "false";
    ui.title.textContent = "MOCK ON";
    ui.meta.textContent = `${rules.length} active rule${rules.length === 1 ? "" : "s"}`;
  }

  function showIndicatorHit(request, rule) {
    if (!canShowIndicator()) return;
    const ui = ensureIndicator();
    const path = compactPath(request.url);
    ui.host.hidden = false;
    ui.host.dataset.hit = "true";
    ui.title.textContent = "MOCK HIT";
    ui.meta.textContent = `${request.method} ${path}`;
    ui.detail.textContent = rule.name || "";
    window.clearTimeout(indicatorHitTimer);
    indicatorHitTimer = window.setTimeout(() => {
      if (indicator) {
        indicator.detail.textContent = "";
        updateIndicator();
      }
    }, 1800);
  }

  function ensureIndicator() {
    if (indicator) return indicator;
    const host = document.createElement("request-mock-lite-indicator");
    host.hidden = true;
    host.dataset.hit = "false";
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 2147483647;
        pointer-events: none;
      }
      .badge {
        min-width: 124px;
        max-width: 280px;
        padding: 9px 11px;
        border: 1px solid rgba(88, 196, 182, .55);
        border-radius: 10px;
        background: rgba(17, 20, 24, .92);
        box-shadow: 0 12px 36px rgba(0, 0, 0, .28);
        color: #f4f0e8;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(10px);
      }
      :host([data-hit="true"]) .badge {
        border-color: rgba(232, 93, 64, .85);
        background: rgba(232, 93, 64, .94);
      }
      .title {
        font-size: 11px;
        font-weight: 850;
        letter-spacing: .08em;
        line-height: 1;
      }
      .meta {
        margin-top: 5px;
        overflow: hidden;
        color: rgba(244, 240, 232, .78);
        font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
        font-size: 11px;
        line-height: 1.25;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .detail {
        margin-top: 3px;
        overflow: hidden;
        color: rgba(244, 240, 232, .64);
        font-size: 10px;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;
    const badge = document.createElement("div");
    const title = document.createElement("div");
    const meta = document.createElement("div");
    const detail = document.createElement("div");
    badge.className = "badge";
    title.className = "title";
    meta.className = "meta";
    detail.className = "detail";
    badge.append(title, meta, detail);
    root.append(style, badge);
    appendIndicatorHost(host);
    indicator = { host, title, meta, detail };
    return indicator;
  }

  function appendIndicatorHost(host) {
    const parent = document.body || document.documentElement;
    if (parent) {
      parent.append(host);
      return;
    }
    document.addEventListener("DOMContentLoaded", () => document.body.append(host), { once: true });
  }

  function canShowIndicator() {
    try {
      return window.top === window && Boolean(document.documentElement);
    } catch {
      return false;
    }
  }

  function compactPath(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}`.slice(0, 80);
    } catch {
      return String(url || "").slice(0, 80);
    }
  }

  function waitForRules() {
    if (hasReceivedRules) return Promise.resolve();
    return Promise.race([rulesReady, wait(RULES_READY_TIMEOUT_MS)]);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
})();
