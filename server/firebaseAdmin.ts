import crypto from 'crypto';

export interface DecodedIdToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  iss: string;
  aud: string;
  auth_time: number;
  sub: string;
  iat: number;
  exp: number;
  [key: string]: any;
}

export const DEFAULT_FIREBASE_PROJECT_ID = 'calorieapp-caca8';
export const KNOWN_ADMIN_EMAILS = [
  'ravindijason@gmail.com',
  'jasonlawrene23@gmail.com',
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

export async function verifyToken(idToken: string): Promise<DecodedIdToken> {
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

  return {
    ...payload,
    uid: payload.user_id || payload.sub,
  } as DecodedIdToken;
}

export function extractBearerToken(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export async function isUserAdmin(token: string, uid: string, email?: string): Promise<boolean> {
  const configuredAdmins = (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);

  const allAdminEmails = [...KNOWN_ADMIN_EMAILS, ...configuredAdmins];

  if (email && allAdminEmails.includes(email.toLowerCase().trim())) {
    return true;
  }

  if (token && uid) {
    try {
      const projectId =
        process.env.VITE_FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID ||
        DEFAULT_FIREBASE_PROJECT_ID;

      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        const doc = await res.json();
        const role = doc.fields?.role?.stringValue;
        if (role === 'admin') {
          return true;
        }
      }
    } catch (err) {
      console.warn('Firestore admin check error:', err);
    }
  }

  return false;
}
