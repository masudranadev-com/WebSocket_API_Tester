import crypto from "node:crypto";
import http from "node:http";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import * as database from "./db.js";
import { createRateLimiter } from "./services/rate-limiter.js";
import { PLACEHOLDER_GUIDE, renderTemplate } from "./services/template-engine.js";
import {
  HTTP_METHODS,
  RESERVED_USERNAMES,
  buildPublicApiUrl,
  buildSocketNamespace,
  buildWorkspaceUrl,
  ensureContentTypeHeader,
  isValidNamespace,
  isValidUsername,
  matchRoutePattern,
  methodColor,
  normalizeNamespace,
  normalizeRoutePath,
  normalizeUsername,
  routePatternScore,
  safeJsonParse,
  serializeApiRoute,
  serializeWsEvent,
  sleep
} from "./utils.js";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET || "signaldock-dev-secret";
const isProduction = process.env.NODE_ENV === "production";
const limiter = createRateLimiter(database);
const authAttempts = new Map();
const publicDir = fileURLToPath(new URL("../public", import.meta.url));
const publicAssetsDir = fileURLToPath(new URL("../public/assets", import.meta.url));

const authSchema = z.object({
  username: z
    .string()
    .transform(normalizeUsername)
    .refine((value) => value.length > 0, "Username is required.")
    .refine((value) => isValidUsername(value), "Username can use almost anything except '/' and reserved routes."),
  password: z.string().min(1, "Password is required.").max(128)
});

const apiRouteSchema = z.object({
  method: z.enum(HTTP_METHODS),
  path: z
    .string()
    .min(1)
    .max(140)
    .transform(normalizeRoutePath),
  statusCode: z.coerce.number().int().min(100).max(599),
  contentType: z.string().trim().min(1).max(120),
  responseBody: z.string().min(1).max(10000),
  headersJson: z.string().max(4000).optional().default("{}"),
  delayMs: z.coerce.number().int().min(0).max(30000).optional().default(0),
  isActive: z.boolean().optional().default(true),
  notes: z.string().max(160).optional().default("")
});

const wsEventSchema = z.object({
  namespace: z
    .string()
    .max(140)
    .optional()
    .default("")
    .transform(normalizeNamespace)
    .refine((value) => isValidNamespace(value), "Namespace can use only letters, numbers, and hyphens."),
  eventName: z.string().trim().min(2).max(80).regex(/^[a-zA-Z0-9._:-]+$/, "Event name contains unsupported characters."),
  payloadTemplate: z.string().min(1).max(10000),
  isActive: z.boolean().optional().default(true),
  notes: z.string().max(160).optional().default("")
});

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", fileURLToPath(new URL("../views", import.meta.url)));
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"]
      }
    }
  })
);

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: "signaldock.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);
app.use(
  "/assets",
  express.static(publicAssetsDir, {
    immutable: isProduction,
    maxAge: isProduction ? "1y" : 0
  })
);
app.use(express.static(publicDir));

app.use((req, res, next) => {
  const sessionUserId = req.session.userId;
  if (!sessionUserId) {
    res.locals.currentUser = null;
    return next();
  }

  const user = database.findUserById(sessionUserId);
  if (!user) {
    req.session.destroy(() => next());
    return;
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomUUID();
  }

  req.currentUser = user;
  res.locals.currentUser = user;
  next();
});

function getSiteOrigin(req) {
  return String(process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function absoluteUrl(req, pathname = "/") {
  const normalizedPath = pathname === "/" ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`;
  return normalizedPath === "/" ? `${getSiteOrigin(req)}/` : `${getSiteOrigin(req)}${normalizedPath}`;
}

function buildPageMeta(req, overrides = {}) {
  const pathname = overrides.pathname ?? "/";
  const title = overrides.title ?? "SignalDock";
  const description = overrides.description ?? "Hosted mock REST APIs and Socket.IO events.";
  return {
    siteName: "SignalDock",
    title,
    description,
    robots: overrides.robots ?? "index,follow",
    keywords:
      overrides.keywords ??
      "mock api, mock server, websocket mock, socket.io mock, hosted mock api, frontend testing, qa testing, demo backend",
    canonical: absoluteUrl(req, pathname),
    image: overrides.image ?? absoluteUrl(req, "/social-preview.svg"),
    ogType: overrides.ogType ?? "website"
  };
}

function buildHomeStructuredData(req) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SignalDock",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    url: absoluteUrl(req, "/"),
    description:
      "SignalDock is a hosted mock API and Socket.IO event platform for frontend teams, QA engineers, mobile developers, and demo environments."
  };
}

function renderLandingPage(req, res, options = {}) {
  const statusCode = options.statusCode ?? 200;
  res.status(statusCode).render("auth", {
    pageError: options.pageError,
    meta:
      options.meta ??
      buildPageMeta(req, {
        pathname: "/",
        title: "SignalDock | Hosted Mock API and WebSocket Platform",
        description:
          "Create hosted mock REST APIs and Socket.IO events with dynamic placeholders, analytics, and rate limits for frontend, QA, and demo workflows."
      }),
    structuredData: options.structuredData === undefined ? buildHomeStructuredData(req) : options.structuredData
  });
}

function enforceAuthRateLimit(req, res, next) {
  const ipAddress = req.ip;
  const key = `auth:${ipAddress}`;
  const now = Date.now();
  const existing = authAttempts.get(key);

  if (existing && now - existing.windowStart < 10 * 60 * 1000 && existing.count >= 15) {
    return res.status(429).json({
      error: "Too many sign-in attempts from this IP. Try again in a few minutes."
    });
  }

  if (!existing || now - existing.windowStart >= 10 * 60 * 1000) {
    authAttempts.set(key, { count: 1, windowStart: now });
  } else {
    existing.count += 1;
    authAttempts.set(key, existing);
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    if (req.accepts("json")) {
      return res.status(401).json({ error: "You need to sign in first." });
    }

    return res.redirect("/");
  }

  next();
}

function requireCsrf(req, res, next) {
  const token = req.get("x-csrf-token") || req.body.csrfToken;
  if (!req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "Your session token is invalid. Refresh and try again." });
  }

  next();
}

function formatBootstrapPayload(req, user) {
  const workspaceUrl = buildWorkspaceUrl(req, user.username);
  const summary = database.getUserSummary(user.id);
  const apiRoutes = database
    .listApiRoutes(user.id)
    .map((route) => serializeApiRoute(route, buildPublicApiUrl(req, user.username, route.path)));
  const wsEvents = database
    .listWsEvents(user.id)
    .map((event) => serializeWsEvent(event, buildSocketNamespace(user.username, event.namespace)));

  return {
    user: {
      id: user.id,
      username: user.username,
      created_at: user.created_at,
      last_login_at: user.last_login_at
    },
    workspaceUrl,
    csrfToken: req.session.csrfToken,
    apiRoutes: apiRoutes.map((route) => ({
      ...route,
      method_color: methodColor(route.method)
    })),
    wsEvents,
    placeholderGuide: PLACEHOLDER_GUIDE.map((item) => ({
      ...item,
      preview: renderTemplate(item.token, {
        username: user.username
      })
    })),
    stats: {
      apiCount: Number(summary.api_count ?? 0),
      wsCount: Number(summary.ws_count ?? 0),
      totalApiHits: Number(summary.total_api_hits ?? 0),
      totalWsTriggers: Number(summary.total_ws_triggers ?? 0),
      blockedIpCount: Number(summary.blocked_ip_count ?? 0),
      lastBlockedAt: summary.last_blocked_at
    }
  };
}

function parseBody(schema, req, res) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Validation failed."
    });
    return null;
  }

  return parsed.data;
}

function mergeHeaders(contentType, headersJson) {
  const normalizedHeadersJson = headersJson?.trim() ? headersJson : "{}";
  const parsedHeaders = safeJsonParse(normalizedHeadersJson, null);
  if (!parsedHeaders || typeof parsedHeaders !== "object" || Array.isArray(parsedHeaders)) {
    return null;
  }

  return ensureContentTypeHeader(JSON.stringify(parsedHeaders), contentType);
}

function selectMatchingRoute(candidateRoutes, requestPath) {
  return [...candidateRoutes]
    .sort((left, right) => routePatternScore(left.path) - routePatternScore(right.path))
    .find((route) => matchRoutePattern(route.path, requestPath));
}

function socketIdentity(namespaceName) {
  const trimmed = namespaceName.replace(/^\/+/, "");
  const segments = trimmed.split("/").filter(Boolean);
  const rawUsername = segments[0] ?? "";
  return {
    username: (() => {
      try {
        return decodeURIComponent(rawUsername);
      } catch {
        return rawUsername;
      }
    })(),
    namespace: segments.length > 1 ? `/${segments.slice(1).join("/")}` : ""
  };
}

app.get("/", (req, res) => {
  if (req.currentUser) {
    return res.redirect("/dashboard");
  }

  renderLandingPage(req, res);
});

app.post("/auth/session", enforceAuthRateLimit, async (req, res) => {
  const parsed = parseBody(authSchema, req, res);
  if (!parsed) {
    return;
  }

  const authAttemptKey = `auth:${req.ip}`;
  let user = database.findUserByUsername(parsed.username);

  if (user) {
    const passwordMatches = await bcrypt.compare(parsed.password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid password for this workspace." });
    }

    database.touchUserLastLogin(user.id);
    user = database.findUserById(user.id);
  } else {
    const passwordHash = await bcrypt.hash(parsed.password, 12);
    user = database.createUser(parsed.username, passwordHash);
  }

  req.session.userId = user.id;
  req.session.csrfToken = crypto.randomUUID();
  authAttempts.delete(authAttemptKey);

  res.json({
    ok: true,
    redirectTo: "/dashboard"
  });
});

app.post("/auth/logout", requireAuth, requireCsrf, (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true, redirectTo: "/" });
  });
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send([
    "User-agent: *",
    "Allow: /",
    "Disallow: /dashboard",
    `Sitemap: ${absoluteUrl(req, "/sitemap.xml")}`
  ].join("\n"));
});

app.get("/sitemap.xml", (req, res) => {
  const homepageUrl = absoluteUrl(req, "/");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${homepageUrl}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

  res.type("application/xml").send(sitemap);
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get("/dashboard", requireAuth, (req, res) => {
  res.render("dashboard", {
    username: req.currentUser.username,
    workspaceUrl: buildWorkspaceUrl(req, req.currentUser.username),
    csrfToken: req.session.csrfToken,
    meta: buildPageMeta(req, {
      pathname: "/dashboard",
      robots: "noindex,nofollow",
      title: `SignalDock Workspace ${req.currentUser.username}`,
      description: `Manage mock APIs and WebSocket events for the ${req.currentUser.username} workspace.`
    })
  });
});

app.get("/dashboard/bootstrap", requireAuth, (req, res) => {
  res.json(formatBootstrapPayload(req, req.currentUser));
});

app.post("/dashboard/apis", requireAuth, requireCsrf, (req, res) => {
  const parsed = parseBody(apiRouteSchema, req, res);
  if (!parsed) {
    return;
  }

  const headersJson = mergeHeaders(parsed.contentType, parsed.headersJson);
  if (!headersJson) {
    return res.status(400).json({ error: "Headers JSON must be a valid object." });
  }

  try {
    const route = database.createApiRoute(req.currentUser.id, {
      ...parsed,
      headersJson
    });

    res.status(201).json({
      route: serializeApiRoute(route, buildPublicApiUrl(req, req.currentUser.username, route.path))
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "That method and path already exist in your workspace." });
    }

    throw error;
  }
});

app.put("/dashboard/apis/:id", requireAuth, requireCsrf, (req, res) => {
  const parsed = parseBody(apiRouteSchema, req, res);
  if (!parsed) {
    return;
  }

  const existingRoute = database.getApiRouteById(req.params.id, req.currentUser.id);
  if (!existingRoute) {
    return res.status(404).json({ error: "API route not found." });
  }

  const headersJson = mergeHeaders(parsed.contentType, parsed.headersJson);
  if (!headersJson) {
    return res.status(400).json({ error: "Headers JSON must be a valid object." });
  }

  try {
    const route = database.updateApiRoute(req.params.id, req.currentUser.id, {
      ...parsed,
      headersJson
    });

    res.json({
      route: serializeApiRoute(route, buildPublicApiUrl(req, req.currentUser.username, route.path))
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "That method and path already exist in your workspace." });
    }

    throw error;
  }
});

app.delete("/dashboard/apis/:id", requireAuth, requireCsrf, (req, res) => {
  const deleted = database.deleteApiRoute(req.params.id, req.currentUser.id);
  if (!deleted) {
    return res.status(404).json({ error: "API route not found." });
  }

  res.json({ ok: true });
});

app.post("/dashboard/ws-events", requireAuth, requireCsrf, (req, res) => {
  const parsed = parseBody(wsEventSchema, req, res);
  if (!parsed) {
    return;
  }

  try {
    const event = database.createWsEvent(req.currentUser.id, parsed);
    res.status(201).json({
      event: serializeWsEvent(event, buildSocketNamespace(req.currentUser.username, event.namespace))
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "That namespace and event name already exist." });
    }

    throw error;
  }
});

app.put("/dashboard/ws-events/:id", requireAuth, requireCsrf, (req, res) => {
  const parsed = parseBody(wsEventSchema, req, res);
  if (!parsed) {
    return;
  }

  const existingEvent = database.getWsEventById(req.params.id, req.currentUser.id);
  if (!existingEvent) {
    return res.status(404).json({ error: "WebSocket event not found." });
  }

  try {
    const event = database.updateWsEvent(req.params.id, req.currentUser.id, parsed);
    res.json({
      event: serializeWsEvent(event, buildSocketNamespace(req.currentUser.username, event.namespace))
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "That namespace and event name already exist." });
    }

    throw error;
  }
});

app.delete("/dashboard/ws-events/:id", requireAuth, requireCsrf, (req, res) => {
  const deleted = database.deleteWsEvent(req.params.id, req.currentUser.id);
  if (!deleted) {
    return res.status(404).json({ error: "WebSocket event not found." });
  }

  res.json({ ok: true });
});

app.post("/dashboard/ws-events/:id/trigger", requireAuth, requireCsrf, (req, res) => {
  const event = database.getWsEventById(req.params.id, req.currentUser.id);
  if (!event) {
    return res.status(404).json({ error: "WebSocket event not found." });
  }

  if (!event.is_active) {
    return res.status(409).json({ error: "This event is paused." });
  }

  const namespace = buildSocketNamespace(req.currentUser.username, event.namespace);
  const limitResult = limiter.check({
    userId: req.currentUser.id,
    channelType: "ws",
    routeOrEventKey: `trigger:${namespace}:${event.event_name}`,
    ipAddress: req.ip
  });

  if (!limitResult.allowed) {
    return res.status(429).json({
      error: "This IP is temporarily blocked from triggering this event.",
      retryAfterSeconds: limitResult.retryAfterSeconds
    });
  }

  const renderedPayload = renderTemplate(event.payload_template, {
    username: req.currentUser.username
  });
  const payload = safeJsonParse(renderedPayload, renderedPayload);
  const namespaceServer = io.of(namespace);

  namespaceServer.emit(event.event_name, payload);
  database.recordWsEventTrigger(event.id, req.currentUser.id, namespace, event.event_name, req.ip);

  res.json({
    ok: true,
    namespace,
    payload,
    deliveryCount: namespaceServer.sockets.size
  });
});

app.all(/^\/([^/]+)(\/.*)?$/, async (req, res, next) => {
  const username = req.params[0];
  const relativePath = normalizeRoutePath(req.params[1] || "/");

  if (RESERVED_USERNAMES.has(String(username).toLowerCase())) {
    return next();
  }

  const user = database.findUserByUsername(username);
  if (!user) {
    return next();
  }

  const candidateRoutes = database.listApiRoutesForMethod(user.id, req.method);
  const route = selectMatchingRoute(candidateRoutes, relativePath);
  if (!route || !route.is_active) {
    return res.status(404).json({ error: "Mock route not found." });
  }

  const limitResult = limiter.check({
    userId: user.id,
    channelType: "rest",
    routeOrEventKey: `${route.method}:${route.path}`,
    ipAddress: req.ip
  });

  if (!limitResult.allowed) {
    return res.status(429).json({
      error: "This IP is temporarily blocked for this endpoint.",
      retryAfterSeconds: limitResult.retryAfterSeconds
    });
  }

  if (route.delay_ms > 0) {
    await sleep(route.delay_ms);
  }

  const headers = safeJsonParse(route.headers_json, {});
  for (const [headerName, headerValue] of Object.entries(headers)) {
    res.setHeader(headerName, String(headerValue));
  }

  const responseBody = renderTemplate(route.response_body, {
    username: user.username
  });

  database.recordApiHit(route.id, req.ip, req.method, route.status_code);
  res.status(route.status_code).send(responseBody);
});

const workspaceNamespaces = io.of(/^\/[^/]+(?:\/[a-z0-9-]+)*$/i);

workspaceNamespaces.use((socket, next) => {
  const { username, namespace } = socketIdentity(socket.nsp.name);
  if (!isValidUsername(username)) {
    return next(new Error("Workspace not found."));
  }

  const user = database.findUserByUsername(username);
  if (!user) {
    return next(new Error("Workspace not found."));
  }

  const limitResult = limiter.check({
    userId: user.id,
    channelType: "ws",
    routeOrEventKey: `connect:${socket.nsp.name}`,
    ipAddress: socket.handshake.address
  });

  if (!limitResult.allowed) {
    return next(new Error(`Temporarily blocked. Retry in ${limitResult.retryAfterSeconds}s.`));
  }

  socket.data.user = user;
  socket.data.namespace = namespace;
  next();
});

workspaceNamespaces.on("connection", (socket) => {
  const user = socket.data.user;
  database.recordWsAction({
    userId: user.id,
    namespace: socket.nsp.name,
    ipAddress: socket.handshake.address,
    actionType: "connect"
  });

  socket.emit("platform.ready", {
    namespace: socket.nsp.name,
    username: user.username
  });
});

app.use((req, res) => {
  renderLandingPage(req, res, {
    statusCode: 404,
    pageError: "That page does not exist.",
    structuredData: null,
    meta: buildPageMeta(req, {
      pathname: req.originalUrl || "/",
      robots: "noindex,nofollow",
      title: "Page not found | SignalDock",
      description: "The page you requested could not be found."
    })
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }

  if (req.accepts("json")) {
    return res.status(500).json({
      error: "The server hit an unexpected error."
    });
  }

  renderLandingPage(req, res, {
    statusCode: 500,
    pageError: "Unexpected server error.",
    structuredData: null,
    meta: buildPageMeta(req, {
      pathname: req.originalUrl || "/",
      robots: "noindex,nofollow",
      title: "Server error | SignalDock",
      description: "The server hit an unexpected error."
    })
  });
});

server.listen(port, () => {
  console.log(`SignalDock running on http://localhost:${port}`);
});
