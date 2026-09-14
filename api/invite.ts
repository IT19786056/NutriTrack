import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const DEFAULT_FIREBASE_PROJECT_ID = 'calorieapp-caca8';
const KNOWN_ADMIN_EMAILS = [
  'ravindijason@gmail.com',
  'jasonlawrene23@gmail.com',
];

// Cache for Google's public certificates
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

async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email?: string; [key: string]: any }> {
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
  };
}

async function isUserAdmin(token: string, uid: string, email?: string): Promise<boolean> {
  const configuredAdmins = (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);

  const allAdminEmails = [...KNOWN_ADMIN_EMAILS, ...configuredAdmins];

  if (email && allAdminEmails.includes(email.toLowerCase().trim())) {
    return true;
  }

  // Check Firestore user document for role === 'admin'
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

// In-memory rate limiting (serverless-friendly)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate Limiting (15 invites per 15 minutes)
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    if (!checkRateLimit(`invite:${ip}`, 15, 15 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    // Authentication & Authorization check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
    }
    const token = authHeader.slice(7).trim();

    let callerEmail: string | undefined;
    let callerUid: string = '';
    try {
      const decoded = await verifyFirebaseToken(token);
      callerEmail = decoded.email;
      callerUid = decoded.uid;

      const authorizedAdmin = await isUserAdmin(token, callerUid, callerEmail);
      if (!authorizedAdmin) {
        return res.status(403).json({
          error: `Forbidden: Administrator access required. Signed in as: ${callerEmail || 'unknown'}.`,
        });
      }
    } catch (err: any) {
      console.error('Token verification error:', err.message || err);
      return res.status(401).json({
        error: `Unauthorized: ${err.message || 'Invalid or expired authentication token.'}`,
      });
    }

    const { email, invitedBy } = req.body || {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const escapeHtml = (str: string) =>
      String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const safeInvitedBy = escapeHtml(invitedBy || callerEmail || 'An Administrator');
    const safeEmail = escapeHtml(cleanEmail);

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({
        error: 'SMTP credentials not configured in Vercel environment variables (SMTP_USER, SMTP_PASS).',
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const baseUrl = process.env.APP_URL || 'https://nutri-track-xi-ten.vercel.app';
    const inviteLink = `${baseUrl}?email=${encodeURIComponent(cleanEmail)}&accept=true`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"NutriTrack AI" <${process.env.SMTP_USER}>`,
      to: cleanEmail,
      subject: "You've been invited to NutriTrack AI",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #1a1a1a;">Welcome to NutriTrack AI</h2>
          <p>Hello,</p>
          <p><strong>${safeInvitedBy}</strong> has invited you to join NutriTrack AI, your intelligent health companion.</p>
          <p>To get started, click the button below and sign in with your Google account (${safeEmail}).</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="color: #666; font-size: 12px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Fatal invite handler error:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred while sending invitation.',
    });
  }
}
