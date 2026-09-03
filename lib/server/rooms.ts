import { prisma } from "@/lib/db";
import { badRequest, conflict, notFound, forbidden } from "@/lib/api";
import { GAME_TYPES } from "@/lib/constants";
import { colorForSeat } from "@/lib/games/types";
import { notifyAll } from "@/lib/notifications";

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

    const playerNumber = game.players.length + 1;
    const color = colorForSeat(playerNumber - 1, game.type);

    const player = await tx.gamePlayer.create({
      data: {
        gameId: game.id,
        userId,
        playerNumber,
        color,
      },
      include: { user: { select: { username: true, image: true } } },
    });

    // Notify others
    const others = game.players.map((p) => p.userId);
    if (others.length > 0) {
      await notifyAll(
        others.map((uid) => ({
          userId: uid,
          type: "PLAYER_JOINED",
          title: "Player joined",
          body: `${player.user.username} joined the room.`,
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

    const remaining = game.players.filter((p) => p.userId !== userId);

    if (remaining.length === 0) {
      // Delete game and room
      await tx.game.delete({ where: { id: gameId } });
      return { deleted: true };
    } else {
      // Re-order player numbers? The prompt doesn't say to reorder.
      // But it says "assign next playerNumber = seats+1" in join.
      // If someone leaves, seats+1 might clash if we don't reorder.
      // Let's reorder to be safe and consistent.
      for (let i = 0; i < remaining.length; i++) {
        const p = remaining[i];
        const newNum = i + 1;
        if (p.playerNumber !== newNum) {
          await tx.gamePlayer.update({
            where: { id: p.id },
            data: { 
              playerNumber: newNum,
              color: colorForSeat(i, game.type)
            },
          });
        }
      }

      // Notify others
      await notifyAll(
        remaining.map((p) => ({
          userId: p.userId,
          type: "SYSTEM",
          title: "Player left",
          body: `${player.user.username} left the room.`,
          gameId: game.id,
        })),
        tx
      );
      
      return { deleted: false };
    }
  });
}
