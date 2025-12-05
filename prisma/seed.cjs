// prisma/seed.cjs
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  console.log("✅ Using enum roles:  USER, ADMIN");

  // Create sample users with enum roles - USE THE ENUM VALUES DIRECTLY
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@franco.ng" },
    update: {},
    create: {
      email: "admin@franco.ng",
      name: "admin",
      passwordHash: "$2b$10$K7L1OJ45.4U2d.6A5Qd5E.A6Qd5E.A6Qd5E.A6Qd5E.A6Qd5E",
      roles: ["ADMIN"], // This should work with the new client
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "advertiser@example.com" },
    update: {},
    create: {
      email: "advertiser@example.com",
      name: "advertiser",
      passwordHash: "$2b$10$K7L1OJ45.4U2d.6A5Qd5E.A6Qd5E.A6Qd5E.A6Qd5E.A6Qd5E",
      roles: ["USER"],
    },
  });

  console.log("✅ Sample users created with enum roles");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
