import { NextRequest, NextResponse } from "next/server";
import { handleCatch, handleResponse } from "../../../../../lib";
import { prisma } from "../../../../../lib/db.cjs";
import { getCurrentUser } from "../../../../../lib/user";

// Enhanced interfaces - UPDATED: removed UserRole interface
interface PublisherWithAccount {
  id: string;
  verified: boolean;
  platforms: any;
  earnings: number;
  account?: {
    id: string;
    bankName: string | null;
    accountNumber: string | null;
    accountName: string | null;
    isVerified: boolean;
    totalEarnings: number;
    availableBalance: number;
    pendingBalance: number;
  } | null;
  earningsHistory?: {
    id: string;
    views: number;
    status: string;
    accountName: string | null;
    proofImage: string;
    extractedViews: number;
    campaigns?: Array<{
      id: string;
      title: string;
      status: string;
      platform: string;
      views: number;
      amountPaid: number;
      category: string;
    }>;
  } | null;
}

interface UserWithRelations {
  id: string;
  email: string;
  firstName: string | null;
  createdAt: Date;
  roles: string[]; // UPDATED: directly from enum array
  publisher?: PublisherWithAccount | null;
  campaigns?: Array<{
    id: string;
    title: string;
    status: string;
    platform: string;
    views: number;
    amountPaid: number;
    category: string;
    earnings?: Array<{
      id: string;
      publisherId: string;
      status: string;
    }>;
  }>;
  transactions?: Array<{
    id: string;
    type: string;
    status: string;
    userId: string;
    amount: number;
    campaignId: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    console.log("🍪 [auth/me] Incoming cookies:", request.cookies.getAll());
    console.log(
      "🔑 [auth/me] Auth header:",
      request.headers.get("authorization")
    );

    // 1. Get User from token
    const user = await getCurrentUser(request);
    // console.log("👤 [auth/me] User from token:", user);

    if (!user) {
      console.log("❌ [auth/me] No user found from token - returning 401");
      // Create response manually to avoid the Promise issue
      const response = NextResponse.json(
        { status: 401, message: "Authentication required", data: null },
        { status: 401 }
      );

      return response;
    }

    // 2. Retrieve user info from database - UPDATED: removed UserRole include
    const userData: UserWithRelations | null = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!userData) {
      console.log("❌ [auth/me] User not found in database");
      // Create response manually to avoid the Promise issue
      const response = NextResponse.json(
        { status: 404, message: "User not found", data: null },
        { status: 401 }
      );

      return response;
    }

    // 3. Extract roles - UPDATED: directly from user.roles
    const roles: string[] = userData.roles; // This is now the enum array

    // 7. Format response data - UPDATED: role logic
    const responseData = {
      id: userData.id,
      email: userData.email,
      name: userData.firstName,
      createdAt: userData.createdAt,
      roles: roles.map((role) => role.toLowerCase()), // UPDATED: convert to lowercase for frontend compatibility
    };

    console.log("✅ [auth/me] User data retrieved successfully");

    // Create response manually to avoid the Promise issue
    const response = NextResponse.json(
      {
        status: 200,
        message: "User data retrieved successfully",
        data: responseData,
      },
      { status: 200 }
    );

    return response;
  } catch (error: unknown) {
    console.error("🔴 [auth/me] Error:", error);
    // Create error response manually to avoid the Promise issue
    const response = NextResponse.json(
      {
        status: 500,
        message: "Internal server error",
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );

    return response;
  }
}
