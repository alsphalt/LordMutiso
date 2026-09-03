import { handle, readBody, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { createRoomSchema } from "@/lib/validation/schemas";
import { ROOM_CODE_ALPHABET, GAME_TYPES } from "@/lib/constants";
import { randomRoomCode } from "@/lib/utils";
import { colorForSeat } from "@/lib/games/types";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireUser();
  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get("type");
  const type = typeParam && ["LUDO", "CHESS", "CHECKERS"].includes(typeParam) ? typeParam : null;

  const rooms = await prisma.gameRoom.findMany({
    where: {
      status: "WAITING",
      ...(type ? { game: { type: type as "LUDO" | "CHESS" | "CHECKERS" } } : {}),
    },
    include: {
      game: {
        include: {
          players: {
            include: { user: { select: { id: true, username: true, image: true } } },
            orderBy: { playerNumber: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return ok({
    rooms: rooms.map((r) => ({
      id: r.id,
      gameId: r.gameId,
      roomCode: r.roomCode,
      type: r.game.type,
      status: r.status,
      maxPlayers: r.maxPlayers,
      players: r.game.players.map((p) => ({
        userId: p.userId,
        username: p.user.username,
        image: p.user.image,
        playerNumber: p.playerNumber,
        color: p.color,
      })),
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readBody(req);
  const { type } = createRoomSchema.parse(body);

  const meta = GAME_TYPES[type];
  if (!meta) throw badRequest("Invalid game type");

  return await prisma.$transaction(async (tx) => {
    // Unique room code retry loop
    let roomCode = "";
    let attempts = 0;
    while (attempts < 10) {
      roomCode = randomRoomCode(ROOM_CODE_ALPHABET, 6);
      const existing = await tx.gameRoom.findUnique({ where: { roomCode } });
      if (!existing) break;
      attempts++;
    }
    if (attempts === 10) throw new Error("Failed to generate unique room code");

    const game = await tx.game.create({
      data: {
        type,
        status: "WAITING",
        createdBy: user.id,
        gameState: {},
      },
    });

    const room = await tx.gameRoom.create({
      data: {
        roomCode,
        gameId: game.id,
        maxPlayers: meta.maxPlayers,
        status: "WAITING",
      },
    });

    const player = await tx.gamePlayer.create({
      data: {
        gameId: game.id,
        userId: user.id,
        playerNumber: 1,
        color: colorForSeat(0, type),
      },
      include: { user: { select: { id: true, username: true, image: true } } },
    });

    return ok({
      room: {
        id: room.id,
        gameId: game.id,
        roomCode: room.roomCode,
        type: game.type,
        status: game.status,
        maxPlayers: room.maxPlayers,
        players: [{
          userId: player.userId,
          username: player.user.username,
          image: player.user.image,
          playerNumber: player.playerNumber,
          color: player.color,
        }],
        createdAt: room.createdAt.toISOString(),
      },
    });
  });
});
