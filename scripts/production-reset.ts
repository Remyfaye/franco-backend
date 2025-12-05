// scripts/production-reset.ts
import { prisma } from "../lib/db.cjs";

async function productionReset() {
  console.log("🚀 PRODUCTION RESET - CLEANING FOR LAUNCH");
  console.log("⚠️  This will delete ALL data and start fresh");

  try {
    // Reset in correct order to handle foreign key constraints
    await prisma.$transaction(async (tx) => {
      console.log("🗑️  Deleting earnings data...");
      await tx.publisherEarning.deleteMany();

      console.log("🗑️  Deleting campaign reservations...");
      await tx.campaignReservation.deleteMany();

      console.log("🗑️  Deleting publisher accounts...");
      await tx.publisherAccount.deleteMany();

      console.log("🗑️  Deleting publisher strikes...");
      await tx.publisherStrike.deleteMany();

      console.log("🗑️  Deleting publishers...");
      await tx.publisher.deleteMany();

      console.log("🗑️  Deleting campaigns...");
      await tx.campaign.deleteMany();

      console.log("🗑️  Deleting ad creatives...");
      await tx.adCreative.deleteMany();

      console.log("🗑️  Deleting transactions...");
      await tx.transaction.deleteMany();

      console.log("🗑️  Deleting users...");
      await tx.user.deleteMany();

      console.log("✅ Database reset complete!");
    });

    // Optional: Seed with initial admin user
    await seedInitialData();
  } catch (error) {
    console.error("❌ Reset failed:", error);
    throw error;
  }
}

async function seedInitialData() {
  console.log("🌱 Seeding initial data...");

  // Create essential roles if they don't exist
  const roles = ["admin", "publisher", "advertiser"];
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  console.log("✅ Initial data seeded");
}

// Run the reset
productionReset()
  .then(() => {
    console.log("🎉 Production reset completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Reset failed:", error);
    process.exit(1);
  });
