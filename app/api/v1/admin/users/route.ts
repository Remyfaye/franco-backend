// app/api/v1/admin/users/route.ts - UPDATED
import { NextRequest } from "next/server";
import { handleResponse, handleCatch } from "../../../../../lib";
import { prisma } from "../../../../../lib/db.cjs";
import { getCurrentUserWithRoles } from "../../../../../lib/user";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserWithRoles(request);
    if (!user) return handleResponse(401, "Authentication required");

    const isAdmin = user.roles.includes("ADMIN"); // UPDATED: uppercase
    if (!isAdmin) {
      return handleResponse(403, "Admin access required");
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role"); // 'publisher', 'advertiser', or null for all
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Build where clause based on role filter - UPDATED: using enum array
    let where: any = {};

    if (role === "publisher") {
      where = {
        roles: {
          has: "PUBLISHER", // UPDATED: enum array check
        },
      };
    } else if (role === "advertiser") {
      where = {
        roles: {
          has: "USER", // UPDATED: advertiser is now USER role
        },
        // Exclude publishers and admins to get pure advertisers
        NOT: {
          OR: [{ roles: { has: "PUBLISHER" } }, { roles: { has: "ADMIN" } }],
        },
      };
    }

    const [users, total] = await Promise.all([
      // Get users with all necessary relations - UPDATED: removed Ur
      prisma.user.findMany({
        where,
        include: {
          publisher: {
            include: {
              account: true,
              strikes: { where: { resolvedAt: null } },
              earningsHistory: {
                include: {
                  campaign: true,
                },
              },
              withdrawals: true,
            },
          },
          campaigns: {
            include: {
              earnings: true,
              transactions: true,
            },
          },
          // REMOVED: ur include
          transactions: {
            where: {
              type: "CAMPAIGN_PAYMENT",
            },
            select: {
              amount: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      // Get total count
      prisma.user.count({ where }),
    ]);

    console.log("total users", users.length);

    // Format response with comprehensive stats - UPDATED: roles from enum array
    const formattedUsers = users.map((user) => {
      const roles = user.roles; // UPDATED: directly from enum array
      const isPublisher = roles.includes("PUBLISHER"); // UPDATED: uppercase
      const isAdvertiser = roles.includes("ADVERTISER");
      // Calculate publisher stats
      const publisherStats = user.publisher
        ? {
            verified: user.publisher.verified,
            totalEarnings: user.publisher.account?.totalEarnings || 0,
            availableBalance: user.publisher.account?.availableBalance || 0,
            pendingBalance: user.publisher.account?.pendingBalance || 0,
            activeStrikes: user.publisher.strikes.length,
            totalClaims: user.publisher.earningsHistory.length,
            approvedClaims: user.publisher.earningsHistory.filter(
              (e) => e.status === "APPROVED" || e.status === "PAID"
            ).length,
            pendingClaims: user.publisher.earningsHistory.filter(
              (e) => e.status === "PENDING"
            ).length,
            totalWithdrawals: user.publisher.withdrawals.length,
            pendingWithdrawals: user.publisher.withdrawals.filter(
              (w) => w.status === "PENDING"
            ).length,
          }
        : null;

      // Calculate advertiser stats
      const totalCampaignSpent = user.campaigns.reduce(
        (sum, campaign) => sum + campaign.amountPaid,
        0
      );
      const totalTransactions = user.transactions.reduce(
        (sum, transaction) => sum + transaction.amount,
        0
      );

      const advertiserStats =
        user.campaigns.length > 0
          ? {
              totalCampaigns: user.campaigns.length,
              activeCampaigns: user.campaigns.filter(
                (c) => c.status === "ACTIVE"
              ).length,
              completedCampaigns: user.campaigns.filter(
                (c) => c.status === "COMPLETED"
              ).length,
              totalSpent: totalCampaignSpent,
              totalTransactions: totalTransactions,
              totalPublisherInteractions: user.campaigns.reduce(
                (sum, campaign) => sum + campaign.earnings.length,
                0
              ),
              averageCampaignBudget:
                user.campaigns.length > 0
                  ? totalCampaignSpent / user.campaigns.length
                  : 0,
            }
          : null;

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
        roles: roles.map((role) => role.toLowerCase()), // UPDATED: convert to lowercase for frontend compatibility
        isPublisher,
        isAdvertiser,
        publisherStats,
        advertiserStats,
        campaignStats: {
          total: user.campaigns.length,
          active: user.campaigns.filter((c) => c.status === "ACTIVE").length,
        },
      };
    });

    return handleResponse(200, "Users retrieved successfully", {
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error("Admin users route error:", error);
    return handleCatch(error);
  }
}
