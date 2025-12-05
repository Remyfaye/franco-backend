import { NextRequest } from "next/server";
import { handleRoleAccess } from "../../../../lib/user";
import { handleCatch, handleResponse } from "../../../../lib";
import { prisma } from "../../../../lib/db.cjs";
import { updateUserSchema } from "../../../../lib/validation";

// Define TypeScript interfaces - UPDATED: removed ur interface
interface Publisher {
  id: string;
  verified: boolean;
  earnings: number;
  platforms: any;
}

interface UserWithRelations {
  id: string;
  email: string;
  username: string | null;
  publisherId: string | null;
  roles: string[]; // UPDATED: directly from enum array
  publisher: Publisher | null;
}

interface UpdateData {
  verified?: boolean;
  platforms?: any;
}

interface UpdatedUser {
  id: string;
  email: string;
  username: string | null;
  createdAt: Date;
  publisherId: string | null;
  roles: string[]; // UPDATED: directly from enum array
  publisher: {
    verified: boolean;
    earnings: number;
    platforms: any;
  } | null;
}

interface ResponseData {
  id: string;
  email: string;
  username: string | null;
  createdAt: Date;
  roles: string[];
  primaryRole: string;
  isPublisher: boolean;
  publisher: {
    verified: boolean;
    earnings: number;
    platforms: any;
  } | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const isAdmin = await handleRoleAccess(request, "ADMIN"); // UPDATED: uppercase
    if (!isAdmin) return handleResponse(401, "User not allowed");

    const userId = params.id;
    const body = await request.json();
    const { verified, platforms } = updateUserSchema.parse(body);

    // Check if user exists and get their role - UPDATED: removed ur include
    const user: UserWithRelations | null = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        publisher: true,
        // REMOVED: ur include since roles are now direct enum array
      },
    });

    if (!user) {
      return handleResponse(404, "User not found");
    }

    const urs: string[] = user.roles; // UPDATED: directly from enum array
    const isPublisher: boolean = urs.includes("PUBLISHER"); // UPDATED: uppercase

    let updateData: UpdateData = {};

    // Only update publisher-specific fields if user is a publisher
    if (isPublisher && user.publisher) {
      if (verified !== undefined) {
        updateData.verified = verified;
      }
      if (platforms !== undefined) {
        updateData.platforms = platforms;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.publisher.update({
          where: { id: user.publisher.id },
          data: updateData,
        });
      }
    } else if (
      (verified !== undefined || platforms !== undefined) &&
      !isPublisher
    ) {
      return handleResponse(
        400,
        "Cannot update publisher fields for non-publisher user"
      );
    }

    // Fetch updated user data - UPDATED: removed ur select
    const updatedUser: UpdatedUser | null = await prisma.user.findUnique({
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
            verified: true,
            earnings: true,
            platforms: true,
          },
        },
      },
    });

    if (!updatedUser) {
      return handleResponse(404, "User not found after update");
    }

    const roles: string[] = updatedUser.roles; // UPDATED: directly from enum array
    const primaryRole: string = roles.length > 0 ? roles[0] : "USER";

    const responseData: ResponseData = {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      createdAt: updatedUser.createdAt,
      roles: roles.map((role) => role.toLowerCase()), // UPDATED: convert to lowercase for frontend compatibility
      primaryRole: primaryRole.toLowerCase(), // UPDATED: convert to lowercase
      isPublisher: roles.includes("PUBLISHER"), // UPDATED: uppercase check
      publisher: updatedUser.publisher,
    };

    return handleResponse(200, "User updated successfully", responseData);
  } catch (error: unknown) {
    return handleCatch(error);
  }
}
