import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  getCurrentUserWithRoles,
  getFullUser,
} from "../../../../../lib/user";
import { CategorySchema } from "../../../../../lib/validation";
import { prisma } from "../../../../../lib/db.cjs";
import { createAdminLog } from "../../../../../lib/utils";

export async function POST(request: NextRequest) {
  try {
    const user = await getFullUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.roles.includes("ADMIN");
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Not admin", user: user },
        { status: 401 }
      );
    }

    const body = await request.json();
    const categoryData = CategorySchema.parse(body);

    const category = await prisma.category.create({
      data: categoryData,
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("category creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserWithRoles(request);
    // if (!user || !user.roles.includes("ADMIN")) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const { searchParams } = new URL(request.url);

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        include: { products: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.category.count(),
    ]);

    return NextResponse.json(
      {
        message: "Categories retrieved",
        data: categories,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("categories fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getFullUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.roles.includes("ADMIN");
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Not admin", user: user },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const categoryData = CategorySchema.parse(body);

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: categoryData,
    });

    return NextResponse.json(
      {
        message: "Category updated successfully",
        data: updatedCategory,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Category update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getFullUser(request);
    if (!user) {
      console.log("User not logged in");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.roles.includes("ADMIN");
    if (!isAdmin) {
      console.log("User not admin", user);
      return NextResponse.json(
        { error: "Not admin", user: user },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Check if category has associated products
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete category that has associated products" },
        { status: 400 }
      );
    }

    // Delete the category
    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        message: "Category deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Category deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
