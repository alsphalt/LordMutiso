import { handle, ok, badRequest, forbidden, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { runAiTurns } from "@/lib/server/ai-run";

export const dynamic = "force-dynamic";

/**
 * POST /api/games/[id]/ai-turn
 *
 * The client calls this after a short "thinking" delay whenever it is an AI
 * seat's turn. The server executes the AI move(s) — still fully authoritative
 * (same engines, same move records). No-op when the turn already moved on
 * (e.g. two tabs or a refresh raced), so double execution is impossible.
 */
export const POST = handle(async (_req, ctx) => {
  const user = await requireUser();
  const gameId = ctx.params.id;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game) throw notFound("Game not found");
  if (!game.players.some((p) => p.userId === user.id)) throw forbidden("You are not in this game");
  if (game.gameMode !== "AI") throw badRequest("This is not an AI game");
  if (game.status !== "PLAYING" || game.currentTurn === null) return ok({ ran: false });

  const seat = game.players.find((p) => p.playerNumber === game.currentTurn);
  if (!seat?.isAi) return ok({ ran: false }); // human's turn already — nothing to do

  await prisma.$transaction(async (tx) => {
    await runAiTurns(tx, gameId);
  });

  return ok({ ran: true });
});
