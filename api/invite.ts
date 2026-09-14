import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { extractBearerToken, verifyToken, isAdminEmail } from './_lib/auth';
import { applyVercelRateLimit } from './_lib/rateLimiter';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate Limiting (15 invites per 15 minutes)
    const allowed = applyVercelRateLimit(req, res, {
      limit: 15,
      windowMs: 15 * 60 * 1000,
      keyPrefix: 'invite-vercel',
    });
    if (!allowed) return;

    // Authentication & Authorization check
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
    }

    let callerEmail: string | undefined;
    try {
      const decoded = await verifyToken(token);
      callerEmail = decoded.email;
      if (!isAdminEmail(callerEmail)) {
        return res.status(403).json({ error: 'Forbidden: Administrator access required.' });
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
      console.error('SMTP credentials missing in environment variables');
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
