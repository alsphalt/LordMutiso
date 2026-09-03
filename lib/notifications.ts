import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface NewNotification {
  userId: string;
  type: "INVITATION" | "PLAYER_JOINED" | "GAME_STARTED" | "YOUR_TURN" | "GAME_ENDED" | "REMATCH" | "CHAT" | "SYSTEM";
  title: string;
  body: string;
  gameId?: string | null;
}

/** Create notifications inside or outside a transaction. */
export async function notifyAll(
  items: NewNotification[],
  tx?: Prisma.TransactionClient
): Promise<void> {
  if (items.length === 0) return;
  const db = (tx ?? prisma) as typeof prisma;
  await db.notification.createMany({
    data: items.map((n) => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      gameId: n.gameId ?? null,
    })),
  });
}
