import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Database integration tests. They only run against a REAL Neon
 * connection string — without one they skip (the placeholder in .env
 * is not a valid postgres URL).
 */
const url = process.env.DATABASE_URL ?? "";
const hasDb = url.startsWith("postgresql://") || url.startsWith("postgres://");

test("database connectivity", { skip: !hasDb && "Set a real DATABASE_URL to run DB tests" }, async () => {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    assert.ok(true, "connected");
  } finally {
    await prisma.$disconnect();
  }
});

test("schema: statistics + sessions tables exist", { skip: !hasDb && "Set a real DATABASE_URL to run DB tests" }, async () => {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const res = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        AND tablename IN ('User','UserStatistics','Session','Game','GameRoom','GamePlayer','GameMove','ChatMessage','Notification');
    `;
    assert.equal(res.length, 9);
  } finally {
    await prisma.$disconnect();
  }
});
