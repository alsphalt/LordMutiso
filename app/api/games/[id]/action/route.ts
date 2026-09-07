import { handle, readBody, ok, badRequest, forbidden, notFound, conflict } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { gameActionSchema } from "@/lib/validation/schemas";
import { buildGameSnapshot } from "@/lib/games/snapshot";
import { randomInt } from "@/lib/utils";
import { notifyAll } from "@/lib/notifications";
import { normalizeDicePose, randomDicePose } from "@/lib/games/ludo/dice";
import { finishGame } from "@/lib/server/finish";
import { leaveRoom } from "@/lib/server/rooms";

// Engines
import { rollLudo, moveLudoToken, resignLudo, createLudoState } from "@/lib/games/ludo/engine";
import { stepCheckers, resignCheckers, createCheckersState } from "@/lib/games/checkers/engine";
import { stepChess, resignChess, createChessState, chessTurnSeat } from "@/lib/games/chess/engine";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }) => {
  const user = await requireUser();
  const id = params?.id;
  if (!id) throw badRequest("Missing game ID");

  const body = await readBody(req);
  const input = gameActionSchema.parse(body);

  // Rematch is special as it creates a NEW game
  if (input.action === "rematch") {
    return await handleRematch(id, user.id);
  }

  // Leave is special as it might delete the game
  if (input.action === "leave") {
    await leaveRoom(id, user.id);
    const snapshot = await buildGameSnapshot(id, user.id).catch(() => null);
    return ok({ snapshot });
  }

  return await prisma.$transaction(async (tx) => {
    // Reload game fresh inside transaction
    const game = await tx.game.findUnique({
      where: { id },
      include: {
        players: {
          include: { user: { select: { username: true } } },
          orderBy: { playerNumber: "asc" },
        },
        room: true,
      },
    });

    if (!game) throw notFound("Game not found");

    const mySeat = game.players.find((p) => p.userId === user.id);
    if (!mySeat && game.createdBy !== user.id) throw forbidden("Not a participant");

    const state = (game.gameState ?? {}) as unknown as any;

    if (input.action === "start") {
      if (game.createdBy !== user.id) throw forbidden("Only creator can start");
      if (game.status !== "WAITING") throw badRequest("Already started");
      if (game.players.length < 2) throw badRequest("Need 2 players");

      let initialState: any = {};
      if (game.type === "LUDO") initialState = createLudoState(game.players.map((p) => p.playerNumber));
      else if (game.type === "CHESS") initialState = createChessState();
      else if (game.type === "CHECKERS") initialState = createCheckersState();

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
        await tx.gameRoom.update({ where: { id: game.room.id }, data: { status: "PLAYING" } });
      }

      await notifyAll(
        game.players
          .filter((p) => p.userId !== null)
          .map((p) => ({
            userId: p.userId!,
            type: "GAME_STARTED",
            title: "Game started",
            body: "The game has started!",
            gameId: game.id,
          })),
        tx
      );
    } else if (input.action === "roll") {
      if (game.type !== "LUDO") throw badRequest("Only Ludo has rolls");
      if (game.status !== "PLAYING") throw badRequest("Game not playing");
      if (game.currentTurn !== mySeat?.playerNumber) throw forbidden("Not your turn");

      // The die value is determined by the physical cube on the rolling
      // client (top face of the settled die). When absent (idle auto-roll,
      // older clients) the server rolls a fair die instead.
      const die = input.die ?? randomInt(1, 7);
      const { autoPassed } = rollLudo(state, die);

      // The dice is a persistent physical object: store where it came to
      // rest so every player renders the same pose across turns/reconnects.
      if (input.dice) state.dice = normalizeDicePose(input.dice);
      else if (!state.dice) state.dice = randomDicePose(die);

      let nextTurn = state.turn;
      
      await tx.game.update({
        where: { id },
        data: {
          gameState: JSON.parse(JSON.stringify(state)),
          currentTurn: nextTurn,
        },
      });

      await recordMove(tx, game.id, mySeat!.id, {
        kind: "ludo-roll",
        die,
        autoPassed,
        playerNumber: mySeat!.playerNumber,
        dice: state.dice ?? null,
      });

    } else if (input.action === "move") {
      if (game.status !== "PLAYING") throw badRequest("Game not playing");
      if (game.currentTurn !== mySeat?.playerNumber) throw forbidden("Not your turn");

      let result: any;
      let moveData: any;
      let nextTurn: number | null = game.currentTurn;

      if (game.type === "LUDO") {
        if (input.token === undefined) throw badRequest("Missing token");
        const dieUsed = state.die;
        const outcome = moveLudoToken(state, input.token);
        result = outcome.result;
        moveData = {
          kind: "ludo-move",
          token: outcome.move.token,
          fromR: outcome.move.fromR,
          toR: outcome.move.toR,
          capture: outcome.captured,
          capturedTokens: outcome.capturedList,
          die: dieUsed,
          playerNumber: mySeat!.playerNumber,
          extraRoll: outcome.extraRoll,
        };
        nextTurn = state.turn;
      } else if (game.type === "CHESS") {
        if (input.from === undefined || input.to === undefined) throw badRequest("Missing from/to");
        const outcome = stepChess(state, { from: input.from, to: input.to, promotion: input.promotion }, Date.now());
        result = outcome.result;
        moveData = {
          kind: "chess-move",
          from: input.from,
          to: input.to,
          san: outcome.san,
          playerNumber: mySeat!.playerNumber,
        };
        nextTurn = result.done ? null : chessTurnSeat(state.fen);
      } else if (game.type === "CHECKERS") {
        if (input.from === undefined || input.to === undefined) throw badRequest("Missing from/to");
        const outcome = stepCheckers(state, input.from, input.to);
        result = outcome.result;
        moveData = {
          kind: "checkers-move",
          from: outcome.move.from,
          to: outcome.move.to,
          capture: outcome.move.capture,
          captureIdx: outcome.move.captureIdx,
          crowned: outcome.move.crowned,
          playerNumber: mySeat!.playerNumber,
        };
        nextTurn = state.turn;
      }

      await tx.game.update({
        where: { id },
        data: {
          gameState: JSON.parse(JSON.stringify(state)),
          currentTurn: nextTurn,
        },
      });

      await recordMove(tx, game.id, mySeat!.id, moveData);

      if (result.done) {
        const winnerSeat = game.players.find((p) => p.playerNumber === result.winner) ?? null;
        await finishGame(tx, game.id, {
          winnerId: winnerSeat?.userId ?? null,
          winnerPlayerNumber: result.winner ?? null,
          status: result.draw ? "DRAW" : "FINISHED",
        });
      } else if (game.gameMode === "AI") {
        // AI replies after a 3s "thinking" delay via POST /api/games/[id]/ai-turn
      }

    } else if (input.action === "resign") {
      if (game.status !== "PLAYING") throw badRequest("Game not playing");
      
      let result: any;
      if (game.type === "LUDO") result = resignLudo(state, mySeat!.playerNumber);
      else if (game.type === "CHESS") result = resignChess(state, mySeat!.playerNumber as any);
      else if (game.type === "CHECKERS") result = resignCheckers(state, mySeat!.playerNumber as any);

      await tx.game.update({
        where: { id },
        data: {
          gameState: JSON.parse(JSON.stringify(state)),
          currentTurn: state.turn || null,
        },
      });

      await recordMove(tx, game.id, mySeat!.id, { kind: "resign", playerNumber: mySeat!.playerNumber });

      if (result.done) {
        const winnerSeat = game.players.find((p) => p.playerNumber === result.winner) ?? null;
        await finishGame(tx, game.id, {
          winnerId: winnerSeat?.userId ?? null,
          winnerPlayerNumber: result.winner ?? null,
          status: result.draw ? "DRAW" : "FINISHED",
        });
      } else if (game.gameMode === "AI") {
        // bots finish after the human resigns — via the ai-turn endpoint
      }
    }

    const snapshot = await buildGameSnapshot(game.id, user.id);
    return ok({ snapshot });
  });
});

async function recordMove(tx: any, gameId: string, playerId: string, moveData: any) {
  const count = await tx.gameMove.count({ where: { gameId } });
  try {
    await tx.gameMove.create({
      data: {
        gameId,
        playerId,
        moveNumber: count + 1,
        moveData,
      },
    });
  } catch (e) {
    // Unique constraint race
    throw conflict("Please retry");
  }
}

async function handleRematch(gameId: string, userId: string) {
  return await prisma.$transaction(async (tx) => {
    const oldGame = await tx.game.findUnique({
      where: { id: gameId },
      include: { players: true },
    });

    if (!oldGame) throw notFound("Game not found");
    if (oldGame.status !== "FINISHED" && oldGame.status !== "DRAW") throw badRequest("Game not finished");
    if (oldGame.players.length < 2) throw badRequest("Not enough players for rematch");

    let initialState: any = {};
    if (oldGame.type === "LUDO") initialState = createLudoState(oldGame.players.map((p) => p.playerNumber));
    else if (oldGame.type === "CHESS") initialState = createChessState();
    else if (oldGame.type === "CHECKERS") initialState = createCheckersState();

    const newGame = await tx.game.create({
      data: {
        type: oldGame.type,
        gameMode: oldGame.gameMode,
        aiDifficulty: oldGame.aiDifficulty,
        status: "PLAYING",
        createdBy: oldGame.createdBy,
        startedAt: new Date(),
        currentTurn: Math.min(...oldGame.players.map((p) => p.playerNumber)),
        gameState: JSON.parse(JSON.stringify(initialState)),
        players: {
          create: oldGame.players.map((p) => ({
            userId: p.userId,
            isAi: p.isAi,
            botName: p.botName,
            playerNumber: p.playerNumber,
            color: p.color,
          })),
        },
      },
    });

    await notifyAll(
      oldGame.players
        .filter((p) => p.userId !== null)
        .map((p) => ({
          userId: p.userId!,
          type: "REMATCH",
          title: "Rematch started",
          body: "A rematch has started!",
          gameId: newGame.id,
        })),
      tx
    );

    const snapshot = await buildGameSnapshot(newGame.id, userId);
    return ok({ snapshot, newGameId: newGame.id });
  });
}
