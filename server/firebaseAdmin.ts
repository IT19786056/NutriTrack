import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';

function initAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'nutritrack-ai';

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } catch (err) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY, falling back to projectId configuration:', err);
    }
  }

  return initializeApp({ projectId });
}

const adminApp = initAdminApp();
const adminAuth = getAuth(adminApp);

export { adminApp, adminAuth };

export async function verifyToken(idToken: string): Promise<DecodedIdToken> {
  return await adminAuth.verifyIdToken(idToken);
}

export function extractBearerToken(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const configuredAdmin = (process.env.ADMIN_EMAIL || 'ravindijason@gmail.com').toLowerCase().trim();
  return email.toLowerCase().trim() === configuredAdmin;
}
