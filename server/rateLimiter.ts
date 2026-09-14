interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired rate limit records (runs every 5 minutes)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
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

export function createRateLimitMiddleware(options: {
  limit: number;
  windowMs: number;
  keyPrefix?: string;
}) {
  return (req: any, res: any, next: any) => {
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
    const key = `${options.keyPrefix || 'rl'}:${ip}`;
    const result = checkRateLimit(key, options.limit, options.windowMs);

    res.setHeader('X-RateLimit-Limit', options.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
      });
    }

    next();
  };
}

export function applyVercelRateLimit(
  req: any,
  res: any,
  options: { limit: number; windowMs: number; keyPrefix?: string }
): boolean {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const key = `${options.keyPrefix || 'rl'}:${ip}`;
  const result = checkRateLimit(key, options.limit, options.windowMs);

  res.setHeader('X-RateLimit-Limit', options.limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

  if (!result.allowed) {
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
    });
    return false;
  }

  return true;
}
