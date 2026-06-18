(() => {
  if (window.__requestMockLite?.installed) return;

  const RULES_EVENT = "REQUEST_MOCK_LITE_RULES";
  const READY_EVENT = "REQUEST_MOCK_LITE_READY";
  const CAPTURE_EVENT = "REQUEST_MOCK_LITE_CAPTURE";
  const RULES_READY_TIMEOUT_MS = 1200;
  const nativeFetch = window.fetch;
  const NativeRequest = window.Request;
  const NativeResponse = window.Response;
  const NativeHeaders = window.Headers;
  const NativeXMLHttpRequest = window.XMLHttpRequest;
  const STATIC_RESOURCE_EXT_RE = /\.(avif|bmp|css|gif|ico|jpe?g|js|mjs|map|mp3|mp4|png|svg|webp|woff2?|ttf|otf)([?#].*)?$/i;
  const STATIC_MIME_RE = /^(image|audio|video|font)\//i;
  const STATIC_TEXT_MIME_RE = /\btext\/(css|javascript)\b|\bapplication\/(javascript|x-javascript|font-woff|font-woff2|octet-stream)\b/i;
  const API_MIME_RE = /\b(application\/(json|graphql\+json|problem\+json|xml|x-www-form-urlencoded)|text\/(plain|xml|event-stream))\b/i;
  const API_URL_RE = /\/(api|apis|graphql|gql|rpc|trpc|rest|v\d+)(\/|$|\?)/i;

  try {
    window.CSS?.registerProperty?.({
      name: "--rml-beam-angle",
      syntax: "<angle>",
      initialValue: "0deg",
      inherits: false
    });
  } catch (_) {}

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
    if (!match) {
      const response = await nativeFetch.apply(this, arguments);
      captureFetchResponse(request, response);
      return response;
    }
    logHit("fetch", request, match);
    await wait(match.delayMs || 0);
    const parts = await buildResponseParts(match, request);
    const response = new NativeResponse(parts.body, {
      status: parts.status,
      headers: new NativeHeaders(safeResponseHeaders(parts.headers))
    });
    captureFetchResponse(request, response);
    return response;
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
      if (!isNativeXhr(this)) return "";
      return nativeGetAllResponseHeaders.apply(this, arguments);
    };

    proto.getResponseHeader = function getResponseHeader(name) {
      if (this.__rmlMock) {
        return this.__rmlMock.headers[String(name).toLowerCase()] || null;
      }
      if (!isNativeXhr(this)) return null;
      return nativeGetResponseHeader.apply(this, arguments);
    };

    proto.send = function send(bodyArg) {
      const request = this.__rml || {};
      request.headers = request.requestHeaders || {};
      request.body = typeof bodyArg === "string" ? bodyArg : null;
      const args = arguments;
      waitForRules().then(() => {
        const match = findMock(request.url, request.method);
        if (!match) {
          this.addEventListener("loadend", () => captureXhrResponse(this, request), { once: true });
          nativeSend.apply(this, args);
          return;
        }
        logHit("xhr", request, match);
        buildResponseParts(match, request).then((parts) => {
          this.__rmlMock = {
            body: parts.body,
            status: parts.status,
            headers: safeResponseHeaders(parts.headers),
            url: request.url
          };
          respondToXhr(this, this.__rmlMock, match.delayMs || 0);
        });
      });
      return undefined;
    };
  }

  function isNativeXhr(value) {
    return value instanceof NativeXMLHttpRequest;
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
      captureMockXhrResponse(mock, xhr.__rml?.method || "GET");
    }, delayMs);
  }

  function captureFetchResponse(request, response) {
    if (!shouldCapture(request.url)) return;
    try {
      const clone = response.clone();
      clone.text()
        .then((body) => {
          emitCapture({
            url: request.url,
            method: request.method,
            status: response.status,
            mimeType: response.headers.get("content-type") || "",
            body,
            headers: headersFromFetch(response.headers)
          });
        })
        .catch(() => {
          emitCapture({
            url: request.url,
            method: request.method,
            status: response.status,
            mimeType: response.headers.get("content-type") || "",
            body: "",
            headers: headersFromFetch(response.headers)
          });
        });
    } catch (_) {}
  }

  function captureXhrResponse(xhr, request) {
    if (!shouldCapture(request.url)) return;
    emitCapture({
      url: request.url,
      method: request.method,
      status: xhr.status || 0,
      mimeType: xhr.getResponseHeader("content-type") || "",
      body: safeXhrBody(xhr),
      headers: parseResponseHeaders(xhr.getAllResponseHeaders())
    });
  }

  function captureMockXhrResponse(mock, method) {
    if (!shouldCapture(mock.url)) return;
    emitCapture({
      url: mock.url,
      method,
      status: mock.status || 0,
      mimeType: mock.headers["content-type"] || "",
      body: mock.body || "",
      headers: mock.headers || {}
    });
  }

  function shouldCapture(url) {
    return Boolean(mockState.settings?.captureEnabled && isMockableUrl(url) && !isStaticResourceUrl(url));
  }

  function isMockableUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
  }

  function emitCapture(entry) {
    if (!isApiCaptureEntry(entry)) return;
    window.postMessage({
      type: CAPTURE_EVENT,
      entry: {
        id: randomUuid(),
        capturedAt: Date.now(),
        ...entry
      }
    }, "*");
  }

  function isApiCaptureEntry(entry) {
    const headers = entry?.headers || {};
    const mimeType = String(entry?.mimeType || headers["content-type"] || headers["Content-Type"] || "");
    const url = String(entry?.url || "");
    if (!isMockableUrl(url) || isStaticResourceUrl(url)) return false;
    if (STATIC_MIME_RE.test(mimeType) || STATIC_TEXT_MIME_RE.test(mimeType)) return false;
    return API_MIME_RE.test(mimeType) || API_URL_RE.test(url) || !mimeType;
  }

  function isStaticResourceUrl(url) {
    return STATIC_RESOURCE_EXT_RE.test(String(url || ""));
  }

  function headersFromFetch(headers) {
    const out = {};
    headers.forEach((value, key) => { out[String(key).toLowerCase()] = String(value); });
    return out;
  }

  function parseResponseHeaders(value) {
    return String(value || "").trim().split(/\r?\n/).reduce((acc, line) => {
      const index = line.indexOf(":");
      if (index > 0) acc[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
      return acc;
    }, {});
  }

  function safeXhrBody(xhr) {
    try {
      if (!xhr.responseType || xhr.responseType === "text") return xhr.responseText || "";
      if (xhr.responseType === "json") return JSON.stringify(xhr.response ?? null);
    } catch (_) {}
    return "";
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
        method: String(init.method || input.method || "GET").toUpperCase(),
        headers: toPlainHeaders(init.headers || input.headers),
        body: typeof init.body === "string" ? init.body : null
      };
    }
    return {
      url: absolutizeUrl(input),
      method: String(init.method || "GET").toUpperCase(),
      headers: toPlainHeaders(init.headers),
      body: typeof init.body === "string" ? init.body : null
    };
  }

  function toPlainHeaders(headers) {
    const out = {};
    if (!headers) return out;
    if (Array.isArray(headers)) {
      headers.forEach((pair) => {
        if (pair && pair.length >= 2) out[String(pair[0]).toLowerCase()] = String(pair[1]);
      });
      return out;
    }
    if (typeof headers.forEach === "function") {
      headers.forEach((value, key) => { out[String(key).toLowerCase()] = String(value); });
      return out;
    }
    return lowerCaseHeaders(headers);
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
      settings: {
        captureEnabled: state?.settings?.captureEnabled ?? false
      },
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

  async function buildResponseParts(rule, request) {
    if (rule.responseMode === "function") {
      return runFunctionResponse(rule, request);
    }
    if (rule.responseMode === "merge") {
      return runMergeResponse(rule, request);
    }
    return {
      status: rule.status || 200,
      headers: rule.headers || {},
      body: resolveResponseBody(rule, request)
    };
  }

  async function runMergeResponse(rule, request) {
    let real = null;
    try {
      real = await fetchRealResponse(request);
    } catch (error) {
      console.warn(
        "[Request Mock Lite] real request failed; merge falls back to the patch only",
        error
      );
    }

    const status = real ? real.status : (rule.status || 200);
    const headers = real
      ? { ...real.headers, ...lowerCaseHeaders(rule.headers || {}) }
      : { ...(rule.headers || {}) };
    delete headers["content-length"];

    const patchText = (resolveResponseBody(rule, request) || "").trim();
    if (!patchText) {
      return { status, headers, body: real ? real.text : "" };
    }

    const patch = safeJsonParse(patchText);
    if (patch === undefined) {
      console.warn("[Request Mock Lite] merge patch is not valid JSON; returning it as-is");
      return { status, headers, body: patchText };
    }

    const base = real ? safeJsonParse(real.text) : undefined;
    if (base === undefined) {
      console.warn("[Request Mock Lite] real response is not JSON; returning the patch as the body");
      return { status, headers, body: JSON.stringify(patch) };
    }

    return { status, headers, body: JSON.stringify(deepMerge(base, patch)) };
  }

  function deepMerge(base, patch) {
    if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
    const result = { ...base };
    Object.keys(patch).forEach((key) => {
      result[key] = isPlainObject(patch[key]) && isPlainObject(result[key])
        ? deepMerge(result[key], patch[key])
        : patch[key];
    });
    return result;
  }

  async function runFunctionResponse(rule, request) {
    let real = null;
    try {
      real = await fetchRealResponse(request);
    } catch (error) {
      console.warn(
        "[Request Mock Lite] real request failed; response will be undefined inside the function",
        error
      );
    }
    try {
      // Note: new Function is blocked on sites whose CSP forbids 'unsafe-eval'.
      const factory = new Function("return (" + (rule.body || "") + ");");
      const fn = factory();
      if (typeof fn !== "function") {
        throw new TypeError("Response source must be a function, e.g. function(req) { return {} }");
      }
      const result = await Promise.resolve(fn(buildFunctionArg(request, real)));
      return normalizeFunctionResult(result, real, rule);
    } catch (error) {
      console.error("[Request Mock Lite] response function failed", error);
      return {
        status: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: "Request Mock Lite response function failed",
          message: String(error && error.message ? error.message : error)
        })
      };
    }
  }

  async function fetchRealResponse(request) {
    const init = { method: request.method, headers: request.headers || {} };
    if (request.body != null && request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }
    const res = await nativeFetch(request.url, init);
    const text = await res.text();
    const headers = {};
    res.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
    return {
      status: res.status,
      statusText: res.statusText,
      headers,
      text,
      contentType: headers["content-type"] || ""
    };
  }

  function buildFunctionArg(request, real) {
    const arg = buildRequestArg(request);
    arg.response = real ? real.text : undefined;
    arg.responseJSON = real ? safeJsonParse(real.text) : undefined;
    arg.responseHeaders = real ? real.headers : undefined;
    arg.responseType = real ? real.contentType : undefined;
    arg.status = real ? real.status : undefined;
    arg.statusText = real ? real.statusText : undefined;
    return arg;
  }

  function normalizeFunctionResult(result, real, rule) {
    let status = real ? real.status : (rule.status || 200);
    let headers = real
      ? { ...real.headers, ...lowerCaseHeaders(rule.headers || {}) }
      : { ...(rule.headers || {}) };
    let bodyValue = result;
    if (isPlainObject(result) && Object.prototype.hasOwnProperty.call(result, "body")) {
      if (result.status != null) status = result.status;
      if (isPlainObject(result.headers)) headers = { ...headers, ...lowerCaseHeaders(result.headers) };
      bodyValue = result.body;
    }
    const body = typeof bodyValue === "string"
      ? bodyValue
      : JSON.stringify(bodyValue === undefined ? null : bodyValue);
    delete headers["content-length"];
    return { status, headers, body };
  }

  function safeJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return undefined;
    }
  }

  function buildRequestArg(request) {
    const query = {};
    let path = "";
    try {
      const parsed = new URL(request.url);
      path = parsed.pathname;
      parsed.searchParams.forEach((value, key) => { query[key] = value; });
    } catch (_) {
      // Non-absolute or malformed URL; leave path/query empty.
    }
    return {
      url: request.url,
      method: request.method,
      path,
      query,
      headers: request.headers || {},
      body: request.body == null ? null : request.body
    };
  }

  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
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
    const rules = activeRulesForCurrentOrigin();
    if (!rules.length) {
      if (indicator) indicator.host.hidden = true;
      return;
    }
    const ui = ensureIndicator();
    ui.host.hidden = false;
    ui.host.dataset.hit = "false";
    ui.title.textContent = "MOCK ON";
    ui.meta.textContent = `${rules.length} rule${rules.length === 1 ? "" : "s"} for this site`;
  }

  function activeRulesForCurrentOrigin() {
    return activeRules().filter(ruleTargetsCurrentOrigin);
  }

  function ruleTargetsCurrentOrigin(rule) {
    const pattern = String(rule?.urlPattern || "").trim();
    if (!pattern) return false;

    if (rule.matchType === "regex") return regexTargetsCurrentOrigin(pattern);
    if (rule.matchType === "contains") return containsPatternTargetsCurrentOrigin(pattern);
    return exactPatternTargetsCurrentOrigin(pattern);
  }

  function exactPatternTargetsCurrentOrigin(pattern) {
    if (pattern.startsWith("/")) return true;
    if (!isAbsoluteHttpPattern(pattern)) return false;
    try {
      return new URL(pattern).origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function containsPatternTargetsCurrentOrigin(pattern) {
    if (pattern.startsWith("/")) return true;
    try {
      if (isAbsoluteHttpPattern(pattern)) return new URL(pattern).origin === window.location.origin;
      if (pattern.startsWith("//")) return new URL(`${window.location.protocol}${pattern}`).origin === window.location.origin;
    } catch {
      return false;
    }
    const host = window.location.host;
    return Boolean(host && pattern.includes(host));
  }

  function regexTargetsCurrentOrigin(pattern) {
    try {
      const regex = new RegExp(pattern);
      const escapedHost = escapeRegex(window.location.host);
      return regex.test(window.location.origin)
        || regex.test(window.location.href)
        || new RegExp(escapedHost).test(pattern);
    } catch {
      return false;
    }
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
      @keyframes rml-border-beam {
        to { --rml-beam-angle: 360deg; }
      }
      :host {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 2147483647;
        pointer-events: none;
        --rml-cyan: #22d3ee;
        --rml-pink: #f472b6;
        --rml-lime: #bef264;
        --rml-ink: #071018;
      }
      .badge {
        position: relative;
        min-width: 142px;
        max-width: 312px;
        padding: 10px 12px 10px 14px;
        border: 1px solid transparent;
        border-radius: 4px;
        background:
          linear-gradient(135deg, rgba(7, 16, 24, .94), rgba(12, 23, 34, .84)) padding-box;
        box-shadow:
          0 14px 36px rgba(0, 0, 0, .34),
          0 0 24px rgba(34, 211, 238, .12);
        color: #f8fdff;
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow: hidden;
        backdrop-filter: blur(12px) saturate(1.18);
        clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
      }
      .badge::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        border-radius: inherit;
        padding: 1px;
        background: conic-gradient(
          from var(--rml-beam-angle),
          rgba(34, 211, 238, .28),
          var(--rml-cyan) 72deg,
          var(--rml-pink) 150deg,
          var(--rml-lime) 228deg,
          rgba(34, 211, 238, .28) 360deg
        );
        -webkit-mask:
          linear-gradient(#fff 0 0) content-box,
          linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        animation: rml-border-beam 3s linear infinite;
        pointer-events: none;
      }
      .badge::after {
        content: "";
        position: absolute;
        inset: 1px;
        z-index: 0;
        background:
          linear-gradient(90deg, transparent, rgba(34, 211, 238, .12), transparent),
          repeating-linear-gradient(180deg, rgba(248, 253, 255, .05) 0 1px, transparent 1px 5px);
        opacity: .32;
        pointer-events: none;
      }
      :host([data-hit="true"]) .badge {
        box-shadow:
          0 14px 38px rgba(0, 0, 0, .38),
          0 0 28px rgba(244, 114, 182, .22),
          0 0 18px rgba(190, 242, 100, .16);
      }
      :host([data-hit="true"]) .badge::before {
        background: conic-gradient(
          from var(--rml-beam-angle),
          rgba(244, 114, 182, .30),
          var(--rml-pink) 70deg,
          var(--rml-lime) 150deg,
          var(--rml-cyan) 250deg,
          rgba(244, 114, 182, .30) 360deg
        );
        animation-duration: 1.55s;
      }
      .title {
        position: relative;
        z-index: 1;
        color: var(--rml-cyan);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .12em;
        line-height: 1.05;
        text-transform: uppercase;
        text-shadow: 0 0 12px rgba(34, 211, 238, .34);
      }
      :host([data-hit="true"]) .title {
        color: var(--rml-lime);
        text-shadow: 0 0 14px rgba(190, 242, 100, .28);
      }
      .meta {
        position: relative;
        z-index: 1;
        margin-top: 5px;
        overflow: hidden;
        color: rgba(248, 253, 255, .86);
        font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
        font-size: 11px;
        line-height: 1.25;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .detail {
        position: relative;
        z-index: 1;
        margin-top: 3px;
        overflow: hidden;
        color: rgba(244, 114, 182, .88);
        font-size: 10px;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      @media (prefers-reduced-motion: reduce) {
        .badge::before {
          animation: none;
        }
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

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function isAbsoluteHttpPattern(value) {
    return /^https?:\/\//i.test(String(value || ""));
  }

  function waitForRules() {
    if (hasReceivedRules) return Promise.resolve();
    return Promise.race([rulesReady, wait(RULES_READY_TIMEOUT_MS)]);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
})();
