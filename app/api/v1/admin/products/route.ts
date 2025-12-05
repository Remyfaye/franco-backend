import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRoles, getFullUser } from "../../../../../lib/user";
import { ProductSchema } from "../../../../../lib/validation";
import { prisma } from "../../../../../lib/db.cjs";
import { createAdminLog } from "../../../../../lib/utils";
import {
  uploadMultipleToR2WithSDK,
  deleteMultipleFromR2,
} from "../../../../../lib/cloudflare"; // Import delete function

export async function POST(request: NextRequest) {
  try {
    // const user = await getFullUser(request);
    // if (!user || !user.roles.includes("ADMIN")) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // Check environment variables
    const requiredEnvVars = [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_ACCESS_KEY_ID",
      "CLOUDFLARE_SECRET_ACCESS_KEY",
      "CLOUDFLARE_BUCKET_NAME",
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar]
    );
    if (missingEnvVars.length > 0) {
      console.error("Missing environment variables:", missingEnvVars);
      return NextResponse.json(
        { error: "Server configuration error - missing R2 credentials" },
        { status: 500 }
      );
    }

    const formData = await request.formData();

    // DEBUG: Log all formData entries
    console.log("==== ALL FORM DATA ENTRIES ====");
    const allEntries: { [key: string]: any } = {};
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        allEntries[key] = `[File] ${value.name} (${value.size} bytes)`;
      } else {
        allEntries[key] = value;
      }
    }
    console.log("FormData contents:", allEntries);

    // Extract text fields
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const price = parseInt(formData.get("price") as string);
    const stock = parseInt(formData.get("stock") as string);
    const categoryId = formData.get("categoryId") as string;
    const oldPrice = formData.get("oldPrice") as string;
    const discountPercentage = formData.get("discountPercentage") as string;
    const label = formData.get("label") as string;

    // FIX: Extract image files properly
    const imageFiles: File[] = [];

    // Method 1: Get all entries with key "images"
    const images = formData.getAll("images");
    console.log(`Found ${images.length} images with key 'images'`);

    for (const image of images) {
      if (image instanceof File && image.size > 0) {
        imageFiles.push(image);
        console.log(`Added image: ${image.name} (${image.size} bytes)`);
      }
    }

    // Method 2: Also check for indexed images (images[0], images[1], etc.)
    if (imageFiles.length === 0) {
      let index = 0;
      while (true) {
        const image = formData.get(`images[${index}]`) as File;
        if (!image || image.size === 0) break;
        imageFiles.push(image);
        console.log(`Added indexed image[${index}]: ${image.name}`);
        index++;
      }
    }

    console.log(`Creating product: "${name}" with ${imageFiles.length} images`);
    console.log("Product data:", {
      name,
      price,
      categoryId,
      images: imageFiles,
      imageCount: imageFiles.length,
    });

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

    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: "Please upload At least one product image" },
        { status: 400 }
      );
    }

    let imageUrls: string[] = [];

    try {
      console.log("Starting image upload to Cloudflare R2...");
      // Use fetch-based upload (more reliable)
      imageUrls = await uploadMultipleToR2WithSDK(imageFiles);
      console.log(`Uploaded ${imageUrls.length} images successfully`);
      console.log("Image URLs:", imageUrls);
    } catch (uploadError) {
      console.error("Image upload failed:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload product images. Please try again." },
        { status: 500 }
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
      imageUrls,
    };

    console.log("Final product data for database:", {
      ...productData,
      imageUrls: productData.imageUrls.slice(0, 2), // Log first 2 URLs only
    });

    // Validate with Zod schema
    const validatedData = ProductSchema.parse(productData);

    // Create product in database
    const product = await prisma.product.create({
      data: validatedData,
      include: {
        category: true,
      },
    });

    return NextResponse.json(
      {
        status: 201,
        message: "Product created successfully",
        data: product,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Product creation error:", error);

    if (error instanceof Error) {
      // Handle specific error types
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

// GET endpoint to retrieve all products
export async function GET(request: NextRequest) {
  try {
    // Optional: Check if user is authenticated (uncomment if needed)
    // const user = await getCurrentUserWithRoles(request);
    // if (!user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const { searchParams } = new URL(request.url);

    // Get query parameters for filtering and pagination

    const categoryId = searchParams.get("categoryId");

    // Build where clause for filtering
    const where: any = {
      isActive: true, // Only get active products
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Get products with pagination and filtering
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },

        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json(
      {
        status: 200,
        message: "Products retrieved successfully",
        data: {
          products,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE endpoint to delete a product
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUserWithRoles(request);
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
