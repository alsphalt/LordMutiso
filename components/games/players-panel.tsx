"use client";

import { useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { COLOR_HEX, COLOR_LABEL, type GameSnapshot, type GamePlayerDTO } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface PlayersPanelProps {
  snapshot: GameSnapshot;
}

/** PLAYERS section — label + one large glass card per seat. */
export function PlayersPanel({ snapshot }: PlayersPanelProps) {
  const { game, seats } = snapshot;

  return (
    <section className="flex flex-col gap-2.5">
      <p className="px-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
        Players
      </p>
      <div
        className={cn(
          "grid gap-2.5",
          // 2-up once cards have enough room; stack full width on very narrow screens
          seats.length > 2 ? "grid-cols-1 min-[460px]:grid-cols-2" : "grid-cols-1 min-[400px]:grid-cols-2"
        )}
      >
        {seats.map((seat) => (
          <PlayerCard key={seat.id} seat={seat} snapshot={snapshot} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Per-seat card                                                       */
/* ------------------------------------------------------------------ */

function PlayerCard({ seat, snapshot }: { seat: GamePlayerDTO; snapshot: GameSnapshot }) {
  const { game, mySeatNumber } = snapshot;
  const isTurn = game.status === "PLAYING" && game.currentTurn === seat.playerNumber;
  const isMe = mySeatNumber === seat.playerNumber;
  const status = getPlayerStatus(seat, snapshot);
  const accent = seat.isAi ? "cyan" : "purple";
  const hasClock = game.type === "CHESS";

  return (
    <article
      className={cn(
        "relative flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-300 min-w-0",
        isTurn
          ? seat.isAi
            ? "border-cyan-400/45 bg-cyan-400/[0.06] shadow-[0_0_26px_-6px_rgba(34,211,238,0.5)]"
            : "border-violet-400/45 bg-violet-500/[0.07] shadow-[0_0_26px_-6px_rgba(139,92,246,0.55)]"
          : "border-white/5 bg-white/[0.03]",
        !isTurn && isMe && "border-violet-400/15"
      )}
    >
      {/* soft turn indicator rail */}
      {isTurn && (
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full",
            seat.isAi ? "bg-cyan-400" : "bg-violet-400"
          )}
        />
      )}

      <PlayerAvatar seat={seat} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "truncate text-[13px] font-semibold leading-tight",
              seat.isAi ? "text-cyan-100" : "text-slate-100",
              !isTurn && "opacity-80"
            )}
          >
            {seat.username}
          </span>
          {seat.isAi && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
          {isMe && (
            <span className="shrink-0 rounded-md border border-violet-400/25 bg-violet-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-violet-300">
              (You)
            </span>
          )}
        </div>

        <div className="flex min-h-[16px] items-center gap-1.5">
          {status ? (
            <StatusChip status={status} />
          ) : (
            <>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: COLOR_HEX[seat.color], opacity: 0.9 }}
              />
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {COLOR_LABEL[seat.color]}
              </span>
              {isTurn && (
                <span
                  className={cn(
                    "ml-0.5 text-[9px] font-bold uppercase tracking-[0.14em]",
                    seat.isAi ? "text-cyan-300" : "text-violet-300"
                  )}
                >
                  {seat.isAi ? "· thinking" : "· your turn"}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* right slot: live chess clock (CHESS) or seat colour tag (other games) */}
      {hasClock ? (
        <ChessClock snapshot={snapshot} playerNumber={seat.playerNumber} />
      ) : (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="h-2 w-2 rounded-full ring-2 ring-black/40"
            style={{ backgroundColor: COLOR_HEX[seat.color] }}
          />
          <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-slate-600">
            {seat.playerNumber === 1 ? "P1" : `P${seat.playerNumber}`}
          </span>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar: cyan robot bubble for AI seats, purple initials for humans  */
/* ------------------------------------------------------------------ */

function initialsOf(name: string): string {
  const clean = name.replace(/\(.*?\)/g, "").trim();
  const parts = clean.split(/[\s_-]+/).filter(Boolean);
  const base = parts.length > 0 ? parts : [clean || "?"];
  return base
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function PlayerAvatar({ seat }: { seat: GamePlayerDTO }) {
  const size = 44;
  if (seat.isAi) {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div
          className="grid h-full w-full place-items-center rounded-full border border-cyan-300/40 text-white shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)]"
          style={{
            background: "linear-gradient(145deg, #22d3ee 0%, #0e7490 60%, #155e75 100%)",
          }}
        >
          <Bot className="h-6 w-6" strokeWidth={2.1} />
        </div>
        {/* seat colour dot */}
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0a0518]"
          style={{ backgroundColor: COLOR_HEX[seat.color] }}
        />
      </div>
    );
  }

  const hasImage = !!seat.image;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="grid h-full w-full place-items-center overflow-hidden rounded-full border border-violet-300/40 shadow-[0_0_16px_-4px_rgba(139,92,246,0.55)]"
        style={{
          background: hasImage
            ? "linear-gradient(145deg, #7c3aed 0%, #4c1d95 70%, #312e81 100%)"
            : "linear-gradient(145deg, #a78bfa 0%, #7c3aed 55%, #4c1d95 100%)",
        }}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={seat.image || undefined} alt={seat.username} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[15px] font-black tracking-tight text-white/95" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>
            {initialsOf(seat.username)}
          </span>
        )}
      </div>
      <span
        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0a0518]"
        style={{ backgroundColor: COLOR_HEX[seat.color] }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status / clock helpers                                              */
/* ------------------------------------------------------------------ */

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "Winner"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
      : status === "Draw"
      ? "border-sky-400/25 bg-sky-500/10 text-sky-300"
      : status === "Lost" || status === "Resigned"
      ? "border-rose-400/25 bg-rose-500/10 text-rose-300"
      : "border-white/10 bg-white/5 text-slate-400";
  return (
    <span className={cn("rounded-md border px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.14em]", tone)}>
      {status}
    </span>
  );
}

function getPlayerStatus(seat: GamePlayerDTO, snapshot: GameSnapshot): string | null {
  const { game, state } = snapshot;

  if (game.status === "FINISHED") {
    return game.winnerPlayerNumber === seat.playerNumber ? "Winner" : "Lost";
  }

  // Engine-specific state if available
  if (game.type === "LUDO" && state) {
    const ludoState = state as any;
    if (ludoState.done?.includes(seat.playerNumber)) return "Winner";
    if (ludoState.resigned?.includes(seat.playerNumber)) return "Resigned";
  } else if (game.type === "CHECKERS" && game.status === "DRAW") {
    return "Draw";
  }

  return null;
}

/** Live mm:ss countdown for chess — locally ticking, never written to the server. */
function ClockDisplay({ baseRemaining, isTurn, lastTickMs }: { baseRemaining: number; isTurn: boolean; lastTickMs: number }) {
  const [currentMs, setCurrentMs] = useState(baseRemaining);

  useEffect(() => {
    if (!isTurn) {
      setCurrentMs(baseRemaining);
      return;
    }
    const interval = setInterval(() => {
      const elapsedSinceLastTick = Date.now() - lastTickMs;
      const remaining = Math.max(0, baseRemaining - elapsedSinceLastTick);
      setCurrentMs(remaining);
    }, 500);
    return () => clearInterval(interval);
  }, [baseRemaining, isTurn, lastTickMs]);

  const totalSec = Math.floor(currentMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const low = totalSec <= 30;

  return (
    <span
      className={cn(
        "shrink-0 rounded-lg border px-2 py-1 font-mono text-[13px] font-bold tabular-nums leading-none",
        isTurn
          ? low
            ? "border-rose-400/40 bg-rose-500/10 text-rose-300"
            : "border-cyan-400/20 bg-black/30 text-cyan-100 shadow-[0_0_12px_-4px_rgba(34,211,238,0.4)]"
          : "border-white/5 bg-black/20 text-slate-500"
      )}
    >
      {m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}
    </span>
  );
}

function ChessClock({ snapshot, playerNumber }: { snapshot: GameSnapshot; playerNumber: number }) {
  const { game, state } = snapshot;
  if (game.type !== "CHESS") return null;

  const chessState = state as any;
  const isWhite = playerNumber === 1;
  const baseRemaining = isWhite ? chessState.wMs : chessState.bMs;
  const isTurn = game.status === "PLAYING" && game.currentTurn === playerNumber;

  if (typeof baseRemaining !== "number" || typeof chessState.lastTickMs !== "number") return null;

  return (
    <ClockDisplay
      baseRemaining={baseRemaining}
      isTurn={isTurn}
      lastTickMs={chessState.lastTickMs}
    />
  );
}
