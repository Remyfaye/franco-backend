import { NextRequest, NextResponse } from "next/server";
import cors from "cors";

// Define allowed origins (add more for local dev or previews)
const allowedOrigins = [
  "https://franco-lemon.vercel.app",
  "http://localhost:3000",
]; // Adjust as needed

// CORS options
const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"], // Add any custom headers you use
  credentials: true, // If using cookies/auth
};

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Run CORS middleware
  return new Promise((resolve, reject) => {
    cors(corsOptions)(request as any, response as any, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(response);
    });
  });
}

// Apply to all /api/* routes
export const config = {
  matcher: "/api/:path*",
};
