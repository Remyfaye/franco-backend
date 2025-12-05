// app/api/v1/admin/dashboard/route.ts - UPDATED
import { NextRequest } from "next/server";
import { getCurrentUserWithRoles } from "../../../../../lib/user";
import { handleCatch, handleResponse } from "../../../../../lib";
import { prisma } from "../../../../../lib/db.cjs";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserWithRoles(request);

    if (!user) {
      return handleResponse(401, "Authentication required");
    }

    // Check if user is admin - UPDATED: using enum array
    if (!user.roles.includes("ADMIN")) {
      return handleResponse(403, "Admin access required");
    }

    // Get all stats in parallel for better performance
    const [
      totalPublishers,
      totalAdvertisers,
      totalCampaigns,
      pendingClaims,
      approvedClaims,
      totalPlatformRevenue,
      totalPublisherPayouts,
      pendingWithdrawals,
      expiredReservations,
      recentActions,
    ] = await Promise.all([
      // Total Publishers - UPDATED: using enum array
      prisma.user.count({
        where: {
          roles: {
            has: "PUBLISHER", // Changed from Ur relation to enum array
          },
        },
      }),

      // Total Advertisers - UPDATED: advertisers are now just USERS
      prisma.user.count({
        where: {
          roles: {
            has: "ADVERTISER", // Changed: advertiser role no longer exists
          },
          // Exclude publishers and admins to get pure advertisers
          NOT: {
            OR: [{ roles: { has: "PUBLISHER" } }, { roles: { has: "ADMIN" } }],
          },
        },
      }),

      // Total Campaigns
      prisma.campaign.count(),

      // Pending Claims
      prisma.publisherEarning.count({
        where: { status: "PENDING" },
      }),

      // Approved Claims
      prisma.publisherEarning.count({
        where: { status: "APPROVED" },
      }),

      // TOTAL PLATFORM REVENUE
      prisma.campaign.aggregate({
        _sum: {
          amountPaid: true,
        },
      }),

      // TOTAL PUBLISHER PAYOUTS
      prisma.publisherEarning.aggregate({
        where: {
          status: "APPROVED",
        },
        _sum: {
          amount: true,
        },
      }),

      // Pending Withdrawals
      prisma.withdrawal.count({
        where: { status: "PENDING" },
      }),

      // Expired Reservations
      prisma.campaignReservation.count({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          status: "PENDING",
        },
      }),

      // Recent Admin Actions
      prisma.adminAction.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          admin: {
            select: {
              email: true,
            },
          },
        },
      }),
    ]);

    // Calculate platform profit
    const platformRevenue = totalPlatformRevenue._sum.amountPaid || 0;
    const publisherPayouts = totalPublisherPayouts._sum.amount || 0;
    const platformProfit = platformRevenue - publisherPayouts;

    // Format recent actions
    const formattedRecentActions = recentActions.map((action: any) => ({
      id: action.id,
      actionType: action.actionType,
      description: action.description,
      adminEmail: action.admin.email,
      createdAt: action.createdAt.toISOString(),
    }));

    const stats = {
      totalPublishers,
      totalAdvertisers,
      totalCampaigns,
      pendingClaims,
      approvedClaims,
      platformRevenue,
      publisherPayouts,
      platformProfit,
      pendingWithdrawals,
      expiredReservations,
      campaignCompletionRate:
        totalCampaigns > 0
          ? Math.round((approvedClaims / totalCampaigns) * 100)
          : 0,
      averageCampaignValue:
        totalCampaigns > 0 ? platformRevenue / totalCampaigns : 0,
    };

    return handleResponse(200, "Admin dashboard data retrieved", {
      stats,
      recentActions: formattedRecentActions,
      financialSummary: {
        totalRevenue: platformRevenue,
        totalPayouts: publisherPayouts,
        netProfit: platformProfit,
        profitMargin:
          platformRevenue > 0
            ? Math.round((platformProfit / platformRevenue) * 100)
            : 0,
      },
    });
  } catch (error: unknown) {
    console.error("Admin dashboard error:", error);
    return handleCatch(error);
  }
}
