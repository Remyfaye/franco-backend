import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../lib/user";
import { prisma } from "../../../../../lib/db.cjs";

// PUT - Update cart item quantity
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { quantity } = await request.json();

    if (quantity < 1) {
      return NextResponse.json(
        { error: "Quantity must be at least 1" },
        { status: 400 }
      );
    }

    // Find the cart item
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: params.id },
      include: {
        cart: true,
        product: true,
      },
    });

    if (!cartItem || cartItem.cart.userId !== user.userId) {
      return NextResponse.json(
        { error: "Cart item not found" },
        { status: 404 }
      );
    }

    // Check stock
    if (cartItem.product.stock < quantity) {
      return NextResponse.json(
        { error: "Insufficient stock" },
        { status: 400 }
      );
    }

    // Update quantity
    const updatedCartItem = await prisma.cartItem.update({
      where: { id: params.id },
      data: { quantity },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    return NextResponse.json({
      status: 200,
      message: "Cart item updated successfully",
      data: updatedCartItem,
    });
  } catch (error) {
    console.error("Update cart item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Remove item from cart
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the cart item
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: params.id },
      include: {
        cart: true,
      },
    });

    if (!cartItem || cartItem.cart.userId !== user.userId) {
      return NextResponse.json(
        { error: "Cart item not found" },
        { status: 404 }
      );
    }

    // Delete the cart item
    await prisma.cartItem.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      status: 200,
      message: "Item removed from cart successfully",
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
