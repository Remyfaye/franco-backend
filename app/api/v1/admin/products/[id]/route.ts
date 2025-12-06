import { NextRequest, NextResponse } from "next/server";
import { ProductSchema } from "../../../../../../lib/validation";
import {
  deleteMultipleFromR2,
  uploadMultipleToR2WithSDK,
} from "../../../../../../lib/cloudflare";
import {
  getCurrentUserWithRoles,
  getFullUser,
} from "../../../../../../lib/user";
import { prisma } from "../../../../../../lib/db.cjs";
import { createAdminLog } from "../../../../../../lib/utils";

// PUT update product
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getFullUser(request);
    if (!user || !user.roles.includes("ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();

    // Extract text fields
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const price = parseInt(formData.get("price") as string);
    const stock = parseInt(formData.get("stock") as string);
    const categoryId = formData.get("categoryId") as string;
    const oldPrice = formData.get("oldPrice") as string;
    const discountPercentage = formData.get("discountPercentage") as string;
    const label = formData.get("label") as string;
    const existingImages = formData.get("existingImages") as string;

    // Parse existing images (comma-separated string)
    const existingImageUrls = existingImages ? existingImages.split(",") : [];

    // Extract new image files
    const newImageFiles: File[] = [];
    const images = formData.getAll("images");

    for (const image of images) {
      if (image instanceof File && image.size > 0) {
        newImageFiles.push(image);
      }
    }

    console.log(
      `Updating product: "${name}" with ${newImageFiles.length} new images and ${existingImageUrls.length} existing images`
    );

    // Validate required fields
    if (!name || !price || !categoryId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: name, price, and category are required",
        },
        { status: 400 }
      );
    }

    const paramsId = await params.id;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id: paramsId },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let newImageUrls: string[] = [];

    // Upload new images if any
    if (newImageFiles.length > 0) {
      try {
        newImageUrls = await uploadMultipleToR2WithSDK(newImageFiles);
        console.log(`Uploaded ${newImageUrls.length} new images successfully`);
      } catch (uploadError) {
        console.error("Image upload failed:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload product images. Please try again." },
          { status: 500 }
        );
      }
    }

    // Combine existing and new images
    const allImageUrls = [...existingImageUrls, ...newImageUrls];

    if (allImageUrls.length === 0) {
      return NextResponse.json(
        { error: "At least one product image is required" },
        { status: 400 }
      );
    }

    // Prepare product data

    const productData = {
      name: name.trim(),
      description: description?.toString().trim() || "",
      price,
      oldPrice: oldPrice ? parseInt(oldPrice) : null,
      discountPercentage: discountPercentage
        ? parseInt(discountPercentage)
        : null,
      label: label?.toString().trim() || null,
      stock: stock || 0,
      categoryId,
      imageUrls: allImageUrls,
    };

    // Validate with Zod schema
    const validatedData = ProductSchema.parse(productData);

    // Update product in database
    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        category: true,
      },
    });

    return NextResponse.json({
      status: 200,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Product update error:", error);

    if (error instanceof Error) {
      if (error.message.includes("upload")) {
        return NextResponse.json(
          { error: "File upload service unavailable" },
          { status: 503 }
        );
      }

      if (error.message.includes("validation")) {
        return NextResponse.json(
          { error: "Invalid product data: " + error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE endpoint to delete a product
export async function DELETE(request: NextRequest) {
  try {
    const user = await getFullUser(request);
    if (!user || !user.roles.includes("ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    // Fetch product details for logging and image deletion
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        imageUrls: true,
        price: true,
        categoryId: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Extract keys from image URLs for R2 deletion
    const keys = product.imageUrls.map((url: string) =>
      url.replace(`https://${process.env.CLOUDFLARE_PUBLIC_URL}/`, "")
    );

    // Delete images from R2
    await deleteMultipleFromR2(keys);

    // Delete product from database
    await prisma.product.delete({
      where: { id },
    });

    // Create admin log
    await createAdminLog(user.userId, "DELETE", "PRODUCT", product.id, {
      name: product.name,
      price: product.price,
      category: product.categoryId,
      imageCount: product.imageUrls.length,
    });

    return NextResponse.json(
      {
        status: 200,
        message: "Product deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Product deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
