// lib/middleware.ts
import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://seltra.app",
];

const corsOptions = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version",
  "Access-Control-Allow-Credentials": "true",
};

// Rate limiting store for middleware
const rateLimitMap = new Map();
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // max 100 requests per minute per IP
};

// Helper function to check rate limit
function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;

  if (!rateLimitMap.has(identifier)) {
    rateLimitMap.set(identifier, []);
  }

  const requests = rateLimitMap
    .get(identifier)
    .filter((timestamp: number) => timestamp > windowStart);
  rateLimitMap.set(identifier, requests);

  // Clean up old entries periodically (optional)
  if (Math.random() < 0.01) {
    // 1% chance to clean up
    for (const [key, timestamps] of rateLimitMap.entries()) {
      const recent = timestamps.filter(
        (ts: number) => now - ts < RATE_LIMIT.windowMs * 10
      ); // Keep last 10 minutes
      if (recent.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, recent);
      }
    }
  }

  return requests.length >= RATE_LIMIT.maxRequests;
}

// Helper to get client IP
function getClientIP(request: NextRequest): string {
  // Try different headers that might contain the real IP
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfConnectingIP = request.headers.get("cf-connecting-ip"); // Cloudflare

  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(",")[0].trim();

  return "unknown";
}

export function middleware(request: NextRequest) {
  // Check the origin from the request
  const origin = request.headers.get("origin") ?? "";
  const isAllowedOrigin = allowedOrigins.includes(origin);

  // Handle preflight requests
  const isPreflight = request.method === "OPTIONS";

  if (isPreflight) {
    const preflightHeaders = {
      ...(isAllowedOrigin && { "Access-Control-Allow-Origin": origin }),
      ...corsOptions,
    };
    return NextResponse.json({}, { headers: preflightHeaders });
  }

  // Rate limiting for upload endpoints
  if (request.nextUrl.pathname.startsWith("/api/v1/upload")) {
    const ip = getClientIP(request);

    if (isRateLimited(ip)) {
      console.log(`🚫 Rate limit exceeded for IP: ${ip}`);
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": "60",
          ...(isAllowedOrigin && { "Access-Control-Allow-Origin": origin }),
          ...corsOptions,
        },
      });
    }
  }

  // Handle actual requests
  const response = NextResponse.next();

  if (isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  Object.entries(corsOptions).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
