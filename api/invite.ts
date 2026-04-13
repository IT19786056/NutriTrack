import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, invitedBy } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const inviteLink = `${process.env.APP_URL || 'http://localhost:3000'}`;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"NutriTrack AI" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "You've been invited to NutriTrack AI",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #1a1a1a;">Welcome to NutriTrack AI</h2>
          <p>Hello,</p>
          <p><strong>${invitedBy}</strong> has invited you to join NutriTrack AI, your intelligent health companion.</p>
          <p>To get started, click the button below and sign in with your Google account (${email}).</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accept Invitation</a>
          </div>
          <p style="color: #666; font-size: 12px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('SMTP Error:', error);
    return res.status(500).json({ error: 'Failed to send email. Check SMTP configuration.' });
  }
}
