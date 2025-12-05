import { prisma } from "./db.cjs";

export function formatPrice(priceInKobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(priceInKobo / 100);
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function createAdminLog(
  adminUserId: string,
  action: string,
  entity: string,
  entityId: string,
  diff?: any
) {
  await prisma.adminLog.create({
    data: {
      adminUserId,
      action,
      entity,
      entityId,
      diffJson: diff,
    },
  });
}
