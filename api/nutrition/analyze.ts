import { VercelRequest, VercelResponse } from '@vercel/node';
import { extractBearerToken, verifyToken } from '../_lib/auth';
import { applyVercelRateLimit } from '../_lib/rateLimiter';
import { analyzeFoodImageServer } from '../_lib/gemini';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate Limiting (30 requests per minute)
    const allowed = applyVercelRateLimit(req, res, {
      limit: 30,
      windowMs: 60 * 1000,
      keyPrefix: 'nutrition-analyze',
    });
    if (!allowed) return;

    // Authentication check
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
    }

    try {
      await verifyToken(token);
    } catch (err: any) {
      return res.status(401).json({
        error: `Unauthorized: ${err.message || 'Invalid or expired authentication token.'}`,
      });
    }

    const { image } = req.body || {};
    const result = await analyzeFoodImageServer(image);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('API analyze error:', error.message || error);
    const status =
      error.message?.includes('exceeds') || error.message?.includes('required') ? 400 : 500;
    return res.status(status).json({ error: error.message || 'Failed to analyze food image.' });
  }
}
