import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const databasePath = path.join(dataDir, "signaldock.db");

fs.mkdirSync(dataDir, { recursive: true });

export const connection = new Database(databasePath);

connection.pragma("journal_mode = WAL");
connection.pragma("foreign_keys = ON");

connection.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS api_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 200,
    content_type TEXT NOT NULL DEFAULT 'application/json',
    response_body TEXT NOT NULL,
    headers_json TEXT NOT NULL DEFAULT '{}',
    delay_ms INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT NOT NULL DEFAULT '',
    hit_count INTEGER NOT NULL DEFAULT 0,
    last_hit_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, method, path)
  );

  CREATE TABLE IF NOT EXISTS ws_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    namespace TEXT NOT NULL DEFAULT '',
    event_name TEXT NOT NULL,
    payload_template TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT NOT NULL DEFAULT '',
    trigger_count INTEGER NOT NULL DEFAULT 0,
    last_trigger_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, namespace, event_name)
  );

  CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL REFERENCES api_routes(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    request_method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    hit_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ws_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ws_event_id INTEGER REFERENCES ws_events(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    namespace TEXT NOT NULL DEFAULT '',
    event_name TEXT NOT NULL DEFAULT '',
    ip_address TEXT NOT NULL,
    action_type TEXT NOT NULL,
    hit_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ip_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL,
    route_or_event_key TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    blocked_until TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, channel_type, route_or_event_key, ip_address)
  );

  CREATE INDEX IF NOT EXISTS idx_api_routes_user_method ON api_routes(user_id, method);
  CREATE INDEX IF NOT EXISTS idx_ws_events_user_namespace ON ws_events(user_id, namespace);
  CREATE INDEX IF NOT EXISTS idx_request_logs_route_hit_at ON request_logs(route_id, hit_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ws_logs_user_hit_at ON ws_logs(user_id, hit_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ip_blocks_lookup ON ip_blocks(user_id, channel_type, route_or_event_key, ip_address, blocked_until);
`);

const deleteExpiredBlocksStatement = connection.prepare(`
  DELETE FROM ip_blocks
  WHERE blocked_until <= ?
`);

const findUserByIdStatement = connection.prepare(`
  SELECT *
  FROM users
  WHERE id = ?
`);

const findUserByUsernameStatement = connection.prepare(`
  SELECT *
  FROM users
  WHERE username = ?
`);

const createUserStatement = connection.prepare(`
  INSERT INTO users (username, password_hash, created_at, last_login_at)
  VALUES (?, ?, ?, ?)
`);

const updateUserLastLoginStatement = connection.prepare(`
  UPDATE users
  SET last_login_at = ?
  WHERE id = ?
`);

const listApiRoutesStatement = connection.prepare(`
  SELECT *
  FROM api_routes
  WHERE user_id = ?
  ORDER BY updated_at DESC, id DESC
`);

const listApiRoutesForMethodStatement = connection.prepare(`
  SELECT *
  FROM api_routes
  WHERE user_id = ? AND method = ? AND is_active = 1
  ORDER BY length(path) DESC, id DESC
`);

const findApiRouteByIdStatement = connection.prepare(`
  SELECT *
  FROM api_routes
  WHERE id = ? AND user_id = ?
`);

const createApiRouteStatement = connection.prepare(`
  INSERT INTO api_routes (
    user_id, method, path, status_code, content_type, response_body, headers_json, delay_ms,
    is_active, notes, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateApiRouteStatement = connection.prepare(`
  UPDATE api_routes
  SET method = ?, path = ?, status_code = ?, content_type = ?, response_body = ?, headers_json = ?,
      delay_ms = ?, is_active = ?, notes = ?, updated_at = ?
  WHERE id = ? AND user_id = ?
`);

const deleteApiRouteStatement = connection.prepare(`
  DELETE FROM api_routes
  WHERE id = ? AND user_id = ?
`);

const listWsEventsStatement = connection.prepare(`
  SELECT *
  FROM ws_events
  WHERE user_id = ?
  ORDER BY updated_at DESC, id DESC
`);

const findWsEventByIdStatement = connection.prepare(`
  SELECT *
  FROM ws_events
  WHERE id = ? AND user_id = ?
`);

const createWsEventStatement = connection.prepare(`
  INSERT INTO ws_events (
    user_id, namespace, event_name, payload_template, is_active, notes, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateWsEventStatement = connection.prepare(`
  UPDATE ws_events
  SET namespace = ?, event_name = ?, payload_template = ?, is_active = ?, notes = ?, updated_at = ?
  WHERE id = ? AND user_id = ?
`);

const deleteWsEventStatement = connection.prepare(`
  DELETE FROM ws_events
  WHERE id = ? AND user_id = ?
`);

const insertRequestLogStatement = connection.prepare(`
  INSERT INTO request_logs (route_id, ip_address, request_method, status_code, hit_at)
  VALUES (?, ?, ?, ?, ?)
`);

const updateApiRouteHitStatement = connection.prepare(`
  UPDATE api_routes
  SET hit_count = hit_count + 1, last_hit_at = ?
  WHERE id = ?
`);

const insertWsLogStatement = connection.prepare(`
  INSERT INTO ws_logs (ws_event_id, user_id, namespace, event_name, ip_address, action_type, hit_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const updateWsTriggerStatement = connection.prepare(`
  UPDATE ws_events
  SET trigger_count = trigger_count + 1, last_trigger_at = ?
  WHERE id = ?
`);

const upsertIpBlockStatement = connection.prepare(`
  INSERT INTO ip_blocks (
    user_id, channel_type, route_or_event_key, ip_address, blocked_until, reason, created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id, channel_type, route_or_event_key, ip_address)
  DO UPDATE SET blocked_until = excluded.blocked_until, reason = excluded.reason, created_at = excluded.created_at
`);

const findActiveIpBlockStatement = connection.prepare(`
  SELECT *
  FROM ip_blocks
  WHERE user_id = ?
    AND channel_type = ?
    AND route_or_event_key = ?
    AND ip_address = ?
    AND blocked_until > ?
`);

const userSummaryStatement = connection.prepare(`
  SELECT
    (SELECT COUNT(*) FROM api_routes WHERE user_id = ?) AS api_count,
    (SELECT COUNT(*) FROM ws_events WHERE user_id = ?) AS ws_count,
    (SELECT COALESCE(SUM(hit_count), 0) FROM api_routes WHERE user_id = ?) AS total_api_hits,
    (SELECT COALESCE(SUM(trigger_count), 0) FROM ws_events WHERE user_id = ?) AS total_ws_triggers,
    (SELECT COUNT(*) FROM ip_blocks WHERE user_id = ? AND blocked_until > ?) AS blocked_ip_count,
    (SELECT MAX(created_at) FROM ip_blocks WHERE user_id = ? AND blocked_until > ?) AS last_blocked_at
`);

const recordApiRouteHit = connection.transaction((routeId, ipAddress, method, statusCode, hitAt) => {
  updateApiRouteHitStatement.run(hitAt, routeId);
  insertRequestLogStatement.run(routeId, ipAddress, method, statusCode, hitAt);
});

const recordWsTrigger = connection.transaction((wsEventId, userId, namespace, eventName, ipAddress, hitAt) => {
  updateWsTriggerStatement.run(hitAt, wsEventId);
  insertWsLogStatement.run(wsEventId, userId, namespace, eventName, ipAddress, "trigger", hitAt);
});

export function cleanupExpiredBlocks() {
  deleteExpiredBlocksStatement.run(new Date().toISOString());
}

export function findUserById(id) {
  cleanupExpiredBlocks();
  return findUserByIdStatement.get(id);
}

export function findUserByUsername(username) {
  cleanupExpiredBlocks();
  return findUserByUsernameStatement.get(username);
}

export function createUser(username, passwordHash) {
  const now = new Date().toISOString();
  const result = createUserStatement.run(username, passwordHash, now, now);
  return findUserById(result.lastInsertRowid);
}

export function touchUserLastLogin(userId) {
  updateUserLastLoginStatement.run(new Date().toISOString(), userId);
}

export function listApiRoutes(userId) {
  return listApiRoutesStatement.all(userId);
}

export function listApiRoutesForMethod(userId, method) {
  return listApiRoutesForMethodStatement.all(userId, method);
}

export function getApiRouteById(routeId, userId) {
  return findApiRouteByIdStatement.get(routeId, userId);
}

export function createApiRoute(userId, payload) {
  const now = new Date().toISOString();
  const result = createApiRouteStatement.run(
    userId,
    payload.method,
    payload.path,
    payload.statusCode,
    payload.contentType,
    payload.responseBody,
    payload.headersJson,
    payload.delayMs,
    payload.isActive ? 1 : 0,
    payload.notes,
    now,
    now
  );
  return getApiRouteById(result.lastInsertRowid, userId);
}

export function updateApiRoute(routeId, userId, payload) {
  updateApiRouteStatement.run(
    payload.method,
    payload.path,
    payload.statusCode,
    payload.contentType,
    payload.responseBody,
    payload.headersJson,
    payload.delayMs,
    payload.isActive ? 1 : 0,
    payload.notes,
    new Date().toISOString(),
    routeId,
    userId
  );
  return getApiRouteById(routeId, userId);
}

export function deleteApiRoute(routeId, userId) {
  return deleteApiRouteStatement.run(routeId, userId).changes > 0;
}

export function recordApiHit(routeId, ipAddress, method, statusCode) {
  recordApiRouteHit(routeId, ipAddress, method, statusCode, new Date().toISOString());
}

export function listWsEvents(userId) {
  return listWsEventsStatement.all(userId);
}

export function getWsEventById(eventId, userId) {
  return findWsEventByIdStatement.get(eventId, userId);
}

export function createWsEvent(userId, payload) {
  const now = new Date().toISOString();
  const result = createWsEventStatement.run(
    userId,
    payload.namespace,
    payload.eventName,
    payload.payloadTemplate,
    payload.isActive ? 1 : 0,
    payload.notes,
    now,
    now
  );
  return getWsEventById(result.lastInsertRowid, userId);
}

export function updateWsEvent(eventId, userId, payload) {
  updateWsEventStatement.run(
    payload.namespace,
    payload.eventName,
    payload.payloadTemplate,
    payload.isActive ? 1 : 0,
    payload.notes,
    new Date().toISOString(),
    eventId,
    userId
  );
  return getWsEventById(eventId, userId);
}

export function deleteWsEvent(eventId, userId) {
  return deleteWsEventStatement.run(eventId, userId).changes > 0;
}

export function recordWsEventTrigger(eventId, userId, namespace, eventName, ipAddress) {
  recordWsTrigger(eventId, userId, namespace, eventName, ipAddress, new Date().toISOString());
}

export function recordWsAction({ wsEventId = null, userId, namespace = "", eventName = "", ipAddress, actionType }) {
  insertWsLogStatement.run(wsEventId, userId, namespace, eventName, ipAddress, actionType, new Date().toISOString());
}

export function upsertIpBlock({ userId, channelType, routeOrEventKey, ipAddress, blockedUntil, reason }) {
  upsertIpBlockStatement.run(
    userId,
    channelType,
    routeOrEventKey,
    ipAddress,
    blockedUntil,
    reason,
    new Date().toISOString()
  );
}

export function getActiveIpBlock(userId, channelType, routeOrEventKey, ipAddress) {
  cleanupExpiredBlocks();
  return findActiveIpBlockStatement.get(
    userId,
    channelType,
    routeOrEventKey,
    ipAddress,
    new Date().toISOString()
  );
}

export function getUserSummary(userId) {
  cleanupExpiredBlocks();
  return userSummaryStatement.get(
    userId,
    userId,
    userId,
    userId,
    userId,
    new Date().toISOString(),
    userId,
    new Date().toISOString()
  );
}
