import { prisma } from "@/lib/db";
import { notFound, forbidden } from "@/lib/api";
import type { GameSnapshot, MoveDTO, GameStatusName } from "@/lib/games/types";

/**
 * Build the client-facing snapshot of a game for `viewerId`.
 * Viewers must be a player or the game creator; everyone else is forbidden.
 * All data comes straight from Neon — this is what reconnection uses.
 * AI seats (no user row) fall back to their stored bot name.
 */
export async function buildGameSnapshot(gameId: string, viewerId: string): Promise<GameSnapshot> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        orderBy: { playerNumber: "asc" },
        include: { user: { select: { id: true, username: true, image: true } } },
      },
      room: { select: { roomCode: true, maxPlayers: true, roomName: true } },
      creator: { select: { id: true } },
    },
  });
  if (!game) throw notFound("Game not found");

  const isPlayer = game.players.some((p) => p.userId === viewerId);
  const isCreator = game.createdBy === viewerId;
  if (!isPlayer && !isCreator) throw forbidden("You do not have access to this game");

  const recentMovesRaw = await prisma.gameMove.findMany({
    where: { gameId },
    orderBy: { moveNumber: "desc" },
    take: 40,
    include: { player: { include: { user: { select: { username: true } } } } },
  });
  recentMovesRaw.reverse();

  const mySeat = game.players.find((p) => p.userId === viewerId)?.playerNumber ?? null;
  const seats = game.players.map((p) => ({
    id: p.id,
    userId: p.userId,
    username: p.user?.username ?? p.botName ?? "AI",
    image: p.user?.image ?? null,
    isAi: p.isAi,
    playerNumber: p.playerNumber,
    color: p.color,
    score: p.score,
    joinedAt: p.joinedAt.toISOString(),
  }));

  const moves: MoveDTO[] = recentMovesRaw.map((m) => ({
    id: m.id,
    moveNumber: m.moveNumber,
    playerId: m.playerId,
    playerNumber: m.player.playerNumber,
    username: m.player.user?.username ?? m.player.botName ?? "AI",
    moveData: m.moveData,
    createdAt: m.createdAt.toISOString(),
  }));

  const state = (game.gameState ?? {}) as unknown as Record<string, unknown>;

  const maxPlayers = game.room?.maxPlayers ?? 4;
  return {
    game: {
      id: game.id,
      type: game.type,
      gameMode: game.gameMode,
      aiDifficulty: game.aiDifficulty,
      // Game.status never holds the room-only COMPLETED/CLOSED values.
      status: game.status as GameStatusName,
      createdBy: game.createdBy,
      winnerId: game.winnerId,
      winnerPlayerNumber: game.winnerPlayerNumber,
      currentTurn: game.currentTurn,
      roomCode: game.room?.roomCode ?? null,
      roomName: game.room?.roomName ?? null,
      createdAt: game.createdAt.toISOString(),
      startedAt: game.startedAt?.toISOString() ?? null,
      endedAt: game.endedAt?.toISOString() ?? null,
    },
    seats,
    state,
    mySeatNumber: mySeat,
    isMyTurn: game.status === "PLAYING" && game.currentTurn !== null && mySeat === game.currentTurn,
    isPlayer,
    canStart:
      isCreator &&
      game.status === "WAITING" &&
      game.players.length >= 2 &&
      game.players.length <= maxPlayers,
    recentMoves: moves,
    nowMs: Date.now(),
  };
}
