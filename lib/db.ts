import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton — safe for serverless (Neon + Vercel).
 * Reuses the client across hot reloads / warm lambdas to avoid
 * exhausting the Neon connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export default prisma;
