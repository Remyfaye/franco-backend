import { NextRequest, NextResponse } from "next/server";
import cors from "cors";

const allowedOrigins = [
  "https://franco-lemon.vercel.app",
  "http://localhost:3000", // For local dev
  // Add Vercel preview URLs if needed, e.g., using a pattern check below
];

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean | string) => void
  ) => {
    if (
      !origin ||
      allowedOrigins.some((allowed) => origin.startsWith(allowed)) ||
      origin.endsWith(".vercel.app")
    ) {
      callback(null, origin); // Echo back the origin for previews
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // If using sessions/cookies
};

export async function middleware(request: NextRequest) {
  return await new Promise((resolve) => {
    cors(corsOptions)(
      request as any,
      NextResponse.next() as any,
      resolve as any
    );
  });
}

export const config = {
  matcher: "/api/:path*",
};
