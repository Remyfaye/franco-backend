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
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  console.log(`[${requestId}] === POST /admin/products START ===`);
  console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);

  try {
    console.log(`[${requestId}] Step 1: Authentication check`);
    const user = await getFullUser(request);
    if (!user) {
      console.log(`[${requestId}] ERROR: No user found`);
      return NextResponse.json(
        { error: "Unauthorized - No user session" },
        { status: 401 }
      );
    }

    if (!user.roles.includes("ADMIN")) {
      console.log(
        `[${requestId}] ERROR: User not admin. User roles:`,
        user.roles
      );
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 401 }
      );
    }

    console.log(`[${requestId}] ✓ Authenticated as admin: ${user.userId}`);

    // Step 2: Environment validation
    console.log(`[${requestId}] Step 2: Environment validation`);
    const envStatus = {
      CLOUDFLARE_ACCOUNT_ID: !!process.env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_ACCESS_KEY_ID: !!process.env.CLOUDFLARE_ACCESS_KEY_ID,
      CLOUDFLARE_SECRET_ACCESS_KEY: !!process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
      CLOUDFLARE_BUCKET_NAME: !!process.env.CLOUDFLARE_BUCKET_NAME,
      DATABASE_URL: !!process.env.DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
    };

    console.log(`[${requestId}] Environment status:`, envStatus);

    const missingEnvVars = Object.entries(envStatus)
      .filter(([_, exists]) => !exists)
      .map(([key]) => key);

    if (missingEnvVars.length > 0) {
      console.error(
        `[${requestId}] ERROR: Missing environment variables:`,
        missingEnvVars
      );
      return NextResponse.json(
        {
          error: "Server configuration error",
          details: `Missing: ${missingEnvVars.join(", ")}`,
          requestId,
        },
        { status: 500 }
      );
    }
    console.log(`[${requestId}] ✓ Environment validation passed`);

    // Step 3: Parse form data
    console.log(`[${requestId}] Step 3: Parsing form data`);
    let formData: FormData;
    try {
      formData = await request.formData();
      console.log(`[${requestId}] ✓ FormData parsed successfully`);
    } catch (formDataError: any) {
      console.error(
        `[${requestId}] ERROR: Failed to parse form data:`,
        formDataError
      );
      return NextResponse.json(
        {
          error: "Invalid request format",
          details: "Could not parse form data",
          message: formDataError.message,
          requestId,
        },
        { status: 400 }
      );
    }

    // Debug: Log all formData entries
    console.log(`[${requestId}] === FORM DATA ANALYSIS ===`);
    const formDataEntries: { [key: string]: any } = {};
    let totalFormEntries = 0;
    for (const [key, value] of formData.entries()) {
      totalFormEntries++;
      if (value instanceof File) {
        formDataEntries[key] = {
          type: "File",
          name: value.name,
          size: value.size,
          // type: value.type,
          lastModified: value.lastModified,
        };
      } else {
        formDataEntries[key] = {
          type: "Text",
          value: value,
          length: value.toString().length,
        };
      }
    }
    console.log(`[${requestId}] Total form entries: ${totalFormEntries}`);
    console.log(`[${requestId}] Form keys:`, Object.keys(formDataEntries));

    // Extract and log specific fields
    const extractedFields = {
      name: formData.get("name"),
      price: formData.get("price"),
      categoryId: formData.get("categoryId"),
      description: formData.get("description"),
      stock: formData.get("stock"),
      imagesCount: formData.getAll("images").length,
    };
    console.log(`[${requestId}] Extracted fields:`, extractedFields);

    // Step 4: Extract text fields with validation
    console.log(`[${requestId}] Step 4: Extracting and validating fields`);
    const name = formData.get("name") as string;
    const priceStr = formData.get("price") as string;
    const categoryId = formData.get("categoryId") as string;
    const description = formData.get("description") as string;
    const stockStr = formData.get("stock") as string;
    const oldPriceStr = formData.get("oldPrice") as string;
    const discountPercentageStr = formData.get("discountPercentage") as string;
    const label = formData.get("label") as string;

    // Parse numeric values with error handling
    let price: number, stock: number;
    try {
      price = parseInt(priceStr);
      if (isNaN(price)) throw new Error(`Invalid price: "${priceStr}"`);

      stock = parseInt(stockStr || "0");
      if (isNaN(stock)) throw new Error(`Invalid stock: "${stockStr}"`);
    } catch (parseError: any) {
      console.error(
        `[${requestId}] ERROR: Failed to parse numbers:`,
        parseError.message
      );
      return NextResponse.json(
        {
          error: "Invalid numeric values",
          details: parseError.message,
          requestId,
        },
        { status: 400 }
      );
    }

    const oldPrice = oldPriceStr ? parseInt(oldPriceStr) : null;
    const discountPercentage = discountPercentageStr
      ? parseInt(discountPercentageStr)
      : null;

    // Step 5: Validate required fields
    const validationErrors: string[] = [];
    if (!name || name.trim().length === 0)
      validationErrors.push("Name is required");
    if (!price || price <= 0) validationErrors.push("Valid price is required");
    if (!categoryId || categoryId.trim().length === 0)
      validationErrors.push("Category is required");

    if (validationErrors.length > 0) {
      console.error(
        `[${requestId}] ERROR: Validation failed:`,
        validationErrors
      );
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationErrors,
          requestId,
        },
        { status: 400 }
      );
    }
    console.log(`[${requestId}] ✓ Field validation passed`);

    // Step 6: Extract image files
    console.log(`[${requestId}] Step 5: Extracting image files`);
    const imageFiles: File[] = [];

    // Try multiple methods to get images
    const images = formData.getAll("images");
    console.log(
      `[${requestId}] Found ${images.length} images via formData.getAll('images')`
    );

    for (const [index, image] of images.entries()) {
      if (image instanceof File) {
        if (image.size > 0 && image.type.startsWith("image/")) {
          imageFiles.push(image);
          console.log(
            `[${requestId}]   Image ${index}: ${image.name} (${image.size} bytes, ${image.type})`
          );
        } else {
          console.warn(
            `[${requestId}]   Skipping image ${index}: invalid file (size: ${image.size}, type: ${image.type})`
          );
        }
      } else {
        console.warn(
          `[${requestId}]   Skipping non-file entry at index ${index}:`,
          typeof image
        );
      }
    }

    // Check for alternative naming patterns
    if (imageFiles.length === 0) {
      console.log(
        `[${requestId}] No images found with key 'images', checking alternatives...`
      );

      // Check for files with any key containing 'image'
      for (const [key, value] of formData.entries()) {
        if (value instanceof File && value.type.startsWith("image/")) {
          console.log(
            `[${requestId}]   Found image with key "${key}": ${value.name}`
          );
          imageFiles.push(value);
        }
      }

      // Check for uploadedFiles, files, photos, etc.
      const alternativeKeys = [
        "uploadedFiles",
        "files",
        "photos",
        "productImages",
        "image",
      ];
      for (const key of alternativeKeys) {
        const files = formData.getAll(key);
        if (files.length > 0) {
          console.log(
            `[${requestId}]   Found ${files.length} files with key "${key}"`
          );
        }
      }
    }

    console.log(
      `[${requestId}] Total valid images found: ${imageFiles.length}`
    );

    if (imageFiles.length === 0) {
      console.error(`[${requestId}] ERROR: No valid images found`);
      return NextResponse.json(
        {
          error: "Image upload required",
          details:
            "Please upload at least one valid image file (JPG, PNG, etc.)",
          debug: `Found ${images.length} entries with key 'images', but ${imageFiles.length} were valid files`,
          requestId,
        },
        { status: 400 }
      );
    }

    // Step 7: Upload images to R2
    console.log(
      `[${requestId}] Step 6: Uploading ${imageFiles.length} images to Cloudflare R2`
    );
    let imageUrls: string[] = [];

    try {
      console.log(`[${requestId}] Starting R2 upload...`);
      console.log(`[${requestId}] R2 Config:`, {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.substring(0, 10) + "...",
        bucketName: process.env.CLOUDFLARE_BUCKET_NAME,
        publicUrl: process.env.CLOUDFLARE_PUBLIC_URL,
      });

      const uploadStartTime = Date.now();
      imageUrls = await uploadMultipleToR2WithSDK(imageFiles);
      const uploadDuration = Date.now() - uploadStartTime;

      console.log(`[${requestId}] ✓ Upload completed in ${uploadDuration}ms`);
      console.log(`[${requestId}] Generated ${imageUrls.length} URLs`);

      if (imageUrls.length > 0) {
        console.log(
          `[${requestId}] First URL (truncated): ${imageUrls[0].substring(
            0,
            100
          )}...`
        );
      } else {
        console.error(
          `[${requestId}] WARNING: uploadMultipleToR2WithSDK returned empty array!`
        );
      }
    } catch (uploadError: any) {
      console.error(`[${requestId}] ERROR: R2 upload failed:`, {
        message: uploadError.message,
        stack: uploadError.stack,
        name: uploadError.name,
      });

      // Check for specific R2 errors
      let errorDetails = "Failed to upload images to storage";
      if (
        uploadError.message.includes("credentials") ||
        uploadError.message.includes("auth")
      ) {
        errorDetails = "Storage service authentication failed";
      } else if (uploadError.message.includes("bucket")) {
        errorDetails = "Storage bucket not found or inaccessible";
      } else if (uploadError.message.includes("network")) {
        errorDetails = "Network error connecting to storage service";
      }

      return NextResponse.json(
        {
          error: "Image upload failed",
          details: errorDetails,
          message: uploadError.message,
          requestId,
        },
        { status: 500 }
      );
    }

    // Step 8: Prepare product data
    console.log(`[${requestId}] Step 7: Preparing product data`);
    const productData = {
      name: name.trim(),
      description: (description || "").toString().trim(),
      price,
      oldPrice: oldPrice && !isNaN(oldPrice) ? oldPrice : null,
      discountPercentage:
        discountPercentage && !isNaN(discountPercentage)
          ? discountPercentage
          : null,
      label: label ? label.trim() : null,
      stock: stock || 0,
      categoryId: categoryId.trim(),
      imageUrls,
    };

    console.log(`[${requestId}] Product data prepared:`, {
      ...productData,
      imageUrls: `[${productData.imageUrls.length} URLs]`,
      descriptionLength: productData.description.length,
    });

    // Step 9: Validate with Zod schema
    console.log(`[${requestId}] Step 8: Zod validation`);
    let validatedData;
    try {
      validatedData = ProductSchema.parse(productData);
      console.log(`[${requestId}] ✓ Zod validation passed`);
    } catch (zodError: any) {
      console.error(`[${requestId}] ERROR: Zod validation failed:`, {
        errors: zodError.errors,
        productData,
      });
      return NextResponse.json(
        {
          error: "Data validation failed",
          details: zodError.errors?.map(
            (e: any) => `${e.path.join(".")}: ${e.message}`
          ) || [zodError.message],
          requestId,
        },
        { status: 400 }
      );
    }

    // Step 10: Save to database
    console.log(`[${requestId}] Step 9: Saving to database`);
    let product;
    try {
      // Verify category exists first
      const categoryExists = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });

      if (!categoryExists) {
        console.error(
          `[${requestId}] ERROR: Category not found: ${categoryId}`
        );
        return NextResponse.json(
          {
            error: "Invalid category",
            details: `Category with ID ${categoryId} does not exist`,
            requestId,
          },
          { status: 400 }
        );
      }

      const dbStartTime = Date.now();
      product = await prisma.product.create({
        data: validatedData,
        include: {
          category: true,
        },
      });
      const dbDuration = Date.now() - dbStartTime;

      console.log(
        `[${requestId}] ✓ Database save completed in ${dbDuration}ms`
      );
      console.log(`[${requestId}] Product created with ID: ${product.id}`);
    } catch (dbError: any) {
      console.error(`[${requestId}] ERROR: Database operation failed:`, {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta,
      });

      // Try to clean up uploaded images if database fails
      if (imageUrls.length > 0) {
        console.log(
          `[${requestId}] Attempting to clean up uploaded images due to DB failure`
        );
        try {
          // You would need to implement this cleanup function
          // await cleanupR2Images(imageUrls);
        } catch (cleanupError) {
          console.error(
            `[${requestId}] ERROR: Failed to cleanup images after DB error:`,
            cleanupError
          );
        }
      }

      let errorDetails = "Failed to save product to database";
      if (dbError.code === "P2002") {
        errorDetails = "Product with similar name already exists";
      } else if (dbError.code === "P2003") {
        errorDetails = "Foreign key constraint failed - invalid category";
      }

      return NextResponse.json(
        {
          error: "Database error",
          details: errorDetails,
          dbError: dbError.message,
          code: dbError.code,
          requestId,
        },
        { status: 500 }
      );
    }

    // Step 11: Success response
    const totalDuration = Date.now() - startTime;
    console.log(`[${requestId}] === POST /admin/products SUCCESS ===`);
    console.log(`[${requestId}] Total duration: ${totalDuration}ms`);
    console.log(`[${requestId}] Product ID: ${product.id}`);
    console.log(`[${requestId}] Images: ${imageUrls.length}`);

    return NextResponse.json(
      {
        status: 201,
        message: "Product created successfully",
        data: product,
        requestId, // Include requestId in response for debugging
        debug: {
          imagesUploaded: imageUrls.length,
          processingTime: `${totalDuration}ms`,
        },
      },
      { status: 201 }
    );
  } catch (unexpectedError: any) {
    // Catch-all for unexpected errors
    const totalDuration = Date.now() - startTime;
    console.error(
      `[${requestId}] === POST /admin/products UNEXPECTED ERROR ===`
    );
    console.error(`[${requestId}] Error after ${totalDuration}ms:`, {
      message: unexpectedError.message,
      stack: unexpectedError.stack,
      name: unexpectedError.name,
    });

    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: "An unexpected error occurred while processing your request",
        message:
          process.env.NODE_ENV === "development"
            ? unexpectedError.message
            : undefined,
        requestId,
        timestamp: new Date().toISOString(),
      },
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
