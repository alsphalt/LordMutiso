/**
 * Optional demo seed — run with: npm run db:seed
 * Requires a real DATABASE_URL pointing at your Neon database.
 * Idempotent: safe to run repeatedly.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient();

const DEMO_USERS = [
  { username: "neon_knight", email: "knight@darknote.demo" },
  { username: "purple_pawn", email: "pawn@darknote.demo" },
  { username: "dice_wizard", email: "wizard@darknote.demo" },
  { username: "cyber_rook", email: "rook@darknote.demo" },
];

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    console.log("⚠️  Set a real DATABASE_URL (Neon connection string) before seeding.");
    return;
  }

  const passwordHash = hashPassword("password123");

  for (const d of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { username: d.username },
      update: { email: d.email },
      create: { username: d.username, email: d.email, passwordHash },
    });
    await prisma.userStatistics.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
  }

  // A few friendly welcome messages in the global chat (only when empty).
  const existing = await prisma.chatMessage.count({ where: { gameId: null } });
  if (existing === 0) {
    const users = await prisma.user.findMany({
      where: { username: { in: DEMO_USERS.map((d) => d.username) } },
      select: { id: true, username: true },
    });
    const byName = new Map(users.map((u) => [u.username, u.id]));
    const welcomes = [
      ["neon_knight", "Welcome to DARKNOTE GAMING ARENA ⚡"],
      ["purple_pawn", "Anyone up for a chess match? ♟️"],
      ["dice_wizard", "Ludo room open — roll the dice 🎲"],
      ["cyber_rook", "Good luck everyone!"],
    ] as const;
    for (const [name, msg] of welcomes) {
      const id = byName.get(name);
      if (id) {
        await prisma.chatMessage.create({ data: { senderId: id, gameId: null, message: msg } });
      }
    }
  }

  console.log("✅ Seed complete — demo users:");
  DEMO_USERS.forEach((d) => console.log(`   • ${d.username} / password123`));
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
