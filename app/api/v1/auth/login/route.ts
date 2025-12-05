import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db.cjs";
import { LoginSchema } from "../../../../../lib/validation";
import { verifyPassword } from "../../../../../lib";
import { createAuthToken } from "../../../../../lib/user";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = LoginSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { status: 401, message: "Invalid credentials", data: null },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(user.passwordHash, password);
    if (!isValidPassword) {
      return NextResponse.json(
        { status: 401, message: "Invalid credentials", data: null },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = await createAuthToken(user.id, user.roles);
    console.log(
      "✅ [login] Token created:",
      token ? "***" + token.slice(-10) : "none"
    );
    const roles = user.roles;
    // Create the response
    const responseData = {
      status: 200,
      message: "User sign in successful",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
        },
        token: token, // Also return token in response for manual testing
        isAdmin: roles.includes("ADMIN"),
      },
    };

    const response = NextResponse.json(responseData, { status: 200 });

    // CRITICAL FIX: Set cookie properly
    response.cookies.set({
      name: "auth-token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    console.log(
      "✅ [login] Cookie set successfully. Response headers:",
      Object.fromEntries(response.headers)
    );

    return response;
  } catch (error) {
    console.error("❌ [login] Error:", error);
    return NextResponse.json(
      { status: 500, message: "Internal server error", data: null },
      { status: 500 }
    );
  }
}
