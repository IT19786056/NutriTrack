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
export const DEFAULT_ADMIN_EMAIL = 'ravindijason@gmail.com';

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
  const maxAgeSeconds = match ? parseInt(match[1], 10) : 21600; // Default 6 hours

  cachedCertificates = (await response.json()) as Record<string, string>;
  certsExpiryTime = now + maxAgeSeconds * 1000;
  return cachedCertificates;
}

export function getProjectId(): string {
  return (
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    DEFAULT_FIREBASE_PROJECT_ID
  );
}

export async function verifyToken(idToken: string): Promise<DecodedIdToken> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Token is missing or not a string.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format (expected 3 parts).');
  }

  let header: { alg?: string; kid?: string };
  let payload: DecodedIdToken;

  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Failed to parse token header or payload.');
  }

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

  const isSignatureValid = verifier.verify(cert, signature);
  if (!isSignatureValid) {
    throw new Error('Invalid token cryptographic signature.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSeconds) {
    throw new Error('Authentication token has expired.');
  }

  const expectedProjectId = getProjectId();
  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;

  if (payload.iss !== expectedIssuer) {
    throw new Error(`Invalid token issuer. Expected ${expectedIssuer}, got ${payload.iss}`);
  }

  if (payload.aud !== expectedProjectId) {
    throw new Error(`Invalid token audience. Expected ${expectedProjectId}, got ${payload.aud}`);
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Token subject (sub) is empty or invalid.');
  }

  return payload;
}

export function extractBearerToken(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const configuredAdmin = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
  return email.toLowerCase().trim() === configuredAdmin;
}
