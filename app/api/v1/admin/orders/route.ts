import { NextRequest } from "next/server";
import { prisma } from "../../../../../lib/db.cjs";
import { handleResponse } from "../../../../../lib";

export async function GET(request: NextRequest) {
  try {
    const orders = await prisma.order.findMany({
      include: { user: true, items: { include: { product: true } } },
    });

    if (!orders) {
      return handleResponse(404, "No Orders found");
    }

    return handleResponse(200, "Orders retrieved", orders);
  } catch (error) {
    return handleResponse(500, "Orders retrieved", error);
  }
}
