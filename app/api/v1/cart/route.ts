import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db.cjs";
import { getCurrentUser } from "../../../../lib/user";

// GET - Get user's cart
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: user.userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    // If no cart exists, return empty cart
    if (!cart) {
      return NextResponse.json({
        status: 200,
        message: "Cart retrieved successfully",
        data: {
          id: null,
          items: [],
          totalItems: 0,
          totalPrice: 0,
        },
      });
    }

    // Calculate totals
    const totalItems = cart.items.reduce(
      (sum: any, item: { quantity: any }) => sum + item.quantity,
      0
    );
    const totalPrice = cart.items.reduce(
      (sum: number, item: { product: { price: number }; quantity: number }) =>
        sum + item.product.price * item.quantity,
      0
    );

    return NextResponse.json({
      status: 200,
      message: "Cart retrieved successfully",
      data: {
        ...cart,
        totalItems,
        totalPrice,
      },
    });
  } catch (error) {
    console.error("Get cart error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Add item to cart
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Current user:", user);
    const exists = await prisma.user.findUnique({ where: { id: user.userId } });
    console.log("User exists?", exists);

    const { productId, quantity = 1 } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check stock
    if (product.stock < quantity) {
      return NextResponse.json(
        { error: "Insufficient stock" },
        { status: 400 }
      );
    }

    // Find or create cart for user
    let cart = await prisma.cart.findUnique({
      where: { userId: user.userId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId: user.userId,
        },
      });
    }

    // Check if item already exists in cart
    const existingCartItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    let cartItem;
    if (existingCartItem) {
      // Update quantity if item exists
      cartItem = await prisma.cartItem.update({
        where: {
          id: existingCartItem.id,
        },
        data: {
          quantity: existingCartItem.quantity + quantity,
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      });
    } else {
      // Add new item to cart
      cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      });
    }

    // Get updated cart with all items
    const updatedCart = await prisma.cart.findUnique({
      where: { userId: user.userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    // Calculate totals
    const totalItems = updatedCart!.items.reduce(
      (sum: any, item: { quantity: any }) => sum + item.quantity,
      0
    );
    const totalPrice = updatedCart!.items.reduce(
      (sum: number, item: { product: { price: number }; quantity: number }) =>
        sum + item.product.price * item.quantity,
      0
    );

    return NextResponse.json({
      status: 200,
      message: "Item added to cart successfully",
      data: {
        ...updatedCart,
        totalItems,
        totalPrice,
        addedItem: cartItem,
      },
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
