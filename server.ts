import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import {
  extractBearerToken,
  verifyToken,
  isAdminEmail,
} from "./server/firebaseAdmin";
import {
  createRateLimitMiddleware,
} from "./server/rateLimiter";
import {
  analyzeFoodImageServer,
  getNutritionByNameServer,
  recalculateNutritionServer,
} from "./server/geminiService";

dotenv.config();

const app = express();

// Disable x-powered-by header
app.disable("x-powered-by");

// Payload size limit (up to 10mb for image uploads)
app.use(express.json({ limit: "10mb" }));

// Security Headers Middleware
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Authentication Middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
  }

  try {
    const decoded = await verifyToken(token);
    req.user = decoded;
    next();
  } catch (error: any) {
    console.error("Token verification failed:", error.message || error);
    return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
  }
}

// Admin Authorization Middleware
async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (!req.user || !isAdminEmail(req.user.email)) {
      return res.status(403).json({ error: "Forbidden: Administrator access required." });
    }
    next();
  });
}

// Rate limiters
const inviteRateLimiter = createRateLimitMiddleware({
  limit: 15,
  windowMs: 15 * 60 * 1000,
  keyPrefix: "invite",
});

const nutritionRateLimiter = createRateLimitMiddleware({
  limit: 30,
  windowMs: 60 * 1000,
  keyPrefix: "nutrition",
});

// API Route for sending invitations (Admin only + rate limited)
app.post("/api/invite", inviteRateLimiter, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { email, invitedBy } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const cleanEmail = email.toLowerCase().trim();
  const escapeHtml = (str: string) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const safeInvitedBy = escapeHtml(invitedBy || req.user?.email || "An Administrator");
  const safeEmail = escapeHtml(cleanEmail);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const inviteLink = `${baseUrl}?email=${encodeURIComponent(cleanEmail)}&accept=true`;

  try {
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

    return res.json({ success: true });
  } catch (error) {
    console.error("SMTP Error:", error);
    return res.status(500).json({ error: "Failed to send email. Check SMTP configuration." });
  }
});

// API Routes for Nutrition AI (User authenticated + rate limited)
app.post("/api/nutrition/analyze", nutritionRateLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { image } = req.body;
    const result = await analyzeFoodImageServer(image);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Nutrition analyze error:", error.message || error);
    const status = error.message?.includes("exceeds") || error.message?.includes("required") ? 400 : 500;
    return res.status(status).json({ error: error.message || "Failed to analyze food image." });
  }
});

app.post("/api/nutrition/name", nutritionRateLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.body;
    const result = await getNutritionByNameServer(name);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Nutrition lookup error:", error.message || error);
    const status = error.message?.includes("required") || error.message?.includes("long") ? 400 : 500;
    return res.status(status).json({ error: error.message || "Failed to fetch nutrition data." });
  }
});

app.post("/api/nutrition/recalculate", nutritionRateLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items, foodName } = req.body;
    const result = await recalculateNutritionServer(items, foodName);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Nutrition recalculate error:", error.message || error);
    const status = error.message?.includes("required") || error.message?.includes("array") ? 400 : 500;
    return res.status(status).json({ error: error.message || "Failed to recalculate nutrition." });
  }
});

async function setupVite() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  setupVite().then(() => {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

export default app;
