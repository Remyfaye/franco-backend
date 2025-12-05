import { NextRequest, NextResponse } from "next/server";
import { RegisterSchema } from "../../../../../lib/validation";
import { prisma } from "../../../../../lib/db.cjs";
import { hashPassword } from "../../../../../lib";
import { createAuthToken } from "../../../../../lib/user";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, phone } =
      RegisterSchema.parse(body);
    console.log(phone);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        roles: ["USER"], // Default role
      },
    });

    // Create JWT token
    const token = await createAuthToken(user.id, user.roles);

    const responseData = {
      status: 200,
      token: token,
      data: user,
      msg: "User sign in successful",
    };

    const response = NextResponse.json(responseData, { status: 200 });

    // Set auth cookie
    await response.cookies.set({
      name: "auth-token",
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: "none", // Changed from "lax" to "none" for cross-domain
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
      // domain:
      //   process.env.NODE_ENV === "production" ? ".vercel.app" : "localhost", // Allow subdomains
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
        },
        token: token,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
