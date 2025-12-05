import { NextRequest } from "next/server";
import { handleRoleAccess } from "../../../../../lib/user";
import { handleResponse, handleCatch } from "../../../../../lib";
import { prisma } from "../../../../../lib/db.cjs";

// Define TypeScript interfaces for the response data - UPDATED: removed UserRole interface
interface Publisher {
  id: string;
  verified: boolean;
  earnings: number;
  platforms: any;
}

interface AdCreative {
  fileUrl: string;
  text: string | null;
  approved: boolean;
}

interface Campaign {
  id: string;
  platform: string;
  budget: number;
  status: string;
  impressions: number;
  clicks: number;
  createdAt: Date;
  duration: number;
  adCreative: AdCreative | null;
}

interface User {
  id: string;
  email: string;
  username: string | null;
  createdAt: Date;
  publisherId: string | null;
  roles: string[]; // UPDATED: directly from enum array
  publisher: Publisher | null;
  campaigns: Campaign[];
}

interface FormattedUser {
  id: string;
  email: string;
  username: string | null;
  createdAt: Date;
  roles: string[];
  primaryRole: string;
  isPublisher: boolean;
  publisher: Publisher | null;
  campaigns: Campaign[];
  campaignStats: {
    total: number;
    active: number;
    completed: number;
    totalBudget: number;
    totalImpressions: number;
    totalClicks: number;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const isAdmin = await handleRoleAccess(request, "ADMIN"); // UPDATED: uppercase
    if (!isAdmin) return handleResponse(401, "User not allowed");

    const userId = params.id;

    const user: User | null = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
        publisherId: true,
        roles: true, // UPDATED: directly from enum array
        publisher: {
          select: {
            id: true,
            verified: true,
            earnings: true,
            platforms: true,
          },
        },
        campaigns: {
          select: {
            id: true,
            platform: true,
            budget: true,
            status: true,
            impressions: true,
            clicks: true,
            createdAt: true,
            duration: true,
            adCreative: {
              select: {
                fileUrl: true,
                text: true,
                approved: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!user) {
      return handleResponse(404, "User not found");
    }

    const roles: string[] = user.roles; // UPDATED: directly from enum array
    const primaryRole: string = roles.length > 0 ? roles[0] : "USER";

    const formattedUser: FormattedUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
      roles: roles.map((role) => role.toLowerCase()), // UPDATED: convert to lowercase for frontend compatibility
      primaryRole: primaryRole.toLowerCase(), // UPDATED: convert to lowercase
      isPublisher: roles.includes("PUBLISHER"), // UPDATED: uppercase check
      publisher: user.publisher,
      campaigns: user.campaigns,
      campaignStats: {
        total: user.campaigns.length,
        active: user.campaigns.filter((c: Campaign) => c.status === "ACTIVE")
          .length,
        completed: user.campaigns.filter(
          (c: Campaign) => c.status === "COMPLETED"
        ).length,
        totalBudget: user.campaigns.reduce(
          (sum: number, campaign: Campaign) => sum + campaign.budget,
          0
        ),
        totalImpressions: user.campaigns.reduce(
          (sum: number, campaign: Campaign) => sum + campaign.impressions,
          0
        ),
        totalClicks: user.campaigns.reduce(
          (sum: number, campaign: Campaign) => sum + campaign.clicks,
          0
        ),
      },
    };

    return handleResponse(200, "User retrieved successfully", formattedUser);
  } catch (error: unknown) {
    return handleCatch(error);
  }
}
