import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';

const DEFAULT_FIREBASE_PROJECT_ID = 'calorieapp-caca8';

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
      description: "Name of the food item or component (e.g., 'Rice', 'Chicken Curry', 'Ice Cream')",
    },
    portion: {
      type: Type.STRING,
      description: "Portion size or measurement (e.g., '1 cup', '100g', '2 scoops', '1 slice')",
    },
  },
  required: ["name", "portion"],
};

const nutritionalInfoSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the dish or food" },
    calories: { type: Type.NUMBER, description: "Estimated total calories" },
    protein: { type: Type.NUMBER, description: "Estimated protein in grams" },
    carbs: { type: Type.NUMBER, description: "Estimated carbohydrates in grams" },
    fats: { type: Type.NUMBER, description: "Estimated fats in grams" },
    servingSize: { type: Type.STRING, description: "Estimated serving size" },
    items: {
      type: Type.ARRAY,
      items: foodItemSchema,
      description: "List of distinct food items/components with portions",
    },
  },
  required: ["name", "calories", "protein", "carbs", "fats", "servingSize", "items"],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    if (!checkRateLimit(`nutrition-name:${ip}`, 30, 60 * 1000)) {
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

    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Valid food name is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel environment variables.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide nutritional information for "${name.trim()}". Identify the distinct food items/components that make up this dish and their estimated portions for a standard serving. Be as accurate as possible with estimations.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: nutritionalInfoSchema,
      },
    });

    if (!response.text) {
      return res.status(500).json({ error: 'AI returned an empty response.' });
    }

    const result = JSON.parse(response.text);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('API name lookup error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch nutrition data.' });
  }
}
