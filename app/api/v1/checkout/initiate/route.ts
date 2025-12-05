import { NextRequest, NextResponse } from "next/server";

import { nanoid } from "nanoid";
import { prisma } from "../../../../../lib/db.cjs";
import { CheckoutSchema } from "../../../../../lib/validation";
import { getCurrentUser } from "../../../../../lib/user";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { items, email } = CheckoutSchema.parse(body);

    // Calculate total and verify stock
    let totalAmount = 0;
    const productIds = items.map((item) => item.productId);

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });

    for (const item of items) {
      const product = products.find(
        (p: { id: string }) => p.id === item.productId
      );
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        );
      }

      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        );
      }

      totalAmount += product.price * item.quantity;
    }
    const amountInKobo = Math.round(totalAmount * 100);

    // Initialize Paystack payment
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInKobo,
          reference: `order_${productIds[0]}_${nanoid(8)}`,
          callback_url: `http://localhost:3000/cart`,
          metadata: {
            user_id: user.userId,
          },
        }),
      }
    );

    const paystackData = await paystackResponse.json();
    console.log("paystackData", paystackData);

    if (!paystackData.status) {
      return NextResponse.json(
        { error: "Payment initialization failed" },
        { status: 400 }
      );
    }

    // Verify with Paystack
    const paystackVerificationResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${paystackData.data.reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    console.log(
      "paystackVerificationResponse",
      paystackData.data.reference,
      paystackVerificationResponse
    );

    if (paystackVerificationResponse.status !== 200) {
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400 }
      );
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        userId: user.userId,
        totalAmount,
        items: {
          create: items.map((item) => {
            const product = products.find(
              (p: { id: string }) => p.id === item.productId
            )!;
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: product.price,
            };
          }),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // delete cart
    const cart = await prisma.cart.deleteMany({
      where: { userId: user.userId },
    });

    return NextResponse.json({
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
