import { handle, readBody, ok, badRequest } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createAiGame } from "@/lib/server/ai-create";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai — start an AI practice game.
 * Body:
 *   { type: "LUDO"|"CHESS"|"CHECKERS",
 *     aiCount?: 1..3 (LUDO only),
 *     difficulty: "EASY"|"MEDIUM"|"HARD",
 *     color: "RED"|"YELLOW"|... (human's preferred colour / side) }
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readBody(req);

  const type = body.type;
  if (type !== "LUDO" && type !== "CHESS" && type !== "CHECKERS") throw badRequest("Invalid game type");
  const difficulty = body.difficulty;
  if (difficulty !== "EASY" && difficulty !== "MEDIUM" && difficulty !== "HARD") throw badRequest("Invalid difficulty");

  const color = String(body.color ?? "").toUpperCase();
  const allowedColors = type === "LUDO" ? ["RED", "YELLOW", "GREEN", "BLUE"] : ["WHITE", "BLACK"];
  if (!allowedColors.includes(color)) throw badRequest("Choose a valid colour/side");

  const aiCount = type === "LUDO" ? Number(body.aiCount ?? 1) : 1;
  if (!Number.isInteger(aiCount) || aiCount < 1 || aiCount > 3) throw badRequest("AI count must be between 1 and 3");

  const gameId = await createAiGame(user.id, {
    type,
    aiCount,
    difficulty,
    color: color as "RED" | "YELLOW" | "GREEN" | "BLUE" | "WHITE" | "BLACK",
  });

  return ok({ gameId });
});
