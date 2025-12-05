import { NextResponse } from "next/server";

const allowedOrigins = ["https://seltra.app", "http://localhost:3000"];

export function corsMiddleware(request) {
  const origin = request.headers.get("origin");

  // If the origin is allowed, set CORS headers
  if (allowedOrigins.includes(origin)) {
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    return response;
  }

  return NextResponse.next();
}
