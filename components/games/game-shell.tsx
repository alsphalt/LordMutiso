"use client";

import { useGame } from "@/hooks/use-game";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty";
import { ChatWidget } from "@/components/chat/chat-widget";
import { PlayersPanel } from "./players-panel";
import { MoveHistory } from "./move-history";
import { LudoBoard } from "./ludo-board";
import { ChessBoard } from "./chess-board";
import { CheckersBoard } from "./checkers-board";
import { IdleAutoplay } from "./idle-autoplay";
import { TurnStatusPill } from "./chess-ui/turn-pill";
import { BoardStage } from "./chess-ui/board-stage";
import { GAME_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Flag, Play, LogOut, RotateCcw, Bot, MessagesSquare } from "lucide-react";

interface GameShellProps {
  gameId: string;
}

export function GameShell({ gameId }: GameShellProps) {
  const router = useRouter();
  const { snapshot, error, loading, act, refresh, isActing } = useGame(gameId);

  if (loading && !snapshot) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#07030f] z-50">
        <Spinner size={40} className="text-indigo-500 mb-4" />
        <p className="text-slate-400 animate-pulse">Entering arena...</p>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="container max-w-lg mx-auto py-20 px-4">
        <EmptyState
          title="Game Not Found"
          message={error?.message || "This game may have been deleted or you don't have access."}
          action={
            <Button asChild variant="outline">
              <Link href="/lobby">Back to Lobby</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { game, isMyTurn, canStart, isPlayer, mySeatNumber } = snapshot;

  // LOBBY STATE
  if (game.status === "WAITING") {
    return (
      <div className="min-h-screen bg-arena-gradient flex flex-col">
        {/* Glass pill header */}
        <header className="sticky top-0 z-40 shrink-0">
          <div className="mx-auto w-full max-w-6xl px-3 pt-2.5 sm:px-6">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] py-1.5 pl-1.5 pr-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
              <Button asChild variant="ghost" size="sm" className="h-9 w-9 shrink-0 rounded-xl p-0 text-slate-300 hover:text-white">
                <Link href="/lobby">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>

              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <span className="text-lg leading-none">{GAME_TYPES[game.type].emoji}</span>
                <h1 className="truncate font-bold text-sm tracking-tight text-white">
                  {GAME_TYPES[game.type].label} Room
                </h1>
                {game.gameMode === "AI" && (
                  <Badge tone="cyan" className="hidden sm:inline-flex text-[10px] px-1.5 h-5 shrink-0">
                    🤖 AI · {game.aiDifficulty?.toLowerCase()}
                  </Badge>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <Badge tone="amber" className="text-[10px] px-2 h-5">
                  Waiting
                </Badge>
                {isPlayer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-xl px-2.5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                    loading={isActing}
                    onClick={() => act({ action: "leave" })}
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1.5">Leave</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 container max-w-6xl mx-auto p-4 lg:p-8 grid lg:grid-cols-[1fr,360px] gap-6">
          <div className="space-y-6">
            <Card className="p-8 text-center flex flex-col items-center justify-center gap-6 glass-strong shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
              <div className="space-y-2">
                <p className="text-sm text-slate-400 uppercase tracking-widest font-semibold">Room Code</p>
                <div className="flex items-center gap-3">
                  <span className="text-5xl font-black text-white tracking-tighter tabular-nums">
                    {game.roomCode}
                  </span>
                  <CopyButton text={game.roomCode || ""} />
                </div>
              </div>

              <div className="w-full max-w-sm">
                <PlayersPanel snapshot={snapshot} />
              </div>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                {canStart ? (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={isActing}
                    onClick={() => act({ action: "start" })}
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Game
                  </Button>
                ) : (
                  <p className="text-sm text-slate-500 italic">
                    {snapshot.seats.length < 2
                      ? "Waiting for more players..."
                      : "Waiting for host to start..."}
                  </p>
                )}
                {isPlayer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-rose-400"
                    loading={isActing}
                    onClick={() => act({ action: "leave" })}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Leave Room
                  </Button>
                )}
              </div>
            </Card>
          </div>

          <div className="flex flex-col h-[500px] lg:h-auto overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            <ChatWidget gameId={game.id} className="flex-1" />
          </div>
        </div>
      </div>
    );
  }

  // PLAYING / FINISHED / DRAW STATE
  const isOver = ["FINISHED", "DRAW"].includes(game.status);
  const isCancelled = game.status === "CANCELLED";

  if (isCancelled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4 glass-strong">
          <Badge tone="rose">Game Cancelled</Badge>
          <h2 className="text-2xl font-bold text-white">This game was cancelled.</h2>
          <p className="text-slate-400">All players left or the game was aborted.</p>
          <Button asChild variant="primary" className="w-full">
            <Link href="/lobby">Return to Lobby</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const result = isOver ? (game.winnerPlayerNumber === mySeatNumber ? "WIN" : game.status === "DRAW" ? "DRAW" : "LOSS") : null;
  const winnerSeat = isOver ? snapshot.seats.find(s => s.playerNumber === game.winnerPlayerNumber) : null;
  const isAiMode = game.gameMode === "AI";
  const difficultyLabel = game.aiDifficulty
    ? game.aiDifficulty.charAt(0) + game.aiDifficulty.slice(1).toLowerCase()
    : "";
  const statusLabel = isOver ? (game.status === "DRAW" ? "Draw" : "Finished") : "Playing";

  return (
    <div className="min-h-screen bg-arena-gradient flex flex-col">
      {/* Auto-play watchdog after 15s of inactivity on the player's turn (logic only — the
          visible countdown lives in TurnStatusPill below) */}
      <IdleAutoplay snapshot={snapshot} act={act} />

      {/* ---------------------------------------------------------------- */}
      {/* 1 · TOP HEADER — compact translucent rounded pill                  */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 shrink-0">
        <div className="mx-auto w-full max-w-[min(94vw,720px)] px-2 pt-2.5 sm:px-3">
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-1.5 pr-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
            {/* back — rounded square */}
            <Button asChild variant="ghost" size="sm" className="h-9 w-9 shrink-0 rounded-xl p-0 text-slate-300 hover:text-white">
              <Link href="/lobby" aria-label="Back to lobby">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>

            {/* centre-left status cluster */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              {isAiMode && <Bot className="h-3.5 w-3.5 shrink-0 text-cyan-400" />}
              <span
                className={cn(
                  "truncate text-[11px] font-bold tracking-wide",
                  isAiMode ? "text-cyan-300" : "text-slate-100"
                )}
              >
                {isAiMode ? `AI · ${difficultyLabel}` : "ONLINE"}
              </span>
              <span className="mx-0.5 h-3 w-px shrink-0 bg-white/10" />
              <span className="flex shrink-0 items-center gap-1.5">
                <span className={cn("relative flex h-1.5 w-1.5", isOver && "opacity-40")}>
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full rounded-full opacity-60",
                      isOver ? "bg-slate-400" : "bg-emerald-400 animate-ping"
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex h-1.5 w-1.5 rounded-full",
                      isOver ? "bg-slate-400" : "bg-emerald-400"
                    )}
                  />
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {statusLabel}
                </span>
              </span>
            </div>

            {/* right actions — small rounded-square chips */}
            <div className="flex shrink-0 items-center gap-1.5">
              {!isOver && isPlayer && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-xl px-2.5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                  onClick={() => {
                    if (confirm("Are you sure you want to resign?")) act({ action: "resign" });
                  }}
                >
                  <Flag className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1.5 text-xs">Resign</span>
                </Button>
              )}
              {isOver && isPlayer && (
                <Button
                  variant="success"
                  size="sm"
                  className="h-9 rounded-xl px-3 text-xs shadow-[0_0_16px_rgba(34,197,94,0.25)]"
                  onClick={() => act({ action: "rematch" })}
                  loading={isActing}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Rematch
                </Button>
              )}
              <span className="hidden lg:flex items-center font-mono text-[10px] text-slate-500 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                #{game.roomCode}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* MAIN — single centered column: board → players → panels           */}
      {/* ---------------------------------------------------------------- */}
      <main className="mx-auto w-full max-w-[min(94vw,720px)] flex-1 px-3 sm:px-4 pb-[max(env(safe-area-inset-bottom),2rem)]">
        <div className="flex flex-col gap-5 pt-2.5 sm:pt-3">
          {/* 2 · AUTO TIMER / AI-THINKING PILL (fixed-height slot, centered) */}
          <div className="flex min-h-[30px] items-center justify-center">
            <TurnStatusPill snapshot={snapshot} />
          </div>

          {/* 3 · BOARD — premium stage, square, dominates the screen */}
          <section className="flex flex-col">
            <div className="mx-auto w-full max-w-[min(92vw,600px)]">
              <BoardStage>
                {game.type === "LUDO" && <LudoBoard snapshot={snapshot} act={act} isActing={isActing} />}
                {game.type === "CHESS" && <ChessBoard snapshot={snapshot} act={act} isActing={isActing} />}
                {game.type === "CHECKERS" && <CheckersBoard snapshot={snapshot} act={act} isActing={isActing} />}
              </BoardStage>
            </div>
          </section>

          {/* 4 · PLAYERS */}
          <PlayersPanel snapshot={snapshot} />

          {/* 5 · MOVE HISTORY + 6 · SIDE/AI PANEL — stacked on phones, 2-up from md */}
          <section className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">
            {/* Move history */}
            <div className="h-[280px] md:h-[340px]">
              <MoveHistory snapshot={snapshot} />
            </div>

            {/* Second panel: game chat (ONLINE) or disabled chat (AI) */}
            <div className="flex h-[280px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl md:h-[340px]">
              <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
                <MessagesSquare className="h-3.5 w-3.5 text-cyan-300/80" />
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  {isAiMode ? "AI Assistant" : "Match Chat"}
                </span>
                {!isAiMode && (
                  <span className="ml-auto flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    live
                  </span>
                )}
              </div>
              {!isAiMode ? (
                <ChatWidget gameId={game.id} compact className="min-h-0 flex-1" />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/5 bg-white/[0.03]">
                    <Bot className="h-6 w-6 text-slate-600" />
                  </div>
                  <p className="text-[11px] font-medium text-slate-500">
                    Chat is disabled in AI mode
                  </p>
                  <p className="max-w-[220px] text-[10px] leading-relaxed text-slate-600">
                    You are facing an arena bot — no other players are in this match.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Victory/Loss Overlay */}
      {isOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
          <Card className="max-w-sm w-full p-8 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] border-white/20 glass-strong overflow-hidden relative">
            {/* Result glow */}
            <div className={cn(
              "absolute inset-0 -z-10 opacity-20 blur-3xl",
              result === "WIN" ? "bg-green-500" : result === "DRAW" ? "bg-blue-500" : "bg-rose-500"
            )} />

            <div className="space-y-6">
              {isAiMode ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">GAME OVER 🎉</p>
                    <h2 className={cn(
                      "text-4xl font-black italic tracking-tighter",
                      result === "WIN" ? "text-green-400" : result === "DRAW" ? "text-blue-400" : "text-rose-400"
                    )}>
                      {result === "WIN" ? "Winner: You" : result === "DRAW" ? "Draw" : `Winner: ${winnerSeat?.isAi ? '🤖 ' : ''}${winnerSeat?.username || 'Bot'}`}
                    </h2>
                  </div>
                  <Badge tone="cyan" className="uppercase tracking-widest text-[10px]">
                    Mode: AI · Difficulty: {game.aiDifficulty}
                  </Badge>

                  <div className="flex flex-col gap-2 pt-4">
                    <Button
                      variant="primary"
                      className="w-full h-12 italic font-black"
                      onClick={() => act({ action: "rematch" })}
                      loading={isActing}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      PLAY AGAIN
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="text-xs font-bold" onClick={() => router.push('/lobby')}>
                        Choose Another
                      </Button>
                      <Button variant="ghost" className="text-xs font-bold" onClick={() => router.push('/')}>
                        Dashboard
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Match Result</p>
                    <h2 className={cn(
                      "text-5xl font-black italic tracking-tighter",
                      result === "WIN" ? "text-green-400" : result === "DRAW" ? "text-blue-400" : "text-rose-400"
                    )}>
                      {result === "WIN" ? "VICTORY" : result === "DRAW" ? "DRAW" : "DEFEAT"}
                    </h2>
                  </div>

                  {winnerSeat && (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Winner</p>
                      <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                        <span className="text-sm font-bold text-white truncate max-w-[120px]">
                          {(winnerSeat.isAi ? "🤖 " : "") + winnerSeat.username}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/lobby">Lobby</Link>
                    </Button>
                    {isPlayer && (
                      <Button
                        variant="primary"
                        className="w-full"
                        onClick={() => act({ action: "rematch" })}
                        loading={isActing}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Rematch
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
