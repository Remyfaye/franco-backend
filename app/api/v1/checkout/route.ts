// app/api/v1/campaigns/route.ts
import { NextRequest } from "next/server";
import { handleResponse, handleCatch } from "../../../../lib";
import { prisma } from "../../../../lib/db.cjs";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 [GET CAMPAIGNS] Fetching campaigns...");

    const campaigns = await prisma.campaign.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        adCreative: {
          select: {
            id: true,
            fileUrl: true,
            text: true,
            approved: true,
          },
        },
        earnings: {
          select: {
            publisherId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log("✅ [GET CAMPAIGNS] Found campaigns:", campaigns.length);

    // Log campaign details for debugging
    if (campaigns.length > 0) {
      console.log("📊 [GET CAMPAIGNS] Campaign details:");
    } else {
      console.log(
        "❌ [GET CAMPAIGNS] No campaigns found with the current filters"
      );
    }

    return handleResponse(200, "Campaigns retrieved successfully", {
      campaigns,
      total: campaigns.length,
    });
  } catch (error: unknown) {
    console.error("❌ [GET CAMPAIGNS] Error:", error);
    return handleCatch(error);
  }
}
