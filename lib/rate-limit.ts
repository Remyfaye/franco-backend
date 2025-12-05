// lib/rate-limit.ts
import { NextRequest } from "next/server";

const rateLimitMap = new Map();

export function rateLimit(
  request: NextRequest,
  limit: number = 10, // requests
  windowMs: number = 60000 // 1 minute
): { success: boolean; remaining: number } {
  // Get IP from headers (NextRequest doesn't have .ip directly)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0] || realIp || "anonymous";

  const key = `rate-limit:${ip}`;

  const now = Date.now();
  const windowStart = now - windowMs;

  const requests = rateLimitMap.get(key) || [];
  const recentRequests = requests.filter((time: number) => time > windowStart);

  if (recentRequests.length >= limit) {
    return { success: false, remaining: 0 };
  }

  recentRequests.push(now);
  rateLimitMap.set(key, recentRequests);

  // Clean up old entries (optional)
  if (recentRequests.length === 1) {
    setTimeout(() => {
      const current = rateLimitMap.get(key);
      if (current) {
        const updated = current.filter((time: number) => time > windowStart);
        if (updated.length === 0) {
          rateLimitMap.delete(key);
        } else {
          rateLimitMap.set(key, updated);
        }
      }
    }, windowMs + 1000);
  }

  return { success: true, remaining: limit - recentRequests.length };
}
const resendAttempts = new Map();

export function canResendEmail(email: string): boolean {
  const now = Date.now();
  const attempts = resendAttempts.get(email) || [];

  // Remove attempts older than 1 hour
  const recentAttempts = attempts.filter(
    (timestamp: number) => now - timestamp < 60 * 60 * 1000
  );

  // Allow max 3 attempts per hour
  if (recentAttempts.length >= 3) {
    return false;
  }

  // Add current attempt
  recentAttempts.push(now);
  resendAttempts.set(email, recentAttempts);

  return true;
}
