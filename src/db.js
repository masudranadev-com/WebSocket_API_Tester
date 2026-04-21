import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getApiResponseExamples, getDefaultApiResponseExample } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const databasePath = path.join(dataDir, "signaldock.json");

fs.mkdirSync(dataDir, { recursive: true });

function usernameKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function createEmptyState() {
  return {
    meta: {
      format: "signaldock-json",
      version: 2
    },
    counters: {
      users: 0,
      apiRoutes: 0,
      wsEvents: 0,
      requestLogs: 0,
      wsLogs: 0,
      ipBlocks: 0
    },
    users: [],
    apiRoutes: [],
    wsEvents: [],
    requestLogs: [],
    wsLogs: [],
    ipBlocks: []
  };
}

function normalizeState(parsed) {
  const empty = createEmptyState();
  const rawApiRoutes = Array.isArray(parsed?.apiRoutes) ? parsed.apiRoutes : [];
  return {
    meta: {
      ...empty.meta,
      ...(parsed?.meta && typeof parsed.meta === "object" ? parsed.meta : {}),
      version: 2
    },
    counters: {
      ...empty.counters,
      ...(parsed?.counters && typeof parsed.counters === "object" ? parsed.counters : {})
    },
    users: Array.isArray(parsed?.users) ? parsed.users : [],
    apiRoutes: rawApiRoutes.map(normalizeApiRouteRecord),
    wsEvents: Array.isArray(parsed?.wsEvents) ? parsed.wsEvents : [],
    requestLogs: Array.isArray(parsed?.requestLogs) ? parsed.requestLogs : [],
    wsLogs: Array.isArray(parsed?.wsLogs) ? parsed.wsLogs : [],
    ipBlocks: Array.isArray(parsed?.ipBlocks) ? parsed.ipBlocks : []
  };
}

function persistState(snapshot) {
  fs.writeFileSync(databasePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

function loadState() {
  if (!fs.existsSync(databasePath)) {
    const initialState = createEmptyState();
    persistState(initialState);
    return initialState;
  }

  const raw = fs.readFileSync(databasePath, "utf8").trim();
  if (!raw) {
    const emptyState = createEmptyState();
    persistState(emptyState);
    return emptyState;
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    throw new Error(`Failed to parse ${databasePath}: ${error.message}`);
  }
}

const state = loadState();
persistState(state);

export const connection = {
  adapter: "json-file",
  path: databasePath
};

function nextId(counterName) {
  state.counters[counterName] = Number(state.counters[counterName] ?? 0) + 1;
  return state.counters[counterName];
}

function cloneRow(row) {
  return row ? structuredClone(row) : null;
}

function cloneRows(rows) {
  return rows.map((row) => structuredClone(row));
}

function normalizeId(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) ? numericValue : Number.NaN;
}

function createUniqueConstraintError(message) {
  const error = new Error(message);
  error.code = "SQLITE_CONSTRAINT_UNIQUE";
  return error;
}

function sortByUpdatedAtDesc(left, right) {
  if (left.updated_at === right.updated_at) {
    return Number(right.id) - Number(left.id);
  }

  return String(right.updated_at).localeCompare(String(left.updated_at));
}

function sortByPathLengthDesc(left, right) {
  const pathLengthDifference = String(right.path).length - String(left.path).length;
  if (pathLengthDifference !== 0) {
    return pathLengthDifference;
  }

  return Number(right.id) - Number(left.id);
}

function normalizeApiRouteRecord(route) {
  const responseExamples = getApiResponseExamples(route);
  const defaultExample = getDefaultApiResponseExample({ ...route, response_examples: responseExamples });

  return {
    ...route,
    response_examples: responseExamples,
    status_code: Number(defaultExample?.status_code ?? 200),
    content_type: defaultExample?.content_type ?? "application/json",
    response_body: defaultExample?.response_body ?? "",
    headers_json: defaultExample?.headers_json ?? "{}",
    delay_ms: Number(defaultExample?.delay_ms ?? 0),
    is_active: Number(route?.is_active ? 1 : 0),
    notes: String(route?.notes ?? ""),
    hit_count: Number(route?.hit_count ?? 0),
    last_hit_at: route?.last_hit_at ?? null,
    created_at: route?.created_at ?? new Date().toISOString(),
    updated_at: route?.updated_at ?? route?.created_at ?? new Date().toISOString()
  };
}

function normalizeApiResponseExamplesForStorage(examples) {
  return getApiResponseExamples({ response_examples: examples });
}

function save() {
  persistState(state);
}

function removeById(collection, id) {
  const index = collection.findIndex((row) => Number(row.id) === id);
  if (index === -1) {
    return null;
  }

  const [removed] = collection.splice(index, 1);
  return removed;
}

export function cleanupExpiredBlocks() {
  const now = new Date().toISOString();
  const nextBlocks = state.ipBlocks.filter((block) => block.blocked_until > now);

  if (nextBlocks.length !== state.ipBlocks.length) {
    state.ipBlocks = nextBlocks;
    save();
  }
}

export function findUserById(id) {
  cleanupExpiredBlocks();
  const userId = normalizeId(id);
  return cloneRow(state.users.find((user) => Number(user.id) === userId));
}

export function findUserByUsername(username) {
  cleanupExpiredBlocks();
  const key = usernameKey(username);
  return cloneRow(state.users.find((user) => usernameKey(user.username) === key));
}

export function createUser(username, passwordHash) {
  const key = usernameKey(username);
  if (state.users.some((user) => usernameKey(user.username) === key)) {
    throw createUniqueConstraintError("UNIQUE constraint failed: users.username");
  }

  const now = new Date().toISOString();
  const user = {
    id: nextId("users"),
    username,
    password_hash: passwordHash,
    created_at: now,
    last_login_at: now
  };

  state.users.push(user);
  save();
  return cloneRow(user);
}

export function touchUserLastLogin(userId) {
  const normalizedUserId = normalizeId(userId);
  const user = state.users.find((row) => Number(row.id) === normalizedUserId);
  if (!user) {
    return;
  }

  user.last_login_at = new Date().toISOString();
  save();
}

export function listApiRoutes(userId) {
  const normalizedUserId = normalizeId(userId);
  return cloneRows(
    state.apiRoutes
      .filter((route) => Number(route.user_id) === normalizedUserId)
      .sort(sortByUpdatedAtDesc)
  );
}

export function listApiRoutesForMethod(userId, method) {
  const normalizedUserId = normalizeId(userId);
  return cloneRows(
    state.apiRoutes
      .filter(
        (route) =>
          Number(route.user_id) === normalizedUserId &&
          route.method === method &&
          Number(route.is_active) === 1
      )
      .sort(sortByPathLengthDesc)
  );
}

export function getApiRouteById(routeId, userId) {
  const normalizedRouteId = normalizeId(routeId);
  const normalizedUserId = normalizeId(userId);
  return cloneRow(
    state.apiRoutes.find(
      (route) => Number(route.id) === normalizedRouteId && Number(route.user_id) === normalizedUserId
    )
  );
}

export function createApiRoute(userId, payload) {
  const normalizedUserId = normalizeId(userId);
  const duplicate = state.apiRoutes.some(
    (route) =>
      Number(route.user_id) === normalizedUserId &&
      route.method === payload.method &&
      route.path === payload.path
  );

  if (duplicate) {
    throw createUniqueConstraintError("UNIQUE constraint failed: api_routes.user_id, api_routes.method, api_routes.path");
  }

  const now = new Date().toISOString();
  const responseExamples = normalizeApiResponseExamplesForStorage(payload.responseExamples);
  const defaultExample = getDefaultApiResponseExample({ response_examples: responseExamples });
  const route = {
    id: nextId("apiRoutes"),
    user_id: normalizedUserId,
    method: payload.method,
    path: payload.path,
    status_code: Number(defaultExample?.status_code ?? 200),
    content_type: defaultExample?.content_type ?? "application/json",
    response_body: defaultExample?.response_body ?? "",
    headers_json: defaultExample?.headers_json ?? "{}",
    delay_ms: Number(defaultExample?.delay_ms ?? 0),
    response_examples: responseExamples,
    is_active: payload.isActive ? 1 : 0,
    notes: payload.notes,
    hit_count: 0,
    last_hit_at: null,
    created_at: now,
    updated_at: now
  };

  state.apiRoutes.push(route);
  save();
  return cloneRow(route);
}

export function updateApiRoute(routeId, userId, payload) {
  const normalizedRouteId = normalizeId(routeId);
  const normalizedUserId = normalizeId(userId);
  const route = state.apiRoutes.find(
    (row) => Number(row.id) === normalizedRouteId && Number(row.user_id) === normalizedUserId
  );

  if (!route) {
    return null;
  }

  const duplicate = state.apiRoutes.some(
    (row) =>
      Number(row.id) !== normalizedRouteId &&
      Number(row.user_id) === normalizedUserId &&
      row.method === payload.method &&
      row.path === payload.path
  );

  if (duplicate) {
    throw createUniqueConstraintError("UNIQUE constraint failed: api_routes.user_id, api_routes.method, api_routes.path");
  }

  const responseExamples = normalizeApiResponseExamplesForStorage(payload.responseExamples);
  const defaultExample = getDefaultApiResponseExample({ response_examples: responseExamples });
  route.method = payload.method;
  route.path = payload.path;
  route.status_code = Number(defaultExample?.status_code ?? 200);
  route.content_type = defaultExample?.content_type ?? "application/json";
  route.response_body = defaultExample?.response_body ?? "";
  route.headers_json = defaultExample?.headers_json ?? "{}";
  route.delay_ms = Number(defaultExample?.delay_ms ?? 0);
  route.response_examples = responseExamples;
  route.is_active = payload.isActive ? 1 : 0;
  route.notes = payload.notes;
  route.updated_at = new Date().toISOString();

  save();
  return cloneRow(route);
}

export function deleteApiRoute(routeId, userId) {
  const normalizedRouteId = normalizeId(routeId);
  const normalizedUserId = normalizeId(userId);
  const route = state.apiRoutes.find(
    (row) => Number(row.id) === normalizedRouteId && Number(row.user_id) === normalizedUserId
  );

  if (!route) {
    return false;
  }

  removeById(state.apiRoutes, normalizedRouteId);
  state.requestLogs = state.requestLogs.filter((log) => Number(log.route_id) !== normalizedRouteId);
  save();
  return true;
}

export function recordApiHit(routeId, ipAddress, method, statusCode, responseExampleName = null) {
  const normalizedRouteId = normalizeId(routeId);
  const route = state.apiRoutes.find((row) => Number(row.id) === normalizedRouteId);
  if (!route) {
    return;
  }

  const hitAt = new Date().toISOString();
  route.hit_count = Number(route.hit_count ?? 0) + 1;
  route.last_hit_at = hitAt;

  state.requestLogs.push({
    id: nextId("requestLogs"),
    route_id: normalizedRouteId,
    ip_address: ipAddress,
    request_method: method,
    status_code: Number(statusCode),
    response_example_name: responseExampleName ? String(responseExampleName) : null,
    hit_at: hitAt
  });

  save();
}

export function listWsEvents(userId) {
  const normalizedUserId = normalizeId(userId);
  return cloneRows(
    state.wsEvents
      .filter((event) => Number(event.user_id) === normalizedUserId)
      .sort(sortByUpdatedAtDesc)
  );
}

export function getWsEventById(eventId, userId) {
  const normalizedEventId = normalizeId(eventId);
  const normalizedUserId = normalizeId(userId);
  return cloneRow(
    state.wsEvents.find(
      (event) => Number(event.id) === normalizedEventId && Number(event.user_id) === normalizedUserId
    )
  );
}

export function createWsEvent(userId, payload) {
  const normalizedUserId = normalizeId(userId);
  const duplicate = state.wsEvents.some(
    (event) =>
      Number(event.user_id) === normalizedUserId &&
      event.namespace === payload.namespace &&
      event.event_name === payload.eventName
  );

  if (duplicate) {
    throw createUniqueConstraintError(
      "UNIQUE constraint failed: ws_events.user_id, ws_events.namespace, ws_events.event_name"
    );
  }

  const now = new Date().toISOString();
  const event = {
    id: nextId("wsEvents"),
    user_id: normalizedUserId,
    namespace: payload.namespace,
    event_name: payload.eventName,
    payload_template: payload.payloadTemplate,
    is_active: payload.isActive ? 1 : 0,
    notes: payload.notes,
    trigger_count: 0,
    last_trigger_at: null,
    created_at: now,
    updated_at: now
  };

  state.wsEvents.push(event);
  save();
  return cloneRow(event);
}

export function updateWsEvent(eventId, userId, payload) {
  const normalizedEventId = normalizeId(eventId);
  const normalizedUserId = normalizeId(userId);
  const event = state.wsEvents.find(
    (row) => Number(row.id) === normalizedEventId && Number(row.user_id) === normalizedUserId
  );

  if (!event) {
    return null;
  }

  const duplicate = state.wsEvents.some(
    (row) =>
      Number(row.id) !== normalizedEventId &&
      Number(row.user_id) === normalizedUserId &&
      row.namespace === payload.namespace &&
      row.event_name === payload.eventName
  );

  if (duplicate) {
    throw createUniqueConstraintError(
      "UNIQUE constraint failed: ws_events.user_id, ws_events.namespace, ws_events.event_name"
    );
  }

  event.namespace = payload.namespace;
  event.event_name = payload.eventName;
  event.payload_template = payload.payloadTemplate;
  event.is_active = payload.isActive ? 1 : 0;
  event.notes = payload.notes;
  event.updated_at = new Date().toISOString();

  save();
  return cloneRow(event);
}

export function deleteWsEvent(eventId, userId) {
  const normalizedEventId = normalizeId(eventId);
  const normalizedUserId = normalizeId(userId);
  const event = state.wsEvents.find(
    (row) => Number(row.id) === normalizedEventId && Number(row.user_id) === normalizedUserId
  );

  if (!event) {
    return false;
  }

  removeById(state.wsEvents, normalizedEventId);
  for (const log of state.wsLogs) {
    if (Number(log.ws_event_id) === normalizedEventId) {
      log.ws_event_id = null;
    }
  }

  save();
  return true;
}

export function recordWsEventTrigger(eventId, userId, namespace, eventName, ipAddress) {
  const normalizedEventId = normalizeId(eventId);
  const event = state.wsEvents.find((row) => Number(row.id) === normalizedEventId);
  if (!event) {
    return;
  }

  const hitAt = new Date().toISOString();
  event.trigger_count = Number(event.trigger_count ?? 0) + 1;
  event.last_trigger_at = hitAt;

  state.wsLogs.push({
    id: nextId("wsLogs"),
    ws_event_id: normalizedEventId,
    user_id: normalizeId(userId),
    namespace,
    event_name: eventName,
    ip_address: ipAddress,
    action_type: "trigger",
    hit_at: hitAt
  });

  save();
}

export function recordWsAction({ wsEventId = null, userId, namespace = "", eventName = "", ipAddress, actionType }) {
  state.wsLogs.push({
    id: nextId("wsLogs"),
    ws_event_id: wsEventId === null ? null : normalizeId(wsEventId),
    user_id: normalizeId(userId),
    namespace,
    event_name: eventName,
    ip_address: ipAddress,
    action_type: actionType,
    hit_at: new Date().toISOString()
  });

  save();
}

export function upsertIpBlock({ userId, channelType, routeOrEventKey, ipAddress, blockedUntil, reason }) {
  cleanupExpiredBlocks();
  const normalizedUserId = normalizeId(userId);
  const createdAt = new Date().toISOString();
  const existing = state.ipBlocks.find(
    (block) =>
      Number(block.user_id) === normalizedUserId &&
      block.channel_type === channelType &&
      block.route_or_event_key === routeOrEventKey &&
      block.ip_address === ipAddress
  );

  if (existing) {
    existing.blocked_until = blockedUntil;
    existing.reason = reason;
    existing.created_at = createdAt;
  } else {
    state.ipBlocks.push({
      id: nextId("ipBlocks"),
      user_id: normalizedUserId,
      channel_type: channelType,
      route_or_event_key: routeOrEventKey,
      ip_address: ipAddress,
      blocked_until: blockedUntil,
      reason,
      created_at: createdAt
    });
  }

  save();
}

export function getActiveIpBlock(userId, channelType, routeOrEventKey, ipAddress) {
  cleanupExpiredBlocks();
  const normalizedUserId = normalizeId(userId);
  const now = new Date().toISOString();
  return cloneRow(
    state.ipBlocks.find(
      (block) =>
        Number(block.user_id) === normalizedUserId &&
        block.channel_type === channelType &&
        block.route_or_event_key === routeOrEventKey &&
        block.ip_address === ipAddress &&
        block.blocked_until > now
    )
  );
}

export function getUserSummary(userId) {
  cleanupExpiredBlocks();
  const normalizedUserId = normalizeId(userId);
  const activeBlocks = state.ipBlocks.filter(
    (block) => Number(block.user_id) === normalizedUserId && block.blocked_until > new Date().toISOString()
  );
  const apiRoutes = state.apiRoutes.filter((route) => Number(route.user_id) === normalizedUserId);
  const wsEvents = state.wsEvents.filter((event) => Number(event.user_id) === normalizedUserId);

  return {
    api_count: apiRoutes.length,
    ws_count: wsEvents.length,
    total_api_hits: apiRoutes.reduce((sum, route) => sum + Number(route.hit_count ?? 0), 0),
    total_ws_triggers: wsEvents.reduce((sum, event) => sum + Number(event.trigger_count ?? 0), 0),
    blocked_ip_count: activeBlocks.length,
    last_blocked_at: activeBlocks.reduce(
      (latest, block) => (!latest || block.created_at > latest ? block.created_at : latest),
      null
    )
  };
}
