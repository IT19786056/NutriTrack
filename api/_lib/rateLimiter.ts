interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();

  // Passive cleanup every 60 seconds (safe for serverless runtimes)
  if (now - lastCleanup > 60 * 1000) {
    lastCleanup = now;
    for (const [k, entry] of rateLimitStore.entries()) {
      if (entry.resetTime <= now) {
        rateLimitStore.delete(k);
      }
    }
  }

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime <= now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetTime: entry.resetTime };
}

export function applyVercelRateLimit(
  req: any,
  res: any,
  options: { limit: number; windowMs: number; keyPrefix?: string }
): boolean {
  try {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    const key = `${options.keyPrefix || 'rl'}:${ip}`;
    const result = checkRateLimit(key, options.limit, options.windowMs);

    if (typeof res.setHeader === 'function') {
      res.setHeader('X-RateLimit-Limit', String(options.limit));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));
    }

    if (!result.allowed) {
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
      });
      return false;
    }
  } catch (err) {
    console.warn('Rate limiter check error, proceeding:', err);
  }

  return true;
}
