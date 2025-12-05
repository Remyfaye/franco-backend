import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [LOGOUT] Processing logout request...");

    // Create response
    const responseData = {
      status: "200",
      msg: "User logged out successfully",
    };

    // Create response and clear the auth-token cookie
    const response = NextResponse.json(responseData, { status: 200 });

    // Clear the auth-token cookie (must match your login cookie settings)
    response.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 0, // Expire immediately
      path: "/", // Make sure it matches the login path
    });

    // Optionally clear any other auth-related cookies
    response.cookies.set("refresh-token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    // Add CORS headers (copy from /auth/me)
    response.headers.set(
      "Access-Control-Allow-Origin",
      request.headers.get("origin") || "*"
    );
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    console.log("✅ [LOGOUT] User logged out successfully");

    return response;
  } catch (error: unknown) {
    console.error("❌ [LOGOUT] Error during logout:", error);

    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";

    // Create error response with CORS headers
    const response = NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );

    // Add CORS headers to error response
    response.headers.set(
      "Access-Control-Allow-Origin",
      request.headers.get("origin") || "*"
    );
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
}

// Also support GET requests for convenience
export async function GET(request: NextRequest) {
  return POST(request);
}
