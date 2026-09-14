import { VercelRequest, VercelResponse } from '@vercel/node';
import { extractBearerToken, verifyToken } from '../../server/firebaseAdmin';
import { applyVercelRateLimit } from '../../server/rateLimiter';
import { getNutritionByNameServer } from '../../server/geminiService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate Limiting (30 requests per minute)
  const allowed = applyVercelRateLimit(req, res, {
    limit: 30,
    windowMs: 60 * 1000,
    keyPrefix: 'nutrition-name',
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
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
  }

  try {
    const { name } = req.body || {};
    const result = await getNutritionByNameServer(name);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('API name lookup error:', error.message || error);
    const status =
      error.message?.includes('required') || error.message?.includes('long') ? 400 : 500;
    return res.status(status).json({ error: error.message || 'Failed to fetch nutrition data.' });
  }
}
