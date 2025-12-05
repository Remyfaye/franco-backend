import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

// Configure S3 client for Cloudflare R2
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export async function uploadToR2WithSDK(
  file: File,
  folder: string = "products"
): Promise<string> {
  try {
    const fileBuffer = await file.arrayBuffer();
    const fileExtension = file.name.split(".").pop() || "jpg";
    const fileName = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 15)}.${fileExtension}`;

    console.log(`Uploading with SDK: ${fileName}, Size: ${file.size} bytes`);

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME!,
      Key: fileName,
      Body: Buffer.from(fileBuffer),
      ContentType: file.type,
      ACL: "public-read", // Make the object publicly readable
    });

    await r2Client.send(command);
    console.log(`Successfully uploaded with SDK: ${fileName}`);

    // Return public URL
    const publicUrl = `https://${process.env.CLOUDFLARE_PUBLIC_URL}/${fileName}`;

    console.log(`Public URL: ${publicUrl}`);

    return publicUrl;
  } catch (error) {
    console.error("Error uploading to R2 with SDK:", error);
    throw new Error(
      `Failed to upload file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function uploadMultipleToR2WithSDK(
  files: File[],
  folder: string = "products"
): Promise<string[]> {
  try {
    console.log(`Starting upload of ${files.length} files using AWS SDK`);

    const uploadPromises = files.map((file, index) => {
      console.log(`Processing file ${index + 1}: ${file.name}`);
      return uploadToR2WithSDK(file, folder);
    });

    const results = await Promise.all(uploadPromises);
    console.log(`All ${results.length} files uploaded successfully with SDK`);

    return results;
  } catch (error) {
    console.error("Error in uploadMultipleToR2WithSDK:", error);
    throw error;
  }
}

export async function deleteMultipleFromR2(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  try {
    console.log(`Starting deletion of ${keys.length} objects from R2`);

    const command = new DeleteObjectsCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME!,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: true, // Don't return details of deleted objects
      },
    });

    await r2Client.send(command);
    console.log(`Successfully deleted ${keys.length} objects from R2`);
  } catch (error) {
    console.error("Error deleting from R2:", error);
    throw new Error(
      `Failed to delete files: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
