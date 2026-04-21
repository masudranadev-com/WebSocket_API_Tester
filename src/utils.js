export const RESERVED_USERNAMES = new Set([
  "auth",
  "dashboard",
  "socket.io",
  "public",
  "static",
  "assets",
  "api",
  "favicon.ico"
]);

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

function clampInteger(value, minimum, maximum, fallback) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue)) {
    return fallback;
  }

  return Math.min(Math.max(numericValue, minimum), maximum);
}

export function normalizeUsername(value) {
  return String(value ?? "")
    .trim();
}

export function isValidUsername(value) {
  return value.length > 0 && !value.includes("/") && !RESERVED_USERNAMES.has(value.toLowerCase());
}

export function normalizeRoutePath(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "/") {
    return "/";
  }

  const withoutQuery = raw.split("?")[0];
  const collapsed = withoutQuery.replace(/\/+/g, "/");
  const prefixed = collapsed.startsWith("/") ? collapsed : `/${collapsed}`;
  const cleaned = prefixed.length > 1 ? prefixed.replace(/\/$/, "") : prefixed;
  return cleaned || "/";
}

export function normalizeNamespace(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const collapsed = raw.replace(/\/+/g, "/");
  const prefixed = collapsed.startsWith("/") ? collapsed : `/${collapsed}`;
  return prefixed.length > 1 ? prefixed.replace(/\/$/, "") : "";
}

export function isValidNamespace(value) {
  if (!value) {
    return true;
  }

  return /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i.test(value);
}

export function buildWorkspaceUrl(req, username) {
  return `${req.protocol}://${req.get("host")}/${encodeURIComponent(String(username ?? ""))}`;
}

export function buildPublicApiUrl(req, username, routePath) {
  const normalizedPath = normalizeRoutePath(routePath);
  return `${buildWorkspaceUrl(req, username)}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function buildSocketNamespace(username, namespace = "") {
  return `/${encodeURIComponent(String(username ?? ""))}${normalizeNamespace(namespace)}`;
}

export function methodColor(method) {
  return {
    GET: "emerald",
    POST: "sky",
    PUT: "amber",
    PATCH: "violet",
    DELETE: "rose",
    OPTIONS: "slate",
    HEAD: "cyan"
  }[method] ?? "slate";
}

export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function normalizeApiResponseExampleName(value) {
  return String(value ?? "").trim();
}

export function normalizeApiResponseExample(example = {}, options = {}) {
  const fallbackName = options.fallbackName ?? "Default";
  const fallbackStatusCode = options.fallbackStatusCode ?? 200;
  const fallbackContentType = options.fallbackContentType ?? "application/json";
  const fallbackBody = options.fallbackBody ?? "";
  const fallbackHeadersJson = options.fallbackHeadersJson ?? "{}";
  const fallbackDelayMs = options.fallbackDelayMs ?? 0;
  const name = normalizeApiResponseExampleName(example.name) || fallbackName;
  const responseBody = String(example.response_body ?? example.responseBody ?? fallbackBody);
  const headersJsonValue = example.headers_json ?? example.headersJson ?? fallbackHeadersJson;

  return {
    name,
    status_code: clampInteger(example.status_code ?? example.statusCode, 100, 599, fallbackStatusCode),
    content_type: String(example.content_type ?? example.contentType ?? fallbackContentType).trim() || fallbackContentType,
    response_body: responseBody,
    headers_json: String(headersJsonValue ?? "{}"),
    delay_ms: clampInteger(example.delay_ms ?? example.delayMs, 0, 30000, fallbackDelayMs),
    is_default: Boolean(example.is_default ?? example.isDefault)
  };
}

export function getApiResponseExamples(route = {}) {
  const rawExamples =
    Array.isArray(route.response_examples) && route.response_examples.length
      ? route.response_examples
      : [
          {
            name: "Success",
            status_code: route.status_code,
            content_type: route.content_type,
            response_body: route.response_body,
            headers_json: route.headers_json,
            delay_ms: route.delay_ms,
            is_default: true
          }
        ];

  const fallbackStatusCode = clampInteger(route.status_code, 100, 599, 200);
  const fallbackContentType = String(route.content_type ?? "application/json").trim() || "application/json";
  const fallbackBody = String(route.response_body ?? "");
  const fallbackHeadersJson = String(route.headers_json ?? "{}");
  const fallbackDelayMs = clampInteger(route.delay_ms, 0, 30000, 0);

  const normalizedExamples = rawExamples.map((example, index) =>
    normalizeApiResponseExample(example, {
      fallbackName: index === 0 ? "Success" : `Response ${index + 1}`,
      fallbackStatusCode,
      fallbackContentType,
      fallbackBody,
      fallbackHeadersJson,
      fallbackDelayMs
    })
  );

  const defaultIndex = normalizedExamples.findIndex((example) => example.is_default);
  return normalizedExamples.map((example, index) => ({
    ...example,
    is_default: defaultIndex === -1 ? index === 0 : index === defaultIndex
  }));
}

export function getDefaultApiResponseExample(route = {}) {
  return getApiResponseExamples(route).find((example) => example.is_default) ?? null;
}

export function findApiResponseExample(route = {}, exampleName = "") {
  const normalizedName = normalizeApiResponseExampleName(exampleName).toLowerCase();
  if (!normalizedName) {
    return getDefaultApiResponseExample(route);
  }

  return (
    getApiResponseExamples(route).find((example) => example.name.toLowerCase() === normalizedName) ?? null
  );
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function serializeApiRoute(row, publicUrl) {
  const responseExamples = getApiResponseExamples(row);
  const defaultExample = responseExamples.find((example) => example.is_default) ?? responseExamples[0] ?? null;

  return {
    ...row,
    response_examples: responseExamples,
    response_example_count: responseExamples.length,
    default_response_name: defaultExample?.name ?? null,
    is_active: Boolean(row.is_active),
    hit_count: Number(row.hit_count ?? 0),
    delay_ms: Number(defaultExample?.delay_ms ?? row.delay_ms ?? 0),
    status_code: Number(defaultExample?.status_code ?? row.status_code ?? 200),
    content_type: defaultExample?.content_type ?? row.content_type ?? "application/json",
    response_body: defaultExample?.response_body ?? row.response_body ?? "",
    headers_json: defaultExample?.headers_json ?? row.headers_json ?? "{}",
    url: publicUrl
  };
}

export function serializeWsEvent(row, fullNamespace) {
  return {
    ...row,
    is_active: Boolean(row.is_active),
    trigger_count: Number(row.trigger_count ?? 0),
    full_namespace: fullNamespace
  };
}

export function routePatternScore(routePath) {
  return normalizeRoutePath(routePath)
    .split("/")
    .filter(Boolean)
    .reduce((score, segment) => score + (segment.startsWith(":") ? 1 : 0), 0);
}

export function matchRoutePattern(pattern, requestPath) {
  const normalizedPattern = normalizeRoutePath(pattern);
  const normalizedRequestPath = normalizeRoutePath(requestPath);

  if (normalizedPattern === normalizedRequestPath) {
    return true;
  }

  const patternSegments = normalizedPattern.split("/").filter(Boolean);
  const requestSegments = normalizedRequestPath.split("/").filter(Boolean);

  if (patternSegments.length !== requestSegments.length) {
    return false;
  }

  return patternSegments.every((segment, index) => segment.startsWith(":") || segment === requestSegments[index]);
}

export function ensureContentTypeHeader(headersJson, contentType) {
  const parsed = safeJsonParse(headersJson || "{}", {});
  const headers = typeof parsed === "object" && parsed ? { ...parsed } : {};
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
  if (!hasContentType) {
    headers["Content-Type"] = contentType;
  }
  return JSON.stringify(headers, null, 2);
}
