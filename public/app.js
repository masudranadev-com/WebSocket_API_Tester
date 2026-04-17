const config = {
  username: document.body.dataset.username,
  workspaceUrl: document.body.dataset.workspaceUrl,
  csrfToken: document.body.dataset.csrfToken
};

const METHOD_PILL_CLASSES = {
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  amber: "bg-amber-100 text-amber-700",
  violet: "bg-violet-100 text-violet-700",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
  cyan: "bg-cyan-100 text-cyan-700"
};

const state = {
  activeTab: "apis",
  search: "",
  apiRoutes: [],
  wsEvents: [],
  placeholderGuide: [],
  stats: null,
  selectedApiId: null,
  selectedWsId: null,
  apiDraft: null,
  wsDraft: null
};

const defaultApiDraft = () => ({
  id: null,
  method: "GET",
  path: "/",
  status_code: 200,
  content_type: "application/json",
  response_body: '{\n  "message": "Hello [[USERNAME]]",\n  "requestId": "[[UUID]]"\n}',
  headers_json: '{\n  "Cache-Control": "no-store"\n}',
  delay_ms: 0,
  is_active: true,
  notes: "",
  hit_count: 0,
  last_hit_at: null,
  url: `${config.workspaceUrl}`
});

const defaultWsDraft = () => ({
  id: null,
  namespace: "",
  event_name: "order.created",
  payload_template: '{\n  "id": "[[UUID]]",\n  "customer": "[[NAME]]",\n  "createdAt": "[[NOW_ISO]]"\n}',
  is_active: true,
  notes: "",
  trigger_count: 0,
  last_trigger_at: null,
  full_namespace: buildSocketNamespace(config.username)
});

function normalizePath(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  const collapsed = trimmed.replace(/\/+/g, "/");
  const prefixed = collapsed.startsWith("/") ? collapsed : `/${collapsed}`;
  return prefixed.length > 1 ? prefixed.replace(/\/$/, "") : prefixed;
}

function normalizeNamespace(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  const collapsed = trimmed.replace(/\/+/g, "/");
  const prefixed = collapsed.startsWith("/") ? collapsed : `/${collapsed}`;
  return prefixed.length > 1 ? prefixed.replace(/\/$/, "") : "";
}

function buildSocketNamespace(username, namespace = "") {
  return `/${encodeURIComponent(String(username || ""))}${normalizeNamespace(namespace)}`;
}

const elements = {
  feedback: document.getElementById("feedback"),
  listContainer: document.getElementById("list-container"),
  listSearch: document.getElementById("list-search"),
  listHeadingEyebrow: document.getElementById("list-heading-eyebrow"),
  listHeadingTitle: document.getElementById("list-heading-title"),
  tabApis: document.getElementById("tab-apis"),
  tabWs: document.getElementById("tab-ws"),
  newItem: document.getElementById("new-item"),
  logoutButton: document.getElementById("logout-button"),
  copyWorkspaceUrl: document.getElementById("copy-workspace-url"),
  guideDrawer: document.getElementById("guide-drawer"),
  guideList: document.getElementById("guide-list"),
  toggleGuide: document.getElementById("toggle-guide"),
  closeGuide: document.getElementById("close-guide"),
  statApiCount: document.getElementById("stat-api-count"),
  statWsCount: document.getElementById("stat-ws-count"),
  statApiHits: document.getElementById("stat-api-hits"),
  statWsTriggers: document.getElementById("stat-ws-triggers"),
  statBlockedIps: document.getElementById("stat-blocked-ips"),
  statBlockedAt: document.getElementById("stat-blocked-at"),
  apiEditor: document.getElementById("api-editor"),
  wsEditor: document.getElementById("ws-editor"),
  apiFormTitle: document.getElementById("api-form-title"),
  apiForm: document.getElementById("api-form"),
  apiMethod: document.getElementById("api-method"),
  apiPath: document.getElementById("api-path"),
  apiStatusCode: document.getElementById("api-status-code"),
  apiContentType: document.getElementById("api-content-type"),
  apiResponseBody: document.getElementById("api-response-body"),
  apiHeadersJson: document.getElementById("api-headers-json"),
  apiDelayMs: document.getElementById("api-delay-ms"),
  apiIsActive: document.getElementById("api-is-active"),
  apiNotes: document.getElementById("api-notes"),
  deleteApi: document.getElementById("delete-api"),
  apiPublicUrl: document.getElementById("api-public-url"),
  apiTestBody: document.getElementById("api-test-body"),
  runApiTest: document.getElementById("run-api-test"),
  copyApiUrl: document.getElementById("copy-api-url"),
  copyApiCurl: document.getElementById("copy-api-curl"),
  apiTestResult: document.getElementById("api-test-result"),
  apiHitCount: document.getElementById("api-hit-count"),
  apiLastHit: document.getElementById("api-last-hit"),
  wsFormTitle: document.getElementById("ws-form-title"),
  wsForm: document.getElementById("ws-form"),
  wsNamespace: document.getElementById("ws-namespace"),
  wsEventName: document.getElementById("ws-event-name"),
  wsPayloadTemplate: document.getElementById("ws-payload-template"),
  wsNotes: document.getElementById("ws-notes"),
  wsIsActive: document.getElementById("ws-is-active"),
  deleteWs: document.getElementById("delete-ws"),
  wsNamespacePreview: document.getElementById("ws-namespace-preview"),
  triggerWs: document.getElementById("trigger-ws"),
  copyWsSnippet: document.getElementById("copy-ws-snippet"),
  copyWsPayload: document.getElementById("copy-ws-payload"),
  wsTriggerResult: document.getElementById("ws-trigger-result"),
  wsTriggerCount: document.getElementById("ws-trigger-count"),
  wsLastTrigger: document.getElementById("ws-last-trigger")
};

function setFeedback(message, type = "success") {
  if (!message) {
    elements.feedback.classList.add("hidden");
    return;
  }

  elements.feedback.textContent = message;
  elements.feedback.className =
    "rounded-2xl border px-4 py-3 text-sm " +
    (type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700");
  elements.feedback.classList.remove("hidden");
}

function formatDate(value) {
  if (!value) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": config.csrfToken,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function loadBootstrap() {
  const response = await fetch("/dashboard/bootstrap", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Unable to load dashboard data.");
  }

  const data = await response.json();
  state.apiRoutes = data.apiRoutes;
  state.wsEvents = data.wsEvents;
  state.placeholderGuide = data.placeholderGuide;
  state.stats = data.stats;
  config.csrfToken = data.csrfToken;

  if (!state.selectedApiId || !state.apiRoutes.some((item) => item.id === state.selectedApiId)) {
    state.selectedApiId = state.apiRoutes[0]?.id || null;
  }
  if (!state.selectedWsId || !state.wsEvents.some((item) => item.id === state.selectedWsId)) {
    state.selectedWsId = state.wsEvents[0]?.id || null;
  }

  const selectedApi = state.apiRoutes.find((item) => item.id === state.selectedApiId);
  const selectedWs = state.wsEvents.find((item) => item.id === state.selectedWsId);

  state.apiDraft = selectedApi ? { ...selectedApi } : defaultApiDraft();
  state.wsDraft = selectedWs ? { ...selectedWs } : defaultWsDraft();

  render();
}

function currentApi() {
  return state.apiDraft || defaultApiDraft();
}

function currentWs() {
  return state.wsDraft || defaultWsDraft();
}

function renderStats() {
  if (!state.stats) {
    return;
  }

  elements.statApiCount.textContent = String(state.stats.apiCount);
  elements.statWsCount.textContent = String(state.stats.wsCount);
  elements.statApiHits.textContent = String(state.stats.totalApiHits);
  elements.statWsTriggers.textContent = String(state.stats.totalWsTriggers);
  elements.statBlockedIps.textContent = String(state.stats.blockedIpCount);
  elements.statBlockedAt.textContent = state.stats.lastBlockedAt ? `Last block: ${formatDate(state.stats.lastBlockedAt)}` : "No active blocks";
}

function renderGuide() {
  elements.guideList.innerHTML = state.placeholderGuide
    .map(
      (item) => `
        <article class="rounded-2xl border border-ink/10 bg-white/85 p-4">
          <p class="font-mono text-sm font-semibold">${item.token}</p>
          <p class="mt-2 text-sm leading-6 text-ink/65">${item.meaning}</p>
        </article>
      `
    )
    .join("");
}

function renderList() {
  const isApi = state.activeTab === "apis";
  const items = isApi ? state.apiRoutes : state.wsEvents;
  const activeId = isApi ? state.selectedApiId : state.selectedWsId;
  const query = state.search.trim().toLowerCase();

  const filtered = items.filter((item) => {
    const haystack = isApi
      ? `${item.method} ${item.path} ${item.notes || ""}`.toLowerCase()
      : `${item.namespace} ${item.event_name} ${item.notes || ""}`.toLowerCase();
    return haystack.includes(query);
  });

  elements.listHeadingEyebrow.textContent = isApi ? "APIs" : "WebSocket";
  elements.listHeadingTitle.textContent = isApi ? "Routes" : "Events";

  if (!filtered.length) {
    elements.listContainer.innerHTML = `
      <div class="rounded-[1.5rem] border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-6 text-ink/60">
        ${isApi ? "No routes yet. Start with a path and response body." : "No events yet. Add a namespace and event name to begin."}
      </div>
    `;
    return;
  }

  elements.listContainer.innerHTML = filtered
    .map((item) => {
      if (isApi) {
        const methodPillClasses = METHOD_PILL_CLASSES[item.method_color] || METHOD_PILL_CLASSES.slate;
        return `
          <button type="button" data-api-id="${item.id}" class="list-card ${item.id === activeId ? "active" : ""} w-full rounded-[1.5rem] p-4 text-left">
            <div class="flex items-start justify-between gap-3">
              <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ${methodPillClasses}">${item.method}</span>
              <span class="text-xs ${item.is_active ? "text-emerald-600" : "text-amber-600"}">${item.is_active ? "Active" : "Paused"}</span>
            </div>
            <p class="mt-3 font-mono text-sm text-ink">${item.path}</p>
            <p class="mt-2 text-xs text-ink/50">Hits ${item.hit_count} • ${item.last_hit_at ? formatDate(item.last_hit_at) : "No traffic yet"}</p>
          </button>
        `;
      }

      return `
        <button type="button" data-ws-id="${item.id}" class="list-card ${item.id === activeId ? "active" : ""} w-full rounded-[1.5rem] p-4 text-left">
          <div class="flex items-start justify-between gap-3">
            <span class="inline-flex rounded-full bg-accentSoft px-3 py-1 text-xs font-semibold text-accent">${item.namespace || "/"}</span>
            <span class="text-xs ${item.is_active ? "text-emerald-600" : "text-amber-600"}">${item.is_active ? "Active" : "Paused"}</span>
          </div>
          <p class="mt-3 font-mono text-sm text-ink">${item.event_name}</p>
          <p class="mt-2 text-xs text-ink/50">Triggers ${item.trigger_count} • ${item.last_trigger_at ? formatDate(item.last_trigger_at) : "No trigger yet"}</p>
        </button>
      `;
    })
    .join("");
}

function renderApiEditor() {
  const route = currentApi();
  elements.apiFormTitle.textContent = route.id ? "Edit API endpoint" : "Create an API endpoint";
  elements.apiMethod.value = route.method;
  elements.apiPath.value = route.path;
  elements.apiStatusCode.value = String(route.status_code);
  elements.apiContentType.value = route.content_type;
  elements.apiResponseBody.value = route.response_body;
  elements.apiHeadersJson.value = route.headers_json;
  elements.apiDelayMs.value = String(route.delay_ms || 0);
  elements.apiIsActive.checked = Boolean(route.is_active);
  elements.apiNotes.value = route.notes || "";
  elements.apiPublicUrl.textContent = route.url || config.workspaceUrl;
  elements.apiHitCount.textContent = String(route.hit_count || 0);
  elements.apiLastHit.textContent = route.last_hit_at ? formatDate(route.last_hit_at) : "No traffic yet";
  elements.deleteApi.disabled = !route.id;
  elements.deleteApi.classList.toggle("opacity-50", !route.id);
}

function renderWsEditor() {
  const event = currentWs();
  elements.wsFormTitle.textContent = event.id ? "Edit WebSocket event" : "Create a WebSocket event";
  elements.wsNamespace.value = event.namespace || "";
  elements.wsEventName.value = event.event_name;
  elements.wsPayloadTemplate.value = event.payload_template;
  elements.wsNotes.value = event.notes || "";
  elements.wsIsActive.checked = Boolean(event.is_active);
  elements.wsNamespacePreview.textContent = `${window.location.origin}${event.full_namespace || buildSocketNamespace(config.username)}`;
  elements.wsTriggerCount.textContent = String(event.trigger_count || 0);
  elements.wsLastTrigger.textContent = event.last_trigger_at ? formatDate(event.last_trigger_at) : "No triggers yet";
  elements.deleteWs.disabled = !event.id;
  elements.deleteWs.classList.toggle("opacity-50", !event.id);
}

function refreshApiPreview() {
  const route = currentApi();
  elements.apiPublicUrl.textContent = route.url || config.workspaceUrl;
  elements.apiHitCount.textContent = String(route.hit_count || 0);
  elements.apiLastHit.textContent = route.last_hit_at ? formatDate(route.last_hit_at) : "No traffic yet";
  elements.deleteApi.disabled = !route.id;
  elements.deleteApi.classList.toggle("opacity-50", !route.id);
}

function refreshWsPreview() {
  const event = currentWs();
  elements.wsNamespacePreview.textContent = `${window.location.origin}${event.full_namespace || buildSocketNamespace(config.username)}`;
  elements.wsTriggerCount.textContent = String(event.trigger_count || 0);
  elements.wsLastTrigger.textContent = event.last_trigger_at ? formatDate(event.last_trigger_at) : "No triggers yet";
  elements.deleteWs.disabled = !event.id;
  elements.deleteWs.classList.toggle("opacity-50", !event.id);
}

function render() {
  renderStats();
  renderGuide();
  renderList();
  renderApiEditor();
  renderWsEditor();

  const isApi = state.activeTab === "apis";
  elements.tabApis.classList.toggle("active", isApi);
  elements.tabWs.classList.toggle("active", !isApi);
  elements.apiEditor.classList.toggle("hidden", !isApi);
  elements.wsEditor.classList.toggle("hidden", isApi);
}

function updateApiDraft() {
  const normalizedPath = normalizePath(elements.apiPath.value);
  state.apiDraft = {
    ...currentApi(),
    method: elements.apiMethod.value,
    path: normalizedPath,
    status_code: Number(elements.apiStatusCode.value || 200),
    content_type: elements.apiContentType.value,
    response_body: elements.apiResponseBody.value,
    headers_json: elements.apiHeadersJson.value,
    delay_ms: Number(elements.apiDelayMs.value || 0),
    is_active: elements.apiIsActive.checked,
    notes: elements.apiNotes.value,
    url: `${config.workspaceUrl}${normalizedPath === "/" ? "" : normalizedPath}`
  };
  refreshApiPreview();
}

function updateWsDraft() {
  const namespace = normalizeNamespace(elements.wsNamespace.value);
  state.wsDraft = {
    ...currentWs(),
    namespace,
    event_name: elements.wsEventName.value,
    payload_template: elements.wsPayloadTemplate.value,
    is_active: elements.wsIsActive.checked,
    notes: elements.wsNotes.value,
    full_namespace: buildSocketNamespace(config.username, namespace)
  };
  refreshWsPreview();
}

async function saveApi(event) {
  event.preventDefault();
  updateApiDraft();
  const draft = currentApi();

  const payload = {
    method: draft.method,
    path: draft.path,
    statusCode: draft.status_code,
    contentType: draft.content_type,
    responseBody: draft.response_body,
    headersJson: draft.headers_json,
    delayMs: draft.delay_ms,
    isActive: draft.is_active,
    notes: draft.notes
  };

  if (draft.id) {
    await apiFetch(`/dashboard/apis/${draft.id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    setFeedback("API route updated.");
  } else {
    await apiFetch("/dashboard/apis", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setFeedback("API route created.");
  }

  await loadBootstrap();
}

async function saveWs(event) {
  event.preventDefault();
  updateWsDraft();
  const draft = currentWs();

  const payload = {
    namespace: draft.namespace,
    eventName: draft.event_name,
    payloadTemplate: draft.payload_template,
    isActive: draft.is_active,
    notes: draft.notes
  };

  if (draft.id) {
    await apiFetch(`/dashboard/ws-events/${draft.id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    setFeedback("WebSocket event updated.");
  } else {
    await apiFetch("/dashboard/ws-events", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setFeedback("WebSocket event created.");
  }

  await loadBootstrap();
}

async function deleteCurrentApi() {
  const draft = currentApi();
  if (!draft.id) {
    return;
  }

  await apiFetch(`/dashboard/apis/${draft.id}`, {
    method: "DELETE"
  });
  state.selectedApiId = null;
  state.apiDraft = defaultApiDraft();
  setFeedback("API route deleted.");
  await loadBootstrap();
}

async function deleteCurrentWs() {
  const draft = currentWs();
  if (!draft.id) {
    return;
  }

  await apiFetch(`/dashboard/ws-events/${draft.id}`, {
    method: "DELETE"
  });
  state.selectedWsId = null;
  state.wsDraft = defaultWsDraft();
  setFeedback("WebSocket event deleted.");
  await loadBootstrap();
}

async function runApiTest() {
  const draft = currentApi();
  if (!draft.url) {
    return;
  }

  elements.apiTestResult.textContent = "Running request...";

  const options = {
    method: draft.method
  };

  if (!["GET", "HEAD"].includes(draft.method) && elements.apiTestBody.value.trim()) {
    options.headers = {
      "Content-Type": draft.content_type || "application/json"
    };
    options.body = elements.apiTestBody.value;
  }

  try {
    const response = await fetch(draft.url, options);
    const text = await response.text();
    elements.apiTestResult.textContent = [`Status: ${response.status}`, "", text || "(empty response)"].join("\n");
    await loadBootstrap();
  } catch (error) {
    elements.apiTestResult.textContent = error.message;
  }
}

async function triggerWsEvent() {
  const draft = currentWs();
  if (!draft.id) {
    return;
  }

  elements.wsTriggerResult.textContent = "Triggering event...";
  const result = await apiFetch(`/dashboard/ws-events/${draft.id}/trigger`, {
    method: "POST",
    body: JSON.stringify({})
  });
  elements.wsTriggerResult.textContent = JSON.stringify(result, null, 2);
  setFeedback("Event broadcast sent.");
  await loadBootstrap();
}

async function logout() {
  const result = await apiFetch("/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  });
  window.location.assign(result.redirectTo || "/");
}

function copyText(value, successMessage) {
  if (!navigator.clipboard?.writeText) {
    setFeedback("Clipboard access is not available in this browser.", "error");
    return;
  }

  navigator.clipboard
    .writeText(value)
    .then(() => setFeedback(successMessage))
    .catch(() => setFeedback("Unable to copy right now.", "error"));
}

function bindEvents() {
  elements.listSearch.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderList();
  });

  elements.tabApis.addEventListener("click", () => {
    state.activeTab = "apis";
    render();
  });

  elements.tabWs.addEventListener("click", () => {
    state.activeTab = "ws";
    render();
  });

  elements.newItem.addEventListener("click", () => {
    if (state.activeTab === "apis") {
      state.selectedApiId = null;
      state.apiDraft = defaultApiDraft();
    } else {
      state.selectedWsId = null;
      state.wsDraft = defaultWsDraft();
    }
    render();
  });

  elements.listContainer.addEventListener("click", (event) => {
    const apiButton = event.target.closest("[data-api-id]");
    if (apiButton) {
      state.selectedApiId = Number(apiButton.dataset.apiId);
      const selectedApi = state.apiRoutes.find((item) => item.id === state.selectedApiId);
      state.apiDraft = selectedApi ? { ...selectedApi } : defaultApiDraft();
      render();
      return;
    }

    const wsButton = event.target.closest("[data-ws-id]");
    if (wsButton) {
      state.selectedWsId = Number(wsButton.dataset.wsId);
      const selectedWs = state.wsEvents.find((item) => item.id === state.selectedWsId);
      state.wsDraft = selectedWs ? { ...selectedWs } : defaultWsDraft();
      render();
    }
  });

  elements.apiForm.addEventListener("submit", (event) => {
    saveApi(event).catch((error) => setFeedback(error.message, "error"));
  });
  elements.wsForm.addEventListener("submit", (event) => {
    saveWs(event).catch((error) => setFeedback(error.message, "error"));
  });

  [
    elements.apiMethod,
    elements.apiPath,
    elements.apiStatusCode,
    elements.apiContentType,
    elements.apiResponseBody,
    elements.apiHeadersJson,
    elements.apiDelayMs,
    elements.apiIsActive,
    elements.apiNotes
  ].forEach((element) => {
    element.addEventListener("input", updateApiDraft);
    element.addEventListener("change", updateApiDraft);
  });

  [
    elements.wsNamespace,
    elements.wsEventName,
    elements.wsPayloadTemplate,
    elements.wsNotes,
    elements.wsIsActive
  ].forEach((element) => {
    element.addEventListener("input", updateWsDraft);
    element.addEventListener("change", updateWsDraft);
  });

  elements.deleteApi.addEventListener("click", () => {
    deleteCurrentApi().catch((error) => setFeedback(error.message, "error"));
  });
  elements.deleteWs.addEventListener("click", () => {
    deleteCurrentWs().catch((error) => setFeedback(error.message, "error"));
  });
  elements.runApiTest.addEventListener("click", () => {
    runApiTest().catch((error) => setFeedback(error.message, "error"));
  });
  elements.triggerWs.addEventListener("click", () => {
    triggerWsEvent().catch((error) => setFeedback(error.message, "error"));
  });

  elements.copyWorkspaceUrl.addEventListener("click", () => copyText(config.workspaceUrl, "Workspace URL copied."));
  elements.copyApiUrl.addEventListener("click", () => copyText(currentApi().url || config.workspaceUrl, "API URL copied."));
  elements.copyApiCurl.addEventListener("click", () => {
    const route = currentApi();
    const curl = `curl -X ${route.method} "${route.url}"${elements.apiTestBody.value.trim() ? ` -H "Content-Type: ${route.content_type}" -d '${elements.apiTestBody.value.trim()}'` : ""}`;
    copyText(curl, "curl snippet copied.");
  });
  elements.copyWsSnippet.addEventListener("click", () => {
    const event = currentWs();
    const snippet = [
      `const socket = io("${window.location.origin}${event.full_namespace || buildSocketNamespace(config.username)}");`,
      `socket.on("${event.event_name}", (payload) => {`,
      "  console.log(payload);",
      "});"
    ].join("\n");
    copyText(snippet, "Socket client snippet copied.");
  });
  elements.copyWsPayload.addEventListener("click", () => copyText(currentWs().payload_template, "Payload template copied."));

  elements.logoutButton.addEventListener("click", () => {
    logout().catch((error) => setFeedback(error.message, "error"));
  });

  elements.toggleGuide.addEventListener("click", () => {
    elements.guideDrawer.classList.remove("hidden");
  });

  elements.closeGuide.addEventListener("click", () => {
    elements.guideDrawer.classList.add("hidden");
  });
}

async function init() {
  bindEvents();
  await loadBootstrap();
}

init().catch((error) => setFeedback(error.message, "error"));
