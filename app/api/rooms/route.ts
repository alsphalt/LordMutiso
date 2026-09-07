import { handle, readBody, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { createRoomSchema } from "@/lib/validation/schemas";
import { ROOM_CODE_ALPHABET, GAME_TYPES } from "@/lib/constants";
import { randomRoomCode, sanitizeText } from "@/lib/utils";
import { seatAssignment } from "@/lib/games/types";
import {
  activeRoomWhere,
  countActiveRooms,
  expireStaleRooms,
  roomInclude,
  ROOM_LIFETIME_MS,
  toRoomRow,
  type RoomFull,
} from "@/lib/server/rooms";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireUser();
  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get("type");
  const type = typeParam && ["LUDO", "CHESS", "CHECKERS"].includes(typeParam) ? typeParam : null;

  // Lazy expiry first — never return (or count) a WAITING room past its lifetime.
  await expireStaleRooms();

  const where: Prisma.GameRoomWhereInput = {
    ...activeRoomWhere(),
    roomCode: null, // discoverable QUICK rooms only — private code rooms are joined via code
    game: {
      status: { in: ["WAITING", "PLAYING"] },
      ...(type ? { type: type as "LUDO" | "CHESS" | "CHECKERS" } : {}),
    },
  };

  const rooms = await prisma.gameRoom.findMany({
    where,
    include: roomInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const activeCount = await countActiveRooms();

  return ok({
    rooms: rooms.map(toRoomRow),
    activeCount,
  });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readBody(req);
  const parsed = createRoomSchema.parse(body);
  const type = parsed.type;
  const mode = parsed.mode ?? "PRIVATE"; // legacy create (no mode) keeps building code rooms

  const meta = GAME_TYPES[type];
  if (!meta) throw badRequest("Invalid game type");

  if (mode === "QUICK" && !parsed.name) {
    throw badRequest("Enter a room name for a quick match");
  }
  const roomName = mode === "QUICK" ? sanitizeText(parsed.name!, 40) : parsed.name ? sanitizeText(parsed.name, 40) : null;
  if (mode === "QUICK" && !roomName) {
    throw badRequest("Enter a room name for a quick match");
  }

  return await prisma.$transaction(async (tx) => {
    // Private rooms get a unique one-time code; quick rooms deliberately have none.
    let roomCode: string | null = null;
    if (mode === "PRIVATE") {
      let attempts = 0;
      while (attempts < 10) {
        const candidate = randomRoomCode(ROOM_CODE_ALPHABET, 6);
        const existing = await tx.gameRoom.findUnique({ where: { roomCode: candidate } });
        if (!existing) {
          roomCode = candidate;
          break;
        }
        attempts++;
      }
      if (!roomCode) throw new Error("Failed to generate unique room code");
    }

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
        roomName,
        codeUsed: false,
        expiresAt: new Date(Date.now() + ROOM_LIFETIME_MS),
        gameId: game.id,
        maxPlayers: meta.maxPlayers,
        status: "WAITING",
      },
      include: roomInclude,
    });

    const first = seatAssignment(type, 1, 0);
    await tx.gamePlayer.create({
      data: {
        gameId: game.id,
        userId: user.id,
        playerNumber: first.playerNumber,
        color: first.color,
      },
    });

    // Re-fetch with the creator seat attached so the row matches RoomRow.
    const fresh = (await tx.gameRoom.findUnique({
      where: { id: room.id },
      include: roomInclude,
    })) as RoomFull;

    return ok({ room: toRoomRow(fresh) });
  });
});
