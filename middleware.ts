// middleware.ts (in your BACKEND project)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Handle preflight requests
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 200 });

    const origin = request.headers.get("origin");
    const allowedOrigins = [
      "https://adhive-frontend.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
    ];

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }

    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, Cache-Control, Pragma"
    );

    return response;
  }

  // For actual requests, add CORS headers
  const response = NextResponse.next();

  const origin = request.headers.get("origin");
  const allowedOrigins = [
    "https://adhive-frontend.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "https://seltra.app/",
  ];

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  response.headers.set("Access-Control-Allow-Credentials", "true");

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
