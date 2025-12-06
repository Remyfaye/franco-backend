import { NextRequest } from "next/server";
import { prisma } from "../../../../../../lib/db.cjs";
import { handleResponse } from "../../../../../../lib";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const updated = await prisma.order.update({
      where: { id: params.id },
      data: {
        deliveryStatus: body.deliveryStatus,
      },
    });

    return handleResponse(200, "Order updated", updated);
  } catch (error) {
    return handleResponse(500, "Failed to update order", error);
  }
}
