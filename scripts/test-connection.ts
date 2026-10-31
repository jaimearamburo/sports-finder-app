import "dotenv/config";
import { prisma } from "../lib/prisma";

async function testCreateActivity() {
  const activity = await prisma.activity.create({
    data: {
      name: "Tennis",
      bookingMechanic: "time_range",
    },
  });
  console.log("Created:", activity);
}

testCreateActivity()
  .catch((e) => {
    console.error("Connection failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());