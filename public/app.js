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

const TEMPLATE_FIRST_NAMES = [
  "Avery",
  "Mila",
  "Kai",
  "Noah",
  "Leila",
  "Rowan",
  "Iris",
  "Theo",
  "Nadia",
  "Owen"
];

const TEMPLATE_LAST_NAMES = [
  "Kins",
  "Harper",
  "Rahman",
  "Torres",
  "Blake",
  "Chowdhury",
  "Patel",
  "Morales",
  "Nguyen",
  "Ahmed"
];

const state = {
  activeTab: "apis",
  search: "",
  apiRoutes: [],
  wsEvents: [],
  placeholderGuide: [],
  stats: null,
  modal: null
};

const elements = {
  feedback: document.getElementById("feedback"),
  headerMenuShell: document.getElementById("header-menu-shell"),
  headerMenuToggle: document.getElementById("header-menu-toggle"),
  headerMenuPanel: document.getElementById("header-menu-panel"),
  tabApis: document.getElementById("tab-apis"),
  tabWs: document.getElementById("tab-ws"),
  recordSearch: document.getElementById("record-search"),
  createRecord: document.getElementById("create-record"),
  recordsEyebrow: document.getElementById("records-eyebrow"),
  recordsTitle: document.getElementById("records-title"),
  recordsSummary: document.getElementById("records-summary"),
  recordsGrid: document.getElementById("records-grid"),
  copyWorkspaceBase: document.getElementById("copy-workspace-base"),
  toggleGuide: document.getElementById("toggle-guide"),
  closeGuide: document.getElementById("close-guide"),
  guideModal: document.getElementById("guide-modal"),
  guideBackdrop: document.getElementById("guide-backdrop"),
  guideList: document.getElementById("guide-list"),
  logoutButton: document.getElementById("logout-button"),
  entityModal: document.getElementById("entity-modal"),
  entityModalBackdrop: document.getElementById("entity-modal-backdrop"),
  entityModalPanel: document.getElementById("entity-modal-panel"),
  statApiCount: document.getElementById("stat-api-count"),
  statWsCount: document.getElementById("stat-ws-count"),
  statApiHits: document.getElementById("stat-api-hits"),
  statWsTriggers: document.getElementById("stat-ws-triggers"),
  statBlockedIps: document.getElementById("stat-blocked-ips"),
  statBlockedAt: document.getElementById("stat-blocked-at")
};

function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function createClientId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `cid-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createUuid() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

function randomItem(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function randomName() {
  return {
    first: randomItem(TEMPLATE_FIRST_NAMES),
    last: randomItem(TEMPLATE_LAST_NAMES)
  };
}

function randomInteger(min, max) {
  const low = Number(min);
  const high = Number(max);

  if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) {
    return "";
  }

  return String(Math.floor(Math.random() * (high - low + 1)) + low);
}

function decimalPlaces(value) {
  const source = String(value ?? "");
  if (!source.includes(".")) {
    return 0;
  }

  return source.split(".")[1].length;
}

function randomNumberInRange(min, max) {
  const precision = Math.max(decimalPlaces(min), decimalPlaces(max));
  if (precision === 0) {
    return randomInteger(min, max);
  }

  const scale = 10 ** precision;
  const low = Math.round(Number(min) * scale);
  const high = Math.round(Number(max) * scale);

  if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) {
    return "";
  }

  const value = Math.floor(Math.random() * (high - low + 1)) + low;
  return (value / scale).toFixed(precision);
}

function renderTemplatePreview(template, context = {}) {
  const source = String(template ?? "");

  return source.replace(/\[\[([A-Z0-9_.-]+)\]\]/g, (_, rawToken) => {
    const numberMatch = rawToken.match(/^NUMBER_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)$/);
    if (numberMatch) {
      return randomNumberInRange(numberMatch[1], numberMatch[2]);
    }

    if (rawToken.startsWith("NUMBER_")) {
      return `[[${rawToken}]]`;
    }

    switch (rawToken) {
      case "NAME": {
        const name = randomName();
        return `${name.first} ${name.last}`;
      }
      case "F_NAME":
        return randomName().first;
      case "L_NAME":
        return randomName().last;
      case "UUID":
        return createUuid();
      case "EMAIL": {
        const first = randomName().first.toLowerCase();
        const last = randomName().last.toLowerCase();
        return `${first}.${last}@example.com`;
      }
      case "NOW_ISO":
        return new Date().toISOString();
      case "USERNAME":
        return String(context.username ?? "");
      default:
        return `[[${rawToken}]]`;
    }
  });
}

function renderTemplateForCopy(template) {
  return renderTemplatePreview(template, {
    username: config.username
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeDoubleQuotes(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

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

function buildApiUrl(pathname) {
  const normalizedPath = normalizePath(pathname);
  return `${config.workspaceUrl}${normalizedPath === "/" ? "" : normalizedPath}`;
}

function buildSocketUrl(fullNamespace = buildSocketNamespace(config.username)) {
  return `${window.location.origin}${fullNamespace}`;
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

function isApiTab() {
  return state.activeTab === "apis";
}

function defaultResponseBodyForIndex(index) {
  if (index === 0) {
    return '{\n  "message": "Success for [[USERNAME]]",\n  "requestId": "[[UUID]]",\n  "customer": "[[NAME]]"\n}';
  }

  if (index === 1) {
    return '{\n  "error": "Validation failed",\n  "code": "validation_error",\n  "field": "email"\n}';
  }

  return '{\n  "message": "Mock response",\n  "requestId": "[[UUID]]"\n}';
}

function createApiResponseExample(overrides = {}, index = 0) {
  const isFirst = index === 0;
  return {
    client_id: overrides.client_id || createClientId(),
    name: overrides.name || (isFirst ? "Success" : index === 1 ? "Validation error" : `Response ${index + 1}`),
    status_code: Number(overrides.status_code ?? (isFirst ? 200 : index === 1 ? 422 : 400)),
    content_type: overrides.content_type || "application/json",
    response_body: overrides.response_body || defaultResponseBodyForIndex(index),
    headers_json:
      overrides.headers_json ||
      '{\n  "Cache-Control": "no-store"\n}',
    delay_ms: Number(overrides.delay_ms ?? 0),
    is_default: Boolean(overrides.is_default ?? isFirst)
  };
}

function defaultApiDraft() {
  const responseExample = createApiResponseExample({}, 0);
  return {
    id: null,
    method: "GET",
    path: "/",
    notes: "",
    is_active: true,
    hit_count: 0,
    last_hit_at: null,
    url: buildApiUrl("/"),
    response_examples: [responseExample]
  };
}

function defaultWsDraft() {
  const fullNamespace = buildSocketNamespace(config.username);
  return {
    id: null,
    namespace: "",
    event_name: "order.created",
    payload_template: '{\n  "id": "[[UUID]]",\n  "customer": "[[NAME]]",\n  "sequence": "[[NUMBER_100000_999999]]",\n  "createdAt": "[[NOW_ISO]]"\n}',
    notes: "",
    is_active: true,
    trigger_count: 0,
    last_trigger_at: null,
    full_namespace: fullNamespace
  };
}

function hydrateApiDraft(route) {
  const nextDraft = deepClone(route);
  nextDraft.path = normalizePath(nextDraft.path);
  nextDraft.url = nextDraft.url || buildApiUrl(nextDraft.path);
  nextDraft.response_examples = (nextDraft.response_examples || []).map((responseExample, index) =>
    createApiResponseExample(
      {
        ...responseExample,
        client_id: responseExample.client_id || createClientId()
      },
      index
    )
  );

  if (!nextDraft.response_examples.length) {
    nextDraft.response_examples = [createApiResponseExample({}, 0)];
  }

  ensureDraftDefaultResponse(nextDraft);
  return nextDraft;
}

function hydrateWsDraft(event) {
  const nextDraft = deepClone(event);
  nextDraft.namespace = normalizeNamespace(nextDraft.namespace);
  nextDraft.full_namespace = nextDraft.full_namespace || buildSocketNamespace(config.username, nextDraft.namespace);
  return nextDraft;
}

function ensureDraftDefaultResponse(draft) {
  if (!draft?.response_examples?.length) {
    return;
  }

  let defaultFound = false;
  draft.response_examples = draft.response_examples.map((responseExample, index) => {
    const shouldBeDefault = !defaultFound && (responseExample.is_default || index === 0);
    if (shouldBeDefault) {
      defaultFound = true;
    }

    return {
      ...responseExample,
      is_default: shouldBeDefault
    };
  });
}

function currentApiRoute(id) {
  return state.apiRoutes.find((route) => Number(route.id) === Number(id)) || null;
}

function currentWsEvent(id) {
  return state.wsEvents.find((event) => Number(event.id) === Number(id)) || null;
}

function apiResponseExampleByName(route, responseName) {
  return (
    route?.response_examples?.find(
      (responseExample) => String(responseExample.name).toLowerCase() === String(responseName).toLowerCase()
    ) || null
  );
}

function defaultApiResponse(route) {
  return route?.response_examples?.find((responseExample) => responseExample.is_default) || route?.response_examples?.[0] || null;
}

function setFeedback(message, type = "success") {
  if (!message) {
    elements.feedback.classList.add("hidden");
    return;
  }

  elements.feedback.textContent = message;
  elements.feedback.className =
    "mt-4 rounded-[1.35rem] border px-4 py-3 text-sm " +
    (type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700");
  elements.feedback.classList.remove("hidden");
}

function redirectToLogin(redirectTo = "/") {
  window.location.assign(redirectTo || "/");
  return new Promise(() => {});
}

function redirectIfSessionInvalid(response, data) {
  const shouldRedirect =
    (response.status === 401 || response.status === 403) &&
    data &&
    typeof data.redirectTo === "string" &&
    data.redirectTo.length > 0;

  if (!shouldRedirect) {
    return null;
  }

  return redirectToLogin(data.redirectTo);
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
    const redirectPromise = redirectIfSessionInvalid(response, data);
    if (redirectPromise) {
      return redirectPromise;
    }

    throw new Error(data.error || "Request failed.");
  }

  return data;
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

function icon(name) {
  const icons = {
    copy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    view:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    edit:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="m16.5 3.5 4 4L7 21l-4 1 1-4L16.5 3.5Z"></path></svg>',
    trash:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path><path d="m19 6-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>',
    plus:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>',
    bolt:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"></path></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 6-12 12"></path><path d="m6 6 12 12"></path></svg>'
  };

  return icons[name] || "";
}

function renderGuide() {
  elements.guideList.innerHTML = state.placeholderGuide
    .map(
      (item) => `
        <article class="editor-card p-5">
          <p class="text-xs uppercase tracking-[0.2em] text-ink/45">Pattern</p>
          <p class="mt-2 break-all font-mono text-sm font-semibold text-ink">${escapeHtml(item.token)}</p>

          <div class="mt-4 rounded-[1.25rem] border border-ink/10 bg-[#f7faf7] p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-ink/45">Meaning</p>
            <p class="mt-2 text-sm leading-6 text-ink/70">${escapeHtml(item.meaning)}</p>
          </div>

          <div class="mt-4 rounded-[1.25rem] border border-ink/10 bg-white p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-ink/45">Live preview</p>
            <pre class="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-ink/78">${escapeHtml(item.preview || "Rendered at request time")}</pre>
          </div>

          <div class="mt-4 rounded-[1.25rem] border border-ink/10 bg-white p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-ink/45">Example usage</p>
            <pre class="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-ink/78">${escapeHtml(item.example || item.token)}</pre>
          </div>
        </article>
      `
    )
    .join("");
}

function openGuideModal() {
  closeHeaderMenu();
  elements.guideModal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
}

function closeGuideModal() {
  elements.guideModal.classList.add("hidden");
  if (elements.entityModal.classList.contains("hidden")) {
    document.body.classList.remove("overflow-hidden");
  }
}

function isHeaderMenuOpen() {
  return !elements.headerMenuPanel.classList.contains("hidden");
}

function openHeaderMenu() {
  elements.headerMenuPanel.classList.remove("hidden");
  elements.headerMenuToggle.setAttribute("aria-expanded", "true");
}

function closeHeaderMenu() {
  elements.headerMenuPanel.classList.add("hidden");
  elements.headerMenuToggle.setAttribute("aria-expanded", "false");
}

function toggleHeaderMenu() {
  if (isHeaderMenuOpen()) {
    closeHeaderMenu();
    return;
  }

  openHeaderMenu();
}

function openEntityModal(kind, mode, id = null) {
  closeHeaderMenu();
  if (kind === "api") {
    const route = id ? currentApiRoute(id) : null;
    state.modal = {
      kind,
      mode,
      id: route?.id ?? null,
      draft: mode === "view" ? null : route ? hydrateApiDraft(route) : defaultApiDraft(),
      lastResult: ""
    };
  } else {
    const event = id ? currentWsEvent(id) : null;
    state.modal = {
      kind,
      mode,
      id: event?.id ?? null,
      draft: mode === "view" ? null : event ? hydrateWsDraft(event) : defaultWsDraft(),
      lastResult: ""
    };
  }

  renderEntityModal();
  elements.entityModal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
}

function closeEntityModal() {
  state.modal = null;
  elements.entityModal.classList.add("hidden");
  elements.entityModalPanel.innerHTML = "";

  if (elements.guideModal.classList.contains("hidden")) {
    document.body.classList.remove("overflow-hidden");
  }
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

function getFilteredItems() {
  const isApi = isApiTab();
  const items = isApi ? state.apiRoutes : state.wsEvents;
  const query = state.search.trim().toLowerCase();

  if (!query) {
    return items;
  }

  return items.filter((item) => {
    const haystack = isApi
      ? [
          item.method,
          item.path,
          item.notes,
          item.default_response_name,
          ...(item.response_examples || []).flatMap((responseExample) => [
            responseExample.name,
            responseExample.status_code,
            responseExample.content_type
          ])
        ]
      : [item.namespace, item.event_name, item.notes, item.payload_template];

    return haystack.join(" ").toLowerCase().includes(query);
  });
}

function renderToolbar() {
  const isApi = isApiTab();
  const allItems = isApi ? state.apiRoutes : state.wsEvents;
  const filteredItems = getFilteredItems();
  const itemLabel = isApi ? "API" : "WebSocket";
  const title = isApi ? "All mock API endpoints" : "All WebSocket events";
  const summary =
    filteredItems.length === allItems.length
      ? `${allItems.length} ${itemLabel.toLowerCase()} ${allItems.length === 1 ? "record" : "records"}`
      : `Showing ${filteredItems.length} of ${allItems.length} ${itemLabel.toLowerCase()} ${allItems.length === 1 ? "record" : "records"}`;

  elements.tabApis.classList.toggle("active", isApi);
  elements.tabWs.classList.toggle("active", !isApi);
  elements.createRecord.textContent = isApi ? "Create API" : "Create WebSocket";
  elements.recordsEyebrow.textContent = isApi ? "APIs" : "WebSocket";
  elements.recordsTitle.textContent = title;
  elements.recordsSummary.textContent = summary;
}

function statusBadge(isActive) {
  return isActive
    ? '<span class="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Active</span>'
    : '<span class="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Paused</span>';
}

function renderMetricTile(label, value, options = {}) {
  const valueClass = options.mono ? "font-mono text-sm leading-6" : "text-base font-semibold";
  return `
    <div class="metric-tile">
      <p class="text-xs uppercase tracking-[0.2em] text-ink/45">${escapeHtml(label)}</p>
      <p class="mt-3 ${valueClass} text-ink">${escapeHtml(value)}</p>
    </div>
  `;
}

function renderApiExampleChips(route) {
  const responseExamples = route.response_examples || [];
  const visibleExamples = responseExamples.slice(0, 4);
  const remainingCount = Math.max(responseExamples.length - visibleExamples.length, 0);

  return [
    ...visibleExamples.map(
      (responseExample) => `
        <span class="response-chip ${responseExample.is_default ? "default" : ""}">
          <span>${escapeHtml(responseExample.name)}</span>
          <span class="text-ink/45">${escapeHtml(responseExample.status_code)}</span>
        </span>
      `
    ),
    remainingCount > 0
      ? `<span class="response-chip">+${remainingCount} more</span>`
      : ""
  ].join("");
}

function renderApiCard(route) {
  const methodClasses = METHOD_PILL_CLASSES[route.method_color] || METHOD_PILL_CLASSES.slate;
  const fullUrl = route.url || buildApiUrl(route.path);
  const defaultResponse = defaultApiResponse(route);

  return `
    <article class="record-card">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ${methodClasses}">${escapeHtml(route.method)}</span>
            ${statusBadge(route.is_active)}
            <span class="response-chip">${escapeHtml(route.response_example_count || route.response_examples?.length || 1)} responses</span>
          </div>

          <button type="button" data-action="view-api" data-id="${route.id}" class="mt-4 block w-full text-left">
            <h3 class="font-mono text-lg font-semibold text-ink">${escapeHtml(route.path)}</h3>
            <p class="mt-2 break-all font-mono text-xs leading-6 text-ink/55">${escapeHtml(fullUrl)}</p>
          </button>

          <p class="mt-4 text-sm leading-6 text-ink/65">
            ${escapeHtml(
              route.notes || "Attach multiple named response examples so one endpoint can cover success, validation, and error cases."
            )}
          </p>
        </div>

        <button
          type="button"
          data-action="copy-api"
          data-id="${route.id}"
          class="action-icon"
          aria-label="Copy API endpoint details"
          title="Copy API endpoint details"
        >
          ${icon("copy")}
        </button>
      </div>

      <div class="mt-5 flex flex-wrap gap-2">
        ${renderApiExampleChips(route)}
      </div>

      <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        ${renderMetricTile("Requests", route.hit_count || 0)}
        ${renderMetricTile("Last request", route.last_hit_at ? formatDate(route.last_hit_at) : "No activity yet")}
        ${renderMetricTile(
          "Default response",
          defaultResponse ? `${defaultResponse.name} - ${defaultResponse.status_code}` : "Not configured"
        )}
      </div>

      <div class="mt-6 flex flex-col gap-3 border-t border-ink/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs leading-6 text-ink/45">Copy includes the cURL command plus every named response example for this endpoint.</p>

        <div class="flex items-center gap-2">
          <button
            type="button"
            data-action="view-api"
            data-id="${route.id}"
            class="action-icon"
            aria-label="View API"
            title="View API"
          >
            ${icon("view")}
          </button>
          <button
            type="button"
            data-action="edit-api"
            data-id="${route.id}"
            class="action-icon"
            aria-label="Edit API"
            title="Edit API"
          >
            ${icon("edit")}
          </button>
          <button
            type="button"
            data-action="delete-api"
            data-id="${route.id}"
            class="action-icon action-icon-danger"
            aria-label="Delete API"
            title="Delete API"
          >
            ${icon("trash")}
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderWsCard(event) {
  const fullNamespace = event.full_namespace || buildSocketNamespace(config.username, event.namespace);
  const socketUrl = buildSocketUrl(fullNamespace);

  return `
    <article class="record-card">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="response-chip">${escapeHtml(event.namespace || "/")}</span>
            ${statusBadge(event.is_active)}
          </div>

          <button type="button" data-action="view-ws" data-id="${event.id}" class="mt-4 block w-full text-left">
            <h3 class="font-mono text-lg font-semibold text-ink">${escapeHtml(event.event_name)}</h3>
            <p class="mt-2 break-all font-mono text-xs leading-6 text-ink/55">${escapeHtml(socketUrl)}</p>
          </button>

          <p class="mt-4 text-sm leading-6 text-ink/65">
            ${escapeHtml(
              event.notes || "Trigger this event from the dashboard and copy the namespace, event name, and payload example for your client."
            )}
          </p>
        </div>

        <button
          type="button"
          data-action="copy-ws"
          data-id="${event.id}"
          class="action-icon"
          aria-label="Copy WebSocket details"
          title="Copy WebSocket details"
        >
          ${icon("copy")}
        </button>
      </div>

      <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        ${renderMetricTile("Event", event.event_name, { mono: true })}
        ${renderMetricTile("Triggers", event.trigger_count || 0)}
        ${renderMetricTile("Last trigger", event.last_trigger_at ? formatDate(event.last_trigger_at) : "No activity yet")}
      </div>

      <div class="mt-6 flex flex-col gap-3 border-t border-ink/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          data-action="trigger-ws"
          data-id="${event.id}"
          class="${event.is_active ? "primary-button" : "secondary-button opacity-60"} inline-flex items-center gap-2"
          ${event.is_active ? "" : "disabled"}
        >
          ${icon("bolt")}
          <span>${event.is_active ? "Trigger" : "Paused"}</span>
        </button>

        <div class="flex items-center gap-2">
          <button
            type="button"
            data-action="view-ws"
            data-id="${event.id}"
            class="action-icon"
            aria-label="View WebSocket event"
            title="View WebSocket event"
          >
            ${icon("view")}
          </button>
          <button
            type="button"
            data-action="edit-ws"
            data-id="${event.id}"
            class="action-icon"
            aria-label="Edit WebSocket event"
            title="Edit WebSocket event"
          >
            ${icon("edit")}
          </button>
          <button
            type="button"
            data-action="delete-ws"
            data-id="${event.id}"
            class="action-icon action-icon-danger"
            aria-label="Delete WebSocket event"
            title="Delete WebSocket event"
          >
            ${icon("trash")}
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderEmptyState() {
  const isApi = isApiTab();
  const title = isApi ? "No API endpoints yet" : "No WebSocket events yet";
  const message = isApi
    ? "Create your first endpoint and add named response examples for success, error, and edge cases."
    : "Create your first Socket.IO event and trigger it directly from the dashboard.";

  return `
    <article class="empty-state xl:col-span-2">
      <div class="mx-auto max-w-xl text-center">
        <p class="text-xs uppercase tracking-[0.28em] text-ink/45">${isApi ? "APIs" : "WebSocket"}</p>
        <h3 class="mt-3 text-2xl font-semibold text-ink">${title}</h3>
        <p class="mt-3 text-sm leading-7 text-ink/62">${message}</p>
        <button type="button" id="empty-state-create" class="primary-button mt-6">${isApi ? "Create API" : "Create WebSocket"}</button>
      </div>
    </article>
  `;
}

function renderGrid() {
  const items = getFilteredItems();

  if (!items.length) {
    elements.recordsGrid.innerHTML = renderEmptyState();
    return;
  }

  elements.recordsGrid.innerHTML = items.map((item) => (isApiTab() ? renderApiCard(item) : renderWsCard(item))).join("");
}

function buildApiCurl(route, responseExample = null) {
  const fullUrl = route.url || buildApiUrl(route.path);
  const headerPart =
    responseExample && !responseExample.is_default
      ? ` -H "x-signaldock-example: ${escapeDoubleQuotes(responseExample.name)}"`
      : "";

  return `curl -X ${route.method} "${fullUrl}"${headerPart}`;
}

function buildApiPackageText(route) {
  const fullUrl = route.url || buildApiUrl(route.path);
  const responseExamples = route.response_examples || [];
  const lines = [
    "SignalDock API",
    `Endpoint: ${fullUrl}`,
    `Method: ${route.method}`,
    "",
    'Use header "x-signaldock-example" or query "?__example=Response Name" to force a named response.',
    "",
    "Response examples:"
  ];

  responseExamples.forEach((responseExample, index) => {
    lines.push(`${index + 1}. ${responseExample.name}${responseExample.is_default ? " (default)" : ""}`);
    lines.push(`Status: ${responseExample.status_code}`);
    lines.push(`Content-Type: ${responseExample.content_type}`);
    if (Number(responseExample.delay_ms) > 0) {
      lines.push(`Delay: ${responseExample.delay_ms}ms`);
    }
    lines.push(`cURL: ${buildApiCurl(route, responseExample)}`);
    const headersJson = String(responseExample.headers_json || "").trim();
    if (headersJson && headersJson !== "{}") {
      lines.push("Headers:");
      lines.push(headersJson);
    }
    lines.push("Body:");
    lines.push(renderTemplateForCopy(responseExample.response_body) || "(empty)");
    lines.push("");
  });

  return lines.join("\n").trim();
}

function buildWsPackageText(event) {
  const fullNamespace = event.full_namespace || buildSocketNamespace(config.username, event.namespace);
  const socketUrl = buildSocketUrl(fullNamespace);
  return [
    "SignalDock WebSocket",
    `Socket URL: ${socketUrl}`,
    `Namespace: ${fullNamespace}`,
    `Event: ${event.event_name}`,
    "",
    "Payload example:",
    renderTemplateForCopy(event.payload_template) || "(empty)",
    "",
    "Client snippet:",
    `const socket = io("${socketUrl}");`,
    `socket.on("${event.event_name}", (payload) => {`,
    "  console.log(payload);",
    "});"
  ].join("\n");
}

function compactButton(label, action, id, extra = "", attributes = "") {
  return `
    <button
      type="button"
      data-action="${action}"
      data-id="${id}"
      class="secondary-button px-3 py-2 text-xs font-semibold ${extra}"
      ${attributes}
    >
      ${label}
    </button>
  `;
}

function renderApiResponsePreview(route, responseExample) {
  const defaultBadge = responseExample.is_default
    ? '<span class="response-chip default">Default</span>'
    : "";
  const headersJson = String(responseExample.headers_json || "").trim();

  return `
    <article class="editor-card p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="response-chip">${escapeHtml(responseExample.name)}</span>
            <span class="response-chip">${escapeHtml(responseExample.status_code)}</span>
            <span class="response-chip">${escapeHtml(responseExample.content_type)}</span>
            ${defaultBadge}
            ${
              Number(responseExample.delay_ms) > 0
                ? `<span class="response-chip">${escapeHtml(responseExample.delay_ms)}ms delay</span>`
                : ""
            }
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          ${compactButton(
            "Copy cURL",
            "copy-api-example-curl",
            route.id,
            "",
            `data-example-name="${escapeHtml(responseExample.name)}"`
          )}
          <button
            type="button"
            data-action="copy-api-example-body"
            data-id="${route.id}"
            data-example-name="${escapeHtml(responseExample.name)}"
            class="secondary-button px-3 py-2 text-xs font-semibold"
          >
            Copy body
          </button>
        </div>
      </div>

      ${
        headersJson && headersJson !== "{}"
          ? `
            <div class="mt-4 rounded-[1.25rem] border border-ink/10 bg-[#f7faf7] p-4">
              <p class="text-xs uppercase tracking-[0.2em] text-ink/45">Headers</p>
              <pre class="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-ink/78">${escapeHtml(headersJson)}</pre>
            </div>
          `
          : ""
      }

      <div class="mt-4 rounded-[1.35rem] bg-ink px-4 py-4">
        <p class="text-xs uppercase tracking-[0.2em] text-white/55">Body</p>
        <pre class="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-6 text-white">${escapeHtml(responseExample.response_body)}</pre>
      </div>
    </article>
  `;
}

function renderApiViewModal(route) {
  const fullUrl = route.url || buildApiUrl(route.path);
  const defaultResponse = defaultApiResponse(route);

  return `
    <div class="flex max-h-[94vh] flex-col">
      <div class="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-5 sm:px-6">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="response-chip default">${escapeHtml(route.method)}</span>
            ${statusBadge(route.is_active)}
          </div>
          <h2 class="mt-3 font-mono text-xl font-semibold text-ink sm:text-2xl">${escapeHtml(route.path)}</h2>
          <p class="mt-2 text-sm text-ink/62">${escapeHtml(route.notes || "Mock API endpoint with named response examples.")}</p>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" data-action="edit-api" data-id="${route.id}" class="secondary-button">
            Edit
          </button>
          <button type="button" data-action="close-modal" class="action-icon" aria-label="Close modal">
            ${icon("close")}
          </button>
        </div>
      </div>

      <div class="overflow-y-auto px-5 py-5 sm:px-6">
        <div class="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_320px]">
          <div class="space-y-5">
            <section class="editor-card p-5">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Endpoint</p>
                  <p class="mt-3 break-all font-mono text-sm leading-6 text-ink">${escapeHtml(fullUrl)}</p>
                  <p class="mt-4 text-sm leading-7 text-ink/65">
                    Use header <span class="font-mono text-xs">x-signaldock-example</span> or query
                    <span class="font-mono text-xs">?__example=Response Name</span> to force any named response example for this endpoint.
                  </p>
                </div>

                <button type="button" data-action="copy-api" data-id="${route.id}" class="primary-button">
                  Copy package
                </button>
              </div>
            </section>

            <section class="space-y-4">
              ${(route.response_examples || []).map((responseExample) => renderApiResponsePreview(route, responseExample)).join("")}
            </section>
          </div>

          <aside class="space-y-5">
            <section class="editor-card p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Analytics</p>
              <div class="mt-4 space-y-3">
                ${renderMetricTile("Total requests", route.hit_count || 0)}
                ${renderMetricTile("Last request", route.last_hit_at ? formatDate(route.last_hit_at) : "No activity yet")}
                ${renderMetricTile(
                  "Default response",
                  defaultResponse ? `${defaultResponse.name} - ${defaultResponse.status_code}` : "Not configured"
                )}
              </div>
            </section>

            <section class="editor-card p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Response count</p>
              <p class="mt-4 text-4xl font-bold text-ink">${escapeHtml(route.response_examples?.length || 0)}</p>
              <p class="mt-3 text-sm leading-6 text-ink/62">Create as many named examples as your testing flow needs, each with its own status code and headers.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  `;
}

function renderApiResponseEditor(responseExample, index, totalResponses) {
  return `
    <article class="editor-card p-5" data-api-response-editor data-example-id="${responseExample.client_id}">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex items-start gap-4">
          <div class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accentSoft text-sm font-semibold text-accent">
            ${index + 1}
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <label class="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink/70">
            <input type="radio" name="api-default-response" value="${responseExample.client_id}" ${responseExample.is_default ? "checked" : ""} />
            <span>Default</span>
          </label>

          <button
            type="button"
            data-action="remove-api-response"
            data-example-id="${responseExample.client_id}"
            class="action-icon action-icon-danger ${totalResponses === 1 ? "opacity-40" : ""}"
            aria-label="Remove response example"
            title="Remove response example"
            ${totalResponses === 1 ? "disabled" : ""}
          >
            ${icon("trash")}
          </button>
        </div>
      </div>

      <div class="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px_160px]">
        <label class="space-y-2">
          <span class="text-sm font-medium text-ink/80">Example name</span>
          <input data-field="name" value="${escapeHtml(responseExample.name)}" class="input-shell w-full" placeholder="Success" />
        </label>

        <label class="space-y-2">
          <span class="text-sm font-medium text-ink/80">Status code</span>
          <input
            data-field="status_code"
            type="number"
            min="100"
            max="599"
            value="${escapeHtml(responseExample.status_code)}"
            class="input-shell w-full"
          />
        </label>

        <label class="space-y-2">
          <span class="text-sm font-medium text-ink/80">Delay (ms)</span>
          <input
            data-field="delay_ms"
            type="number"
            min="0"
            max="30000"
            value="${escapeHtml(responseExample.delay_ms)}"
            class="input-shell w-full"
          />
        </label>
      </div>

      <label class="mt-4 block space-y-2">
        <span class="text-sm font-medium text-ink/80">Content type</span>
        <input
          data-field="content_type"
          value="${escapeHtml(responseExample.content_type)}"
          class="input-shell w-full"
          placeholder="application/json"
        />
      </label>

      <div class="mt-4 grid gap-4 xl:grid-cols-2">
        <label class="space-y-2">
          <span class="text-sm font-medium text-ink/80">Headers JSON</span>
          <textarea
            data-field="headers_json"
            class="textarea-shell min-h-[150px] w-full"
            placeholder='{"Cache-Control":"no-store"}'
          >${escapeHtml(responseExample.headers_json)}</textarea>
        </label>

        <label class="space-y-2">
          <span class="text-sm font-medium text-ink/80">Response body</span>
          <textarea
            data-field="response_body"
            class="textarea-shell min-h-[150px] w-full"
            placeholder='{"message":"Success"}'
          >${escapeHtml(responseExample.response_body)}</textarea>
        </label>
      </div>
    </article>
  `;
}

function renderApiFormModal(draft, mode) {
  const fullUrl = draft.url || buildApiUrl(draft.path);
  const title = mode === "create" ? "Create API endpoint" : "Edit API endpoint";

  return `
    <form id="entity-form" data-kind="api" class="flex max-h-[94vh] flex-col">
      <div class="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-5 sm:px-6">
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-ink/45">REST endpoint</p>
          <h2 class="mt-3 text-2xl font-semibold text-ink">${title}</h2>
          <p class="mt-2 text-sm leading-6 text-ink/62">One API route can now hold multiple named response examples for testing success and error flows.</p>
        </div>

        <div class="flex items-center gap-2">
          ${
            draft.id
              ? `<button type="button" data-action="view-api" data-id="${draft.id}" class="secondary-button">View</button>`
              : ""
          }
          <button type="button" data-action="close-modal" class="action-icon" aria-label="Close modal">
            ${icon("close")}
          </button>
        </div>
      </div>

      <div class="overflow-y-auto px-5 py-5 sm:px-6">
        <div class="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_320px]">
          <div class="space-y-5">
            <section class="editor-card p-5">
              <div class="grid gap-4 lg:grid-cols-[140px_minmax(0,1fr)]">
                <label class="space-y-2">
                  <span class="text-sm font-medium text-ink/80">Method</span>
                  <select id="modal-api-method" class="input-shell w-full">
                    ${["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]
                      .map(
                        (method) =>
                          `<option value="${method}" ${draft.method === method ? "selected" : ""}>${method}</option>`
                      )
                      .join("")}
                  </select>
                </label>

                <label class="space-y-2">
                  <span class="text-sm font-medium text-ink/80">Path</span>
                  <input id="modal-api-path" value="${escapeHtml(draft.path)}" class="input-shell w-full font-mono" placeholder="/orders/:orderId" />
                </label>
              </div>

              <label class="mt-4 block space-y-2">
                <span class="text-sm font-medium text-ink/80">Notes</span>
                <input
                  id="modal-api-notes"
                  value="${escapeHtml(draft.notes || "")}"
                  class="input-shell w-full"
                  placeholder="Optional label for your teammates"
                />
              </label>

              <label class="mt-4 flex items-center gap-3 rounded-[1.25rem] border border-ink/10 bg-[#f7faf7] px-4 py-3">
                <input id="modal-api-active" type="checkbox" class="h-5 w-5 rounded border-ink/20 text-accent focus:ring-accent" ${draft.is_active ? "checked" : ""} />
                <span class="text-sm font-medium text-ink/80">Route is active</span>
              </label>
            </section>

            <section class="editor-card p-5">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Response examples</p>
                  <h3 class="mt-2 text-xl font-semibold text-ink">Named mock responses</h3>
                  <p class="mt-2 text-sm leading-6 text-ink/62">Each response can use its own name, status code, headers, delay, and body.</p>
                </div>

                <button type="button" data-action="add-api-response" class="primary-button">
                  ${icon("plus")}
                </button>
              </div>

              <div class="mt-4 space-y-4">
                ${draft.response_examples.map((responseExample, index) => renderApiResponseEditor(responseExample, index, draft.response_examples.length)).join("")}
              </div>
            </section>
          </div>

          <aside class="space-y-5">
            <section class="editor-card p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Full endpoint URL</p>
              <p class="mt-4 break-all font-mono text-sm leading-6 text-ink">${escapeHtml(fullUrl)}</p>
              <button type="button" data-action="copy-workspace-base" class="secondary-button mt-4 w-full justify-center">
                Copy base URL
              </button>
            </section>

            <section class="editor-card p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Route analytics</p>
              <div class="mt-4 space-y-3">
                ${renderMetricTile("Total requests", draft.hit_count || 0)}
                ${renderMetricTile("Last request", draft.last_hit_at ? formatDate(draft.last_hit_at) : "No activity yet")}
                ${renderMetricTile("Response examples", draft.response_examples.length)}
              </div>
            </section>

            <section class="editor-card p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Selector help</p>
              <p class="mt-4 text-sm leading-7 text-ink/65">
                After saving, force a specific response example with
                <span class="font-mono text-xs">x-signaldock-example</span> or
                <span class="font-mono text-xs">?__example=Response Name</span>.
              </p>
            </section>
          </aside>
        </div>
      </div>

      <div class="flex flex-col gap-3 border-t border-ink/10 px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
        <button type="button" data-action="close-modal" class="secondary-button justify-center">
          Cancel
        </button>

        <button type="submit" class="primary-button justify-center">
          Save API
        </button>
      </div>
    </form>
  `;
}

function renderWsViewModal(event, lastResult = "") {
  const fullNamespace = event.full_namespace || buildSocketNamespace(config.username, event.namespace);
  const socketUrl = buildSocketUrl(fullNamespace);

  return `
    <div class="flex max-h-[94vh] flex-col">
      <div class="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-5 sm:px-6">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="response-chip default">${escapeHtml(event.namespace || "/")}</span>
            ${statusBadge(event.is_active)}
          </div>
          <h2 class="mt-3 font-mono text-xl font-semibold text-ink sm:text-2xl">${escapeHtml(event.event_name)}</h2>
          <p class="mt-2 text-sm text-ink/62">${escapeHtml(event.notes || "Socket.IO event ready for manual dashboard triggers.")}</p>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" data-action="edit-ws" data-id="${event.id}" class="secondary-button">
            Edit
          </button>
          <button type="button" data-action="close-modal" class="action-icon" aria-label="Close modal">
            ${icon("close")}
          </button>
        </div>
      </div>

      <div class="overflow-y-auto px-5 py-5 sm:px-6">
        <div class="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_320px]">
          <div class="space-y-5">
            <section class="editor-card p-5">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Socket URL</p>
                  <p class="mt-3 break-all font-mono text-sm leading-6 text-ink">${escapeHtml(socketUrl)}</p>
                  <p class="mt-2 break-all font-mono text-xs leading-6 text-ink/55">Namespace: ${escapeHtml(fullNamespace)}</p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <button type="button" data-action="copy-ws" data-id="${event.id}" class="secondary-button">
                    Copy package
                  </button>
                  <button
                    type="button"
                    data-action="trigger-ws"
                    data-id="${event.id}"
                    class="${event.is_active ? "primary-button" : "secondary-button opacity-60"}"
                    ${event.is_active ? "" : "disabled"}
                  >
                    Trigger
                  </button>
                </div>
              </div>
            </section>

            <section class="editor-card p-5">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Payload example</p>
                  <h3 class="mt-2 text-xl font-semibold text-ink">Event payload</h3>
                </div>
                <button type="button" data-action="copy-ws-payload" data-id="${event.id}" class="secondary-button">
                  Copy payload
                </button>
              </div>

              <div class="mt-4 rounded-[1.35rem] bg-ink px-4 py-4">
                <pre class="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-6 text-white">${escapeHtml(event.payload_template)}</pre>
              </div>
            </section>

            ${
              lastResult
                ? `
                  <section class="editor-card p-5">
                    <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Last trigger result</p>
                    <pre class="mt-4 overflow-x-auto whitespace-pre-wrap rounded-[1.35rem] bg-[#f7faf7] px-4 py-4 font-mono text-xs leading-6 text-ink/78">${escapeHtml(lastResult)}</pre>
                  </section>
                `
                : ""
            }
          </div>

          <aside class="space-y-5">
            <section class="editor-card p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Analytics</p>
              <div class="mt-4 space-y-3">
                ${renderMetricTile("Total triggers", event.trigger_count || 0)}
                ${renderMetricTile("Last trigger", event.last_trigger_at ? formatDate(event.last_trigger_at) : "No activity yet")}
                ${renderMetricTile("Namespace", event.namespace || "/", { mono: true })}
              </div>
            </section>

            <section class="editor-card p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Client reminder</p>
              <p class="mt-4 text-sm leading-7 text-ink/65">
                Connect with Socket.IO to the namespace shown here, then listen for the event name exactly as configured.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  `;
}

function renderWsFormModal(draft, mode) {
  const fullNamespace = draft.full_namespace || buildSocketNamespace(config.username, draft.namespace);
  const title = mode === "create" ? "Create WebSocket event" : "Edit WebSocket event";

  return `
    <form id="entity-form" data-kind="ws" class="flex max-h-[94vh] flex-col">
      <div class="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-5 sm:px-6">
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Realtime event</p>
          <h2 class="mt-3 text-2xl font-semibold text-ink">${title}</h2>
          <p class="mt-2 text-sm leading-6 text-ink/62">Configure the namespace, event name, payload example, and manual trigger flow.</p>
        </div>

        <div class="flex items-center gap-2">
          ${
            draft.id
              ? `<button type="button" data-action="view-ws" data-id="${draft.id}" class="secondary-button">View</button>`
              : ""
          }
          <button type="button" data-action="close-modal" class="action-icon" aria-label="Close modal">
            ${icon("close")}
          </button>
        </div>
      </div>

      <div class="overflow-y-auto px-5 py-5 sm:px-6">
        <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div class="space-y-5">
            <section class="editor-card p-5">
              <label class="space-y-2">
                <span class="text-sm font-medium text-ink/80">Namespace</span>
                <input id="modal-ws-namespace" value="${escapeHtml(draft.namespace || "")}" class="input-shell w-full font-mono" placeholder="/orders" />
              </label>

              <label class="mt-4 block space-y-2">
                <span class="text-sm font-medium text-ink/80">Event name</span>
                <input id="modal-ws-event-name" value="${escapeHtml(draft.event_name)}" class="input-shell w-full font-mono" placeholder="order.created" />
              </label>

              <label class="mt-4 block space-y-2">
                <span class="text-sm font-medium text-ink/80">Notes</span>
                <input id="modal-ws-notes" value="${escapeHtml(draft.notes || "")}" class="input-shell w-full" placeholder="Optional event purpose" />
              </label>

              <label class="mt-4 flex items-center gap-3 rounded-[1.25rem] border border-ink/10 bg-[#f7faf7] px-4 py-3">
                <input id="modal-ws-active" type="checkbox" class="h-5 w-5 rounded border-ink/20 text-accent focus:ring-accent" ${draft.is_active ? "checked" : ""} />
                <span class="text-sm font-medium text-ink/80">Event is active</span>
              </label>
            </section>

            <section class="editor-card p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Payload example</p>
              <h3 class="mt-2 text-xl font-semibold text-ink">Event payload</h3>
              <textarea id="modal-ws-payload" class="textarea-shell mt-4 min-h-[260px] w-full" placeholder='{"id":"[[UUID]]"}'>${escapeHtml(draft.payload_template)}</textarea>
            </section>
          </div>

          <aside class="space-y-5">
            <section class="editor-card p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Socket URL</p>
              <p class="mt-4 break-all font-mono text-sm leading-6 text-ink">${escapeHtml(buildSocketUrl(fullNamespace))}</p>
              <p class="mt-3 break-all font-mono text-xs leading-6 text-ink/55">Namespace: ${escapeHtml(fullNamespace)}</p>
            </section>

            <section class="editor-card p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Event analytics</p>
              <div class="mt-4 space-y-3">
                ${renderMetricTile("Total triggers", draft.trigger_count || 0)}
                ${renderMetricTile("Last trigger", draft.last_trigger_at ? formatDate(draft.last_trigger_at) : "No activity yet")}
              </div>
            </section>

            <section class="editor-card p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-ink/45">Triggering</p>
              <p class="mt-4 text-sm leading-7 text-ink/65">After saving, you can trigger this event directly from the card list or the view modal.</p>
            </section>
          </aside>
        </div>
      </div>

      <div class="flex flex-col gap-3 border-t border-ink/10 px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
        <button type="button" data-action="close-modal" class="secondary-button justify-center">
          Cancel
        </button>

        <button type="submit" class="primary-button justify-center">
          Save WebSocket
        </button>
      </div>
    </form>
  `;
}

function renderEntityModal() {
  if (!state.modal) {
    elements.entityModalPanel.innerHTML = "";
    return;
  }

  const { kind, mode, id, draft, lastResult } = state.modal;

  if (kind === "api" && mode === "view") {
    const route = currentApiRoute(id);
    if (!route) {
      closeEntityModal();
      return;
    }

    elements.entityModalPanel.innerHTML = renderApiViewModal(route);
    return;
  }

  if (kind === "ws" && mode === "view") {
    const event = currentWsEvent(id);
    if (!event) {
      closeEntityModal();
      return;
    }

    elements.entityModalPanel.innerHTML = renderWsViewModal(event, lastResult);
    return;
  }

  if (kind === "api") {
    elements.entityModalPanel.innerHTML = renderApiFormModal(draft, mode);
    return;
  }

  elements.entityModalPanel.innerHTML = renderWsFormModal(draft, mode);
}

function syncModalDraftFromDom() {
  if (!state.modal || state.modal.mode === "view") {
    return;
  }

  const form = document.getElementById("entity-form");
  if (!form) {
    return;
  }

  if (state.modal.kind === "api") {
    const path = normalizePath(document.getElementById("modal-api-path")?.value || "/");
    const selectedDefaultId = form.querySelector('input[name="api-default-response"]:checked')?.value || "";
    const responseExamples = [...form.querySelectorAll("[data-api-response-editor]")].map((editorNode, index) => ({
      client_id: editorNode.dataset.exampleId || createClientId(),
      name: editorNode.querySelector('[data-field="name"]')?.value?.trim() || `Response ${index + 1}`,
      status_code: Number(editorNode.querySelector('[data-field="status_code"]')?.value || 200),
      content_type: editorNode.querySelector('[data-field="content_type"]')?.value?.trim() || "application/json",
      response_body: editorNode.querySelector('[data-field="response_body"]')?.value || "",
      headers_json: editorNode.querySelector('[data-field="headers_json"]')?.value || "{}",
      delay_ms: Number(editorNode.querySelector('[data-field="delay_ms"]')?.value || 0),
      is_default: selectedDefaultId ? selectedDefaultId === editorNode.dataset.exampleId : index === 0
    }));

    state.modal.draft = {
      ...state.modal.draft,
      method: document.getElementById("modal-api-method")?.value || "GET",
      path,
      notes: document.getElementById("modal-api-notes")?.value || "",
      is_active: Boolean(document.getElementById("modal-api-active")?.checked),
      url: buildApiUrl(path),
      response_examples: responseExamples
    };
    ensureDraftDefaultResponse(state.modal.draft);
    return;
  }

  const namespace = normalizeNamespace(document.getElementById("modal-ws-namespace")?.value || "");
  state.modal.draft = {
    ...state.modal.draft,
    namespace,
    event_name: document.getElementById("modal-ws-event-name")?.value || "",
    payload_template: document.getElementById("modal-ws-payload")?.value || "",
    notes: document.getElementById("modal-ws-notes")?.value || "",
    is_active: Boolean(document.getElementById("modal-ws-active")?.checked),
    full_namespace: buildSocketNamespace(config.username, namespace)
  };
}

function validateApiDraft(draft) {
  if (!draft.path) {
    return "API path is required.";
  }

  if (!Array.isArray(draft.response_examples) || !draft.response_examples.length) {
    return "Add at least one response example.";
  }

  if (draft.response_examples.length > 12) {
    return "You can add up to 12 response examples per API.";
  }

  const seenNames = new Set();
  for (const responseExample of draft.response_examples) {
    if (!responseExample.name.trim()) {
      return "Each response example needs a name.";
    }

    const nameKey = responseExample.name.trim().toLowerCase();
    if (seenNames.has(nameKey)) {
      return "Response example names must be unique.";
    }
    seenNames.add(nameKey);

    if (!Number.isInteger(Number(responseExample.status_code)) || Number(responseExample.status_code) < 100 || Number(responseExample.status_code) > 599) {
      return `Status code for "${responseExample.name}" must be between 100 and 599.`;
    }

    if (!String(responseExample.content_type || "").trim()) {
      return `Content type for "${responseExample.name}" is required.`;
    }

    if (!String(responseExample.response_body || "").trim()) {
      return `Response body for "${responseExample.name}" is required.`;
    }
  }

  return "";
}

function validateWsDraft(draft) {
  if (!draft.event_name.trim()) {
    return "Event name is required.";
  }

  if (!draft.payload_template.trim()) {
    return "Payload template is required.";
  }

  return "";
}

async function saveCurrentApi() {
  syncModalDraftFromDom();
  const draft = state.modal?.draft;
  if (!draft) {
    return;
  }

  const validationError = validateApiDraft(draft);
  if (validationError) {
    setFeedback(validationError, "error");
    return;
  }

  const payload = {
    method: draft.method,
    path: draft.path,
    responses: draft.response_examples.map((responseExample) => ({
      name: responseExample.name.trim(),
      statusCode: Number(responseExample.status_code),
      contentType: responseExample.content_type.trim(),
      responseBody: responseExample.response_body,
      headersJson: responseExample.headers_json,
      delayMs: Number(responseExample.delay_ms || 0),
      isDefault: Boolean(responseExample.is_default)
    })),
    isActive: Boolean(draft.is_active),
    notes: draft.notes || ""
  };

  if (draft.id) {
    await apiFetch(`/dashboard/apis/${draft.id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    setFeedback("API endpoint updated.");
  } else {
    await apiFetch("/dashboard/apis", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setFeedback("API endpoint created.");
  }

  closeEntityModal();
  await loadBootstrap();
}

async function saveCurrentWs() {
  syncModalDraftFromDom();
  const draft = state.modal?.draft;
  if (!draft) {
    return;
  }

  const validationError = validateWsDraft(draft);
  if (validationError) {
    setFeedback(validationError, "error");
    return;
  }

  const payload = {
    namespace: draft.namespace,
    eventName: draft.event_name.trim(),
    payloadTemplate: draft.payload_template,
    isActive: Boolean(draft.is_active),
    notes: draft.notes || ""
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

  closeEntityModal();
  await loadBootstrap();
}

async function deleteApiRoute(id) {
  const route = currentApiRoute(id);
  if (!route) {
    return;
  }

  if (!window.confirm(`Delete API route ${route.method} ${route.path}?`)) {
    return;
  }

  await apiFetch(`/dashboard/apis/${route.id}`, {
    method: "DELETE",
    body: JSON.stringify({})
  });

  if (state.modal?.kind === "api" && Number(state.modal.id) === Number(route.id)) {
    closeEntityModal();
  }

  setFeedback("API endpoint deleted.");
  await loadBootstrap();
}

async function deleteWsEvent(id) {
  const event = currentWsEvent(id);
  if (!event) {
    return;
  }

  if (!window.confirm(`Delete WebSocket event ${event.event_name}?`)) {
    return;
  }

  await apiFetch(`/dashboard/ws-events/${event.id}`, {
    method: "DELETE",
    body: JSON.stringify({})
  });

  if (state.modal?.kind === "ws" && Number(state.modal.id) === Number(event.id)) {
    closeEntityModal();
  }

  setFeedback("WebSocket event deleted.");
  await loadBootstrap();
}

async function triggerWsEvent(id) {
  const event = currentWsEvent(id);
  if (!event) {
    return;
  }

  const result = await apiFetch(`/dashboard/ws-events/${event.id}/trigger`, {
    method: "POST",
    body: JSON.stringify({})
  });

  const deliveryCount = Number(result.deliveryCount || 0);
  setFeedback(`Event triggered. Delivered to ${deliveryCount} ${deliveryCount === 1 ? "client" : "clients"}.`);

  if (state.modal?.kind === "ws" && Number(state.modal.id) === Number(event.id)) {
    state.modal.lastResult = JSON.stringify(result, null, 2);
  }

  await loadBootstrap();
}

async function logout() {
  const result = await apiFetch("/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  });

  window.location.assign(result.redirectTo || "/");
}

function copyApiPackage(id) {
  const route = currentApiRoute(id);
  if (!route) {
    return;
  }

  copyText(buildApiPackageText(route), "API package copied.");
}

function copyWsPackage(id) {
  const event = currentWsEvent(id);
  if (!event) {
    return;
  }

  copyText(buildWsPackageText(event), "WebSocket package copied.");
}

function copyApiExampleCurl(id, responseName) {
  const route = currentApiRoute(id);
  if (!route) {
    return;
  }

  const responseExample = apiResponseExampleByName(route, responseName);
  if (!responseExample) {
    setFeedback("Response example not found.", "error");
    return;
  }

  copyText(buildApiCurl(route, responseExample), "Example cURL copied.");
}

function copyApiExampleBody(id, responseName) {
  const route = currentApiRoute(id);
  if (!route) {
    return;
  }

  const responseExample = apiResponseExampleByName(route, responseName);
  if (!responseExample) {
    setFeedback("Response example not found.", "error");
    return;
  }

  copyText(renderTemplateForCopy(responseExample.response_body), "Response body copied.");
}

function copyWsPayload(id) {
  const event = currentWsEvent(id);
  if (!event) {
    return;
  }

  copyText(renderTemplateForCopy(event.payload_template), "WebSocket payload copied.");
}

function addApiResponseExample() {
  syncModalDraftFromDom();
  const draft = state.modal?.draft;
  if (!draft) {
    return;
  }

  if (draft.response_examples.length >= 12) {
    setFeedback("You can add up to 12 response examples per API.", "error");
    return;
  }

  const nextIndex = draft.response_examples.length;
  draft.response_examples.push(createApiResponseExample({ is_default: false }, nextIndex));
  ensureDraftDefaultResponse(draft);
  renderEntityModal();
}

function removeApiResponseExample(exampleId) {
  syncModalDraftFromDom();
  const draft = state.modal?.draft;
  if (!draft || draft.response_examples.length <= 1) {
    return;
  }

  draft.response_examples = draft.response_examples.filter(
    (responseExample) => responseExample.client_id !== exampleId
  );
  ensureDraftDefaultResponse(draft);
  renderEntityModal();
}

function handleAction(button) {
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const id = Number(button.dataset.id || 0);
  const exampleName = button.dataset.exampleName || "";
  const exampleId = button.dataset.exampleId || "";

  switch (action) {
    case "close-modal":
      closeEntityModal();
      break;
    case "view-api":
      openEntityModal("api", "view", id);
      break;
    case "edit-api":
      openEntityModal("api", "edit", id);
      break;
    case "delete-api":
      deleteApiRoute(id).catch((error) => setFeedback(error.message, "error"));
      break;
    case "copy-api":
      copyApiPackage(id);
      break;
    case "copy-api-example-curl":
      copyApiExampleCurl(id, exampleName);
      break;
    case "copy-api-example-body":
      copyApiExampleBody(id, exampleName);
      break;
    case "add-api-response":
      addApiResponseExample();
      break;
    case "remove-api-response":
      removeApiResponseExample(exampleId);
      break;
    case "view-ws":
      openEntityModal("ws", "view", id);
      break;
    case "edit-ws":
      openEntityModal("ws", "edit", id);
      break;
    case "delete-ws":
      deleteWsEvent(id).catch((error) => setFeedback(error.message, "error"));
      break;
    case "copy-ws":
      copyWsPackage(id);
      break;
    case "copy-ws-payload":
      copyWsPayload(id);
      break;
    case "trigger-ws":
      triggerWsEvent(id).catch((error) => setFeedback(error.message, "error"));
      break;
    case "copy-workspace-base":
      copyText(config.workspaceUrl, "Base URL copied.");
      break;
    default:
      break;
  }
}

function render() {
  renderStats();
  renderToolbar();
  renderGrid();
  renderEntityModal();
}

async function loadBootstrap() {
  const response = await fetch("/dashboard/bootstrap", {
    headers: {
      Accept: "application/json"
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const redirectPromise = redirectIfSessionInvalid(response, data);
    if (redirectPromise) {
      return redirectPromise;
    }

    throw new Error(data.error || "Unable to load dashboard data.");
  }
  state.apiRoutes = data.apiRoutes;
  state.wsEvents = data.wsEvents;
  state.placeholderGuide = data.placeholderGuide;
  state.stats = data.stats;
  config.csrfToken = data.csrfToken;

  if (state.modal?.mode === "view") {
    if (state.modal.kind === "api" && !currentApiRoute(state.modal.id)) {
      closeEntityModal();
    }
    if (state.modal.kind === "ws" && !currentWsEvent(state.modal.id)) {
      closeEntityModal();
    }
  }

  renderGuide();
  render();
}

function bindEvents() {
  elements.headerMenuToggle.addEventListener("click", () => {
    toggleHeaderMenu();
  });

  elements.recordSearch.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });

  elements.tabApis.addEventListener("click", () => {
    state.activeTab = "apis";
    render();
  });

  elements.tabWs.addEventListener("click", () => {
    state.activeTab = "ws";
    render();
  });

  elements.createRecord.addEventListener("click", () => {
    openEntityModal(isApiTab() ? "api" : "ws", "create");
  });

  elements.copyWorkspaceBase.addEventListener("click", () => {
    closeHeaderMenu();
    copyText(config.workspaceUrl, "Base URL copied.");
  });

  elements.toggleGuide.addEventListener("click", () => {
    closeHeaderMenu();
    openGuideModal();
  });

  elements.closeGuide.addEventListener("click", () => {
    closeGuideModal();
  });

  elements.guideBackdrop.addEventListener("click", () => {
    closeGuideModal();
  });

  elements.logoutButton.addEventListener("click", () => {
    closeHeaderMenu();
    logout().catch((error) => setFeedback(error.message, "error"));
  });

  elements.recordsGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button) {
      handleAction(button);
      return;
    }

    if (event.target.id === "empty-state-create") {
      openEntityModal(isApiTab() ? "api" : "ws", "create");
    }
  });

  elements.entityModalPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button) {
      handleAction(button);
    }
  });

  elements.entityModalBackdrop.addEventListener("click", () => {
    closeEntityModal();
  });

  elements.entityModalPanel.addEventListener("submit", (event) => {
    const form = event.target.closest("#entity-form");
    if (!form) {
      return;
    }

    event.preventDefault();

    if (form.dataset.kind === "api") {
      saveCurrentApi().catch((error) => setFeedback(error.message, "error"));
      return;
    }

    saveCurrentWs().catch((error) => setFeedback(error.message, "error"));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (isHeaderMenuOpen()) {
      closeHeaderMenu();
      return;
    }

    if (!elements.entityModal.classList.contains("hidden")) {
      closeEntityModal();
      return;
    }

    if (!elements.guideModal.classList.contains("hidden")) {
      closeGuideModal();
    }
  });

  document.addEventListener("click", (event) => {
    if (!isHeaderMenuOpen()) {
      return;
    }

    if (event.target.closest("#header-menu-shell")) {
      return;
    }

    closeHeaderMenu();
  });
}

async function init() {
  bindEvents();
  await loadBootstrap();
}

init().catch((error) => setFeedback(error.message, "error"));
