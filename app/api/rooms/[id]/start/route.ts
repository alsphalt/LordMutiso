import { handle, ok, forbidden, badRequest, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { notifyAll } from "@/lib/notifications";
import { createLudoState } from "@/lib/games/ludo/engine";
import { createChessState } from "@/lib/games/chess/engine";
import { createCheckersState } from "@/lib/games/checkers/engine";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }) => {
  const user = await requireUser();
  const id = params?.id;
  if (!id) throw badRequest("Missing game ID");

  const game = await prisma.game.findUnique({
    where: { id },
    include: { players: true, room: true },
  });

  if (!game) throw notFound("Game not found");
  if (game.createdBy !== user.id) throw forbidden("Only the creator can start the game");
  if (game.status !== "WAITING") throw badRequest("Game has already started");
  if (game.players.length < 2) throw badRequest("Need at least 2 players to start");

  let initialState: any = {};
  if (game.type === "LUDO") {
    initialState = createLudoState(game.players.map((p) => p.playerNumber));
  } else if (game.type === "CHESS") {
    initialState = createChessState();
  } else if (game.type === "CHECKERS") {
    initialState = createCheckersState();
  }

  await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id },
      data: {
        status: "PLAYING",
        startedAt: new Date(),
        currentTurn: 1,
        gameState: JSON.parse(JSON.stringify(initialState)),
      },
    });

    if (game.room) {
      await tx.gameRoom.update({
        where: { id: game.room.id },
        data: { status: "PLAYING" },
      });
    }

    await notifyAll(
      game.players.map((p) => ({
        userId: p.userId,
        type: "GAME_STARTED",
        title: "Game started",
        body: `The ${game.type.toLowerCase()} game has started!`,
        gameId: game.id,
      })),
      tx
    );
  });

  return ok({ ok: true, gameId: game.id });
});
