import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = [
  "https://franco-lemon.vercel.app",
  "http://localhost:3000",
];

export async function middleware(request: NextRequest) {
  // Get the origin of the request
  const origin = request.headers.get("origin") || "";
  const isAllowedOrigin =
    allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    const preflightHeaders = {
      "Access-Control-Allow-Origin": isAllowedOrigin
        ? origin
        : allowedOrigins[0],
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    };
    return new NextResponse(null, { status: 200, headers: preflightHeaders });
  }

  // Handle regular requests
  const response = NextResponse.next();

  if (isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
