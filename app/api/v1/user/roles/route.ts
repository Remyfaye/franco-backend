// app/api/v1/user/roles/route.ts
import { NextRequest } from "next/server";
import { handleResponse, handleCatch } from "../../../../../lib";
import { getCurrentUserWithRoles } from "../../../../../lib/user";
import { prisma } from "../../../../../lib/db.cjs";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserWithRoles(request);
    if (!user) return handleResponse(401, "Authentication required");

    const { action, role } = await request.json();

    if (!action || !role) {
      return handleResponse(400, "Action and role are required");
    }

    // Prevent users from adding admin role
    if (role === "ADMIN") {
      return handleResponse(403, "Cannot add admin role");
    }

    // Only allow PUBLISHER and ADVERTISER roles
    if (!["PUBLISHER", "ADVERTISER"].includes(role)) {
      return handleResponse(400, "Invalid role");
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { roles: true },
    });

    if (!currentUser) {
      return handleResponse(404, "User not found");
    }

    if (action === "add") {
      // Check if role already exists
      if (currentUser.roles.includes(role)) {
        return handleResponse(400, `You are already a ${role.toLowerCase()}`);
      }

      // Add the new role
      const updatedRoles = [...currentUser.roles, role];

      await prisma.user.update({
        where: { id: user.userId },
        data: { roles: updatedRoles },
      });

      // Create publisher if needed
      if (role === "PUBLISHER") {
        const publisher = await prisma.publisher.create({
          data: {
            userId: user.userId,
            verified: false,
            earnings: 0,
          },
        });

        await prisma.publisherAccount.create({
          data: {
            publisherId: publisher.id,
            totalEarnings: 0,
            availableBalance: 0,
            pendingBalance: 0,
            isVerified: false,
          },
        });
      }

      return handleResponse(200, `You are now a ${role.toLowerCase()}!`, {
        newRoles: updatedRoles,
      });
    } else if (action === "switch") {
      // For switching, we just return success - the frontend will handle the dashboard switch
      return handleResponse(200, "Dashboard switched successfully", {
        currentRoles: currentUser.roles,
      });
    } else {
      return handleResponse(400, "Invalid action");
    }
  } catch (error: unknown) {
    return handleCatch(error);
  }
}
