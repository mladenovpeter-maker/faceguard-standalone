import crypto from "crypto";

export interface AuthTokenData {
  userId: number;
  username: string;
  role: string;
  displayName: string | null;
  expiresAt: number;
}

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// In-memory token store. Resets on server restart, same tradeoff the
// previous session-cookie approach had. Deliberately not cookie-based:
// this app can be embedded cross-origin (Canvas preview), and browsers
// increasingly block third-party cookies outright regardless of
// SameSite/Secure/Partitioned attributes. A Bearer token sent explicitly
// in the Authorization header sidesteps cookie policy entirely.
const tokens = new Map<string, AuthTokenData>();

export function createToken(data: Omit<AuthTokenData, "expiresAt">): string {
  const token = crypto.randomBytes(32).toString("hex");
  tokens.set(token, { ...data, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

export function getTokenData(token: string | null | undefined): AuthTokenData | null {
  if (!token) return null;
  const data = tokens.get(token);
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    tokens.delete(token);
    return null;
  }
  return data;
}

export function deleteToken(token: string | null | undefined): void {
  if (token) tokens.delete(token);
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}
