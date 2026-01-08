import { createHmac, randomBytes } from "crypto";

// Session token for authenticated profile access after phone verification
// Token format: base64(payload).signature
// Payload: { clientId, phone, expiresAt }

const SESSION_SECRET = process.env.SESSION_SECRET || "bloom-session-secret-change-in-production";
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface SessionPayload {
  clientId: string;
  phone: string;
  expiresAt: number;
}

function sign(data: string): string {
  return createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
}

export function createSessionToken(clientId: string, phone: string): string {
  const payload: SessionPayload = {
    clientId,
    phone,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadBase64);

  return `${payloadBase64}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [payloadBase64, signature] = token.split(".");

    if (!payloadBase64 || !signature) {
      return null;
    }

    // Verify signature
    const expectedSignature = sign(payloadBase64);
    if (signature !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf-8")
    );

    // Check expiration
    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// For new clients who don't have a clientId yet, create a phone-only token
export function createPhoneVerifiedToken(phone: string): string {
  const payload = {
    phone,
    verified: true,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadBase64);

  return `${payloadBase64}.${signature}`;
}

export function verifyPhoneToken(token: string): { phone: string } | null {
  try {
    const [payloadBase64, signature] = token.split(".");

    if (!payloadBase64 || !signature) {
      return null;
    }

    // Verify signature
    const expectedSignature = sign(payloadBase64);
    if (signature !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf-8")
    );

    // Check expiration
    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return { phone: payload.phone };
  } catch {
    return null;
  }
}
