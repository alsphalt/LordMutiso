import { prisma } from "@/lib/db";
import { tooMany } from "@/lib/api";
import { CHAT_RATE_WINDOW_MS } from "@/lib/constants";
import { sanitizeText } from "@/lib/utils";

export async function validateAndRateLimitChat(userId: string, gameId: string | null) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - CHAT_RATE_WINDOW_MS);

  const lastMessage = await prisma.chatMessage.findFirst({
    where: {
      senderId: userId,
      gameId: gameId, // Rate limit is per scope (global or specific game)
      createdAt: { gte: cutoff },
    },
  });

  if (lastMessage) {
    throw tooMany();
  }
}
