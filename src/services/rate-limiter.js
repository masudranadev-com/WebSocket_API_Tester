const WINDOW_MS = 60 * 1000;
const BLOCK_MS = 5 * 60 * 1000;

export function createRateLimiter(database) {
  const counters = new Map();

  function prune(now) {
    for (const [key, value] of counters.entries()) {
      if (now - value.windowStart > WINDOW_MS * 2) {
        counters.delete(key);
      }
    }
  }

  return {
    check({ userId, channelType, routeOrEventKey, ipAddress, limit = 100 }) {
      const now = Date.now();
      prune(now);

      const activeBlock = database.getActiveIpBlock(userId, channelType, routeOrEventKey, ipAddress);
      if (activeBlock) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((new Date(activeBlock.blocked_until).getTime() - now) / 1000)),
          blockedUntil: activeBlock.blocked_until
        };
      }

      const counterKey = `${userId}:${channelType}:${routeOrEventKey}:${ipAddress}`;
      const existing = counters.get(counterKey);
      const withinWindow = existing && now - existing.windowStart < WINDOW_MS;
      const counter = withinWindow
        ? existing
        : {
            count: 0,
            windowStart: now
          };

      counter.count += 1;
      counters.set(counterKey, counter);

      if (counter.count > limit) {
        const blockedUntil = new Date(now + BLOCK_MS).toISOString();
        database.upsertIpBlock({
          userId,
          channelType,
          routeOrEventKey,
          ipAddress,
          blockedUntil,
          reason: "rate_limit_exceeded"
        });

        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(BLOCK_MS / 1000),
          blockedUntil
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, limit - counter.count)
      };
    }
  };
}
