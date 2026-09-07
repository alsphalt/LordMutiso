import { prisma } from "@/lib/db";
import { badRequest, conflict, notFound, forbidden } from "@/lib/api";
import type { Prisma, PrismaClient } from "@prisma/client";
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

export const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000; // quick & private rooms live 24h while WAITING

/** Room statuses that count as "alive". CLOSED/COMPLETED/FINISHED… never do. */
export const ACTIVE_ROOM_STATUSES = ["WAITING", "PLAYING"] as const;
/** Game statuses whose room may count as active. */
export const ACTIVE_GAME_STATUSES = ["WAITING", "PLAYING"] as const;

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

/* ------------------------------------------------------------------ */
/* Active-room semantics                                              */
/* ------------------------------------------------------------------ */

/** Lazy expiry: CLOSE every WAITING room whose expiresAt has passed (keeps rows). */
export async function expireStaleRooms(
  db: Prisma.TransactionClient | PrismaClient = prisma
): Promise<void> {
  await db.gameRoom.updateMany({
    where: { status: "WAITING", expiresAt: { lt: new Date() } },
    data: { status: "CLOSED" },
  });
}

/**
 * Where-filter for "room itself is alive": status WAITING/PLAYING and, for
 * WAITING rooms, either never expires (legacy rows) or not yet expired.
 * Pair with a game.status filter (ACTIVE_GAME_STATUSES) for full semantics.
 */
export function activeRoomWhere(now: Date = new Date()): Prisma.GameRoomWhereInput {
  return {
    status: { in: [...ACTIVE_ROOM_STATUSES] },
    OR: [{ status: "PLAYING" }, { expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

/** Total number of active rooms (all types, private included) after a lazy expire. */
export async function countActiveRooms(): Promise<number> {
  await expireStaleRooms();
  return prisma.gameRoom.count({
    where: {
      ...activeRoomWhere(),
      game: { status: { in: [...ACTIVE_GAME_STATUSES] } },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Room serialization (RoomRow)                                       */
/* ------------------------------------------------------------------ */

export const roomInclude = {
  game: {
    include: {
      players: {
        include: { user: { select: { id: true, username: true, image: true } } },
        orderBy: { playerNumber: "asc" },
      },
    },
  },
} satisfies Prisma.GameRoomInclude;

export type RoomFull = Prisma.GameRoomGetPayload<{ include: typeof roomInclude }>;

export interface RoomPlayerRow {
  userId: string | null;
  username: string;
  image: string | null;
  playerNumber: number;
  color: string;
}

export interface RoomRow {
  id: string;
  gameId: string;
  roomCode: string | null;
  roomName: string | null;
  type: string;
  status: string;
  maxPlayers: number;
  players: RoomPlayerRow[];
  createdAt: string;
}

/** Serialize a room row for the API. Player names are ALWAYS real strings. */
export function toRoomRow(r: RoomFull): RoomRow {
  return {
    id: r.id,
    gameId: r.gameId,
    roomCode: r.roomCode,
    roomName: r.roomName,
    type: r.game.type,
    status: r.status,
    maxPlayers: r.maxPlayers,
    players: r.game.players.map((p) => ({
      userId: p.userId,
      username: p.user?.username ?? p.botName ?? "AI",
      image: p.user?.image ?? null,
      playerNumber: p.playerNumber,
      color: p.color,
    })),
    createdAt: r.createdAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Joining                                                             */
/* ------------------------------------------------------------------ */

/**
 * Shared seat-adding step, run inside the caller's transaction.
 * Validates the seat itself (already seated / full), lays out the seat for the
 * new total, creates the GamePlayer row and notifies the seated humans.
 *
 * `claimCode` makes the join consume a one-time private room code atomically.
 */
async function addSeatToRoom(
  tx: Prisma.TransactionClient,
  room: RoomFull,
  userId: string,
  claimCode = false
) {
  const game = room.game;
  if (game.players.some((p) => p.userId === userId)) {
    throw conflict("You are already in this room");
  }
  if (game.players.length >= room.maxPlayers) {
    throw badRequest("Room is full");
  }

  if (claimCode) {
    // Atomically burn the code — exactly one joiner can ever win this.
    const claimed = await tx.gameRoom.updateMany({
      where: { id: room.id, codeUsed: false },
      data: { codeUsed: true },
    });
    if (claimed.count === 0) throw badRequest("INVALID OR EXPIRED ROOM CODE");
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
    include: { user: { select: { id: true, username: true, image: true } } },
  });

  // Notify the previously present players.
  const existingUsers = ordered.filter((p) => p.userId !== null);
  if (existingUsers.length > 0) {
    await notifyAll(
      existingUsers.map((p) => ({
        userId: p.userId!,
        type: "PLAYER_JOINED" as const,
        title: "Player joined",
        body: `${player.user?.username ?? "A player"} joined the room.`,
        gameId: game.id,
      })),
      tx
    );
  }

  // Re-fetch so the returned row includes the brand-new seat.
  const fresh = await tx.game.findUnique({
    where: { id: game.id },
    include: {
      players: {
        include: { user: { select: { id: true, username: true, image: true } } },
        orderBy: { playerNumber: "asc" },
      },
    },
  });
  return { room: { ...room, game: fresh! }, player };
}

/**
 * Join a PRIVATE room by its one-time code.
 * Codes are single-use: the first successful join burns the code, every later
 * attempt (and every attempt with an expired/unknown/game-started code)
 * receives "INVALID OR EXPIRED ROOM CODE".
 */
export async function joinRoomByCode(roomCode: string, userId: string) {
  return await prisma.$transaction(async (tx) => {
    const room = await tx.gameRoom.findUnique({
      where: { roomCode },
      include: roomInclude,
    });

    if (!room) throw badRequest("INVALID OR EXPIRED ROOM CODE");
    if (room.roomCode === null) throw badRequest("INVALID OR EXPIRED ROOM CODE");
    if (room.status !== "WAITING") throw badRequest("INVALID OR EXPIRED ROOM CODE");
    if (room.codeUsed) throw badRequest("INVALID OR EXPIRED ROOM CODE");
    if (room.expiresAt && room.expiresAt.getTime() < Date.now()) {
      throw badRequest("INVALID OR EXPIRED ROOM CODE");
    }
    if (room.game.status !== "WAITING") throw badRequest("INVALID OR EXPIRED ROOM CODE");

    return addSeatToRoom(tx, room, userId, true);
  });
}

/**
 * Join a discoverable QUICK room by its game id.
 * The room and its game must both be alive and still WAITING; full rooms and
 * repeat seats are rejected; seated humans are notified (PLAYER_JOINED).
 */
export async function joinRoomByGame(gameId: string, userId: string) {
  return await prisma.$transaction(async (tx) => {
    // Lazy expiry first so an expired WAITING room is properly closed.
    await expireStaleRooms(tx);

    const room = await tx.gameRoom.findUnique({
      where: { gameId },
      include: roomInclude,
    });
    if (!room) throw notFound("Room not found");
    if (room.status !== "WAITING") throw badRequest("This room is no longer available");
    if (room.expiresAt && room.expiresAt.getTime() < Date.now()) {
      throw badRequest("This room is no longer available");
    }
    if (room.game.status !== "WAITING") throw badRequest("This game has already started");

    return addSeatToRoom(tx, room, userId);
  });
}

/* ------------------------------------------------------------------ */
/* Leaving                                                             */
/* ------------------------------------------------------------------ */

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
          type: "SYSTEM" as const,
          title: "Player left",
          body: `${player.user?.username ?? "A player"} left the room.`,
          gameId: game.id,
        })),
        tx
      );
    }

    return { deleted: false };
  });
}
