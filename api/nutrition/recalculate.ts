import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';

const DEFAULT_FIREBASE_PROJECT_ID = 'calorieapp-caca8';

const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-2.5-pro',
  'gemini-3.7-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

let cachedCertificates: Record<string, string> | null = null;
let certsExpiryTime = 0;

async function getGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCertificates && now < certsExpiryTime) {
    return cachedCertificates;
  }

  const response = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Google public certs (HTTP ${response.status})`);
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = match ? parseInt(match[1], 10) : 21600;

  cachedCertificates = (await response.json()) as Record<string, string>;
  certsExpiryTime = now + maxAgeSeconds * 1000;
  return cachedCertificates;
}

async function verifyFirebaseToken(idToken: string): Promise<{ email?: string; [key: string]: any }> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Authentication token is missing.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format (expected 3 parts).');
  }

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported token algorithm: ${header.alg}. Expected RS256.`);
  }

  if (!header.kid) {
    throw new Error('Token header is missing key ID (kid).');
  }

  const certs = await getGooglePublicKeys();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error(`Public key not found for kid: ${header.kid}`);
  }

  const signature = Buffer.from(parts[2], 'base64url');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);

  if (!verifier.verify(cert, signature)) {
    throw new Error('Invalid token cryptographic signature.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSeconds) {
    throw new Error('Authentication token has expired.');
  }

  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    DEFAULT_FIREBASE_PROJECT_ID;
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  if (payload.iss !== expectedIssuer) {
    throw new Error(`Invalid token issuer. Expected ${expectedIssuer}, got ${payload.iss}`);
  }

  if (payload.aud !== projectId) {
    throw new Error(`Invalid token audience. Expected ${projectId}, got ${payload.aud}`);
  }

  return payload;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (now - lastCleanup > 60000) {
    lastCleanup = now;
    for (const [k, entry] of rateLimitStore.entries()) {
      if (entry.resetTime <= now) rateLimitStore.delete(k);
    }
  }

  const entry = rateLimitStore.get(key);
  if (!entry || entry.resetTime <= now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

const foodItemSchema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "Precise name of the food item or component",
    },
    portion: {
      type: Type.STRING,
      description: "Portion size or measurement",
    },
  },
  required: ["name", "portion"],
};

const nutritionalInfoSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the dish or meal" },
    calories: { type: Type.NUMBER, description: "Total calories in kcal matching the combined ingredients" },
    protein: { type: Type.NUMBER, description: "Total protein in grams" },
    carbs: { type: Type.NUMBER, description: "Total carbohydrates in grams" },
    fats: { type: Type.NUMBER, description: "Total fats in grams" },
    servingSize: { type: Type.STRING, description: "Serving size or estimated weight" },
    items: {
      type: Type.ARRAY,
      items: foodItemSchema,
      description: "List of constituent food items and portions",
    },
  },
  required: ["name", "calories", "protein", "carbs", "fats", "servingSize", "items"],
};

async function generateWithFallback(ai: GoogleGenAI, contents: any) {
  let lastError: any = null;

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const model = FALLBACK_MODELS[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: nutritionalInfoSchema,
        },
      });

      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err.message || JSON.stringify(err);
      console.warn(`Model ${model} failed, attempting fallback to next model... Error: ${errMsg}`);
    }
  }

  throw lastError || new Error('All AI models are currently experiencing high demand. Please try again in a few moments.');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    if (!checkRateLimit(`nutrition-recalculate:${ip}`, 30, 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
    }
    const token = authHeader.slice(7).trim();

    try {
      await verifyFirebaseToken(token);
    } catch (err: any) {
      return res.status(401).json({
        error: `Unauthorized: ${err.message || 'Invalid or expired authentication token.'}`,
      });
    }

    const { items, foodName } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Food items must be an array.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel environment variables.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const itemsStr = items.map((i: any) => `${i.portion} of ${i.name}`).join(', ');
    const contents = `You are an expert clinical dietitian. Recalculate the exact nutritional information for "${foodName || 'Dish'}" based on this specific itemized breakdown and portions: ${itemsStr}.
CRITICAL ACCURACY GUIDELINES:
1. Provide the true total nutritional facts for the ENTIRE dish combining these specific portions.
2. Validate each item against standard USDA nutritional benchmarks (e.g., 100g cooked chicken breast = ~165 kcal, 31g protein, 3.6g fat; 1 cup cooked rice = ~200 kcal, 4.3g protein, 45g carbs; 1 tbsp olive oil = ~120 kcal, 14g fat).
3. Ensure the macro totals strictly equal the sum of each ingredient's contribution.`;

    const response = await generateWithFallback(ai, contents);

    if (!response.text) {
      return res.status(500).json({ error: 'AI returned an empty response.' });
    }

    const result = JSON.parse(response.text);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('API recalculate error:', error);
    return res.status(500).json({ error: error.message || 'Failed to recalculate nutrition.' });
  }
}
