import { prisma } from "@/lib/db";
import { badRequest, conflict, notFound, forbidden } from "@/lib/api";
import type { Prisma } from "@prisma/client";
import type { GameTypeName } from "@/lib/games/types";
import { seatAssignment } from "@/lib/games/types";
import { notifyAll } from "@/lib/notifications";

/**
 * Deterministic seat layout while a room is WAITING.
 *
 * Every seat keeps a stable order (by join time). Whenever the player count
 * changes we re-run the layout so positions are always correct for the final
 * number of seats:
 *   - 2 players (Ludo): DIAGONALLY OPPOSITE corners — TL (RED) vs BR (YELLOW).
 *   - 3-4 players (Ludo): classic TL, TR, BR, BL corners.
 *   - Chess / Checkers: seat 1 (WHITE) vs seat 2 (BLACK).
 *
 * Because playerNumber IS the board corner slot, the engine paths, home
 * columns, bases and centre triangles stay perfectly in sync, and the same
 * mapping survives refresh, reconnect, leave/join and rematch (seats keep
 * their stored playerNumber/colour).
 */

function reapplyLayout(
  tx: Prisma.TransactionClient,
  rows: Array<{ id: string; playerNumber: number }>,
  gameType: GameTypeName,
  totalSeats: number
) {
  const updates: Array<Promise<unknown>> = [];
  rows.forEach((seat, index) => {
    const target = seatAssignment(gameType, totalSeats, index);
    if (seat.playerNumber !== target.playerNumber) {
      updates.push(
        tx.gamePlayer.update({
          where: { id: seat.id },
          data: { playerNumber: target.playerNumber, color: target.color },
        })
      );
    }
  });
  return Promise.all(updates);
}

export async function joinRoom(roomCode: string, userId: string) {
  return await prisma.$transaction(async (tx) => {
    const room = await tx.gameRoom.findUnique({
      where: { roomCode },
      include: {
        game: {
          include: {
            players: { include: { user: { select: { username: true, image: true } } } },
          },
        },
      },
    });

    if (!room) throw notFound("Room not found");
    if (room.status !== "WAITING") throw badRequest("Game has already started");

    const game = room.game;
    if (game.players.some((p) => p.userId === userId)) {
      throw conflict("You are already in this room");
    }
    if (game.players.length >= room.maxPlayers) {
      throw badRequest("Room is full");
    }

    // Seats keep join order; recompute the layout for the new total count.
    const ordered = [...game.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    const total = ordered.length + 1;
    await reapplyLayout(tx, ordered, game.type, total);

    const target = seatAssignment(game.type, total, ordered.length);
    const player = await tx.gamePlayer.create({
      data: {
        gameId: game.id,
        userId,
        playerNumber: target.playerNumber,
        color: target.color,
      },
      include: { user: { select: { username: true, image: true } } },
    });

    // Notify the previously present players.
    const existingUsers = ordered.filter((p) => p.userId !== null);
    if (existingUsers.length > 0) {
      await notifyAll(
        existingUsers.map((p) => ({
          userId: p.userId!,
          type: "PLAYER_JOINED",
          title: "Player joined",
          body: `${player.user!.username} joined the room.`,
          gameId: game.id,
        })),
        tx
      );
    }

    return { room, player };
  });
}

export async function leaveRoom(gameId: string, userId: string) {
  return await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
      where: { id: gameId },
      include: {
        players: { include: { user: { select: { username: true, image: true } } } },
        room: true,
      },
    });

    if (!game) throw notFound("Game not found");
    if (game.status !== "WAITING") throw badRequest("Cannot leave a game that has started");

    const player = game.players.find((p) => p.userId === userId);
    if (!player) throw forbidden("You are not in this game");

    // Remove the player
    await tx.gamePlayer.delete({
      where: { id: player.id },
    });

    const remaining = game.players
      .filter((p) => p.userId !== userId)
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());

    if (remaining.length === 0) {
      // Delete game and room
      await tx.game.delete({ where: { id: gameId } });
      return { deleted: true };
    }

    // Re-layout the remaining seats for the new count (keeps e.g. a 2-player
    // duel on opposite corners after someone drops out of a bigger room).
    await reapplyLayout(tx, remaining, game.type, remaining.length);

    const remainingUsers = remaining.filter((p) => p.userId !== null);
    if (remainingUsers.length > 0) {
      await notifyAll(
        remainingUsers.map((p) => ({
          userId: p.userId!,
          type: "SYSTEM",
          title: "Player left",
          body: `${player.user!.username} left the room.`,
          gameId: game.id,
        })),
        tx
      );
    }

    return { deleted: false };
  });
}
