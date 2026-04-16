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

export function normalizeUsername(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isValidUsername(value) {
  return /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(value) && !RESERVED_USERNAMES.has(value);
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
  return `${req.protocol}://${req.get("host")}/${username}`;
}

export function buildPublicApiUrl(req, username, routePath) {
  const normalizedPath = normalizeRoutePath(routePath);
  return `${buildWorkspaceUrl(req, username)}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function buildSocketNamespace(username, namespace = "") {
  return `/${username}${normalizeNamespace(namespace)}`;
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

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function serializeApiRoute(row, publicUrl) {
  return {
    ...row,
    is_active: Boolean(row.is_active),
    hit_count: Number(row.hit_count ?? 0),
    delay_ms: Number(row.delay_ms ?? 0),
    status_code: Number(row.status_code ?? 200),
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
