"use client";

import { useState, useEffect, useCallback } from "react";
import { useGame } from "@/hooks/use-game";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty";
import { ChatWidget } from "@/components/chat/chat-widget";
import { Modal } from "@/components/ui/modal";
import { PlayersPanel } from "./players-panel";
import { MoveHistory } from "./move-history";
import { LudoBoard } from "./ludo-board";
import { ChessBoard } from "./chess-board";
import { CheckersBoard } from "./checkers-board";
import { IdleAutoplay } from "./idle-autoplay";
import { TurnStatusPill } from "./chess-ui/turn-pill";
import { BoardStage } from "./chess-ui/board-stage";
import { GAME_TYPES, CHAT_MAX_LENGTH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api } from "@/hooks/api";
import { useToast } from "@/components/ui/toast";
import { getChessView, setChessView, subscribeChessView, type ChessView } from "./chess-view-store";
import type { GamePlayerDTO } from "@/lib/games/types";
import Link from "next/link";
import {
  ArrowLeft,
  Flag,
  Play,
  LogOut,
  RotateCcw,
  Bot,
  MessagesSquare,
  Settings2,
  MoreVertical,
  Send,
  Copy,
  ShieldAlert,
} from "lucide-react";

interface GameShellProps {
  gameId: string;
}

export function GameShell({ gameId }: GameShellProps) {
  const router = useRouter();
  const { snapshot, error, loading, act, refresh, isActing } = useGame(gameId);
  const { push: toast } = useToast();

  // Header settings (gear) + match menu (⋮) + bottom chat dock — chess screens.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dockMsg, setDockMsg] = useState("");
  const [dockSending, setDockSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [chessView, setChessViewLocal] = useState<ChessView>("3D");

  useEffect(() => {
    // Hydrate a persisted preference once on the client (after first paint) so
    // SSR HTML and the initial hydration render always agree on "3D".
    const unsub = subscribeChessView((v) => setChessViewLocal(v));
    const saved = getChessView();
    setChessViewLocal(saved);
    setChessView(saved);
    return unsub;
  }, []);

  const pickChessView = useCallback(
    (v: ChessView) => {
      setChessView(v);
      setSettingsOpen(false);
      setMenuOpen(false);
    },
    []
  );

  /** Bottom-dock composer — posts to the match chat then pokes open widgets. */
  const sendDockMessage = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = dockMsg.trim();
      if (!text || dockSending) return;
      setDockSending(true);
      try {
        await api(`/api/games/${gameId}/chat`, {
          method: "POST",
          body: JSON.stringify({ message: text }),
        });
        setDockMsg("");
        window.dispatchEvent(new CustomEvent("dna:chat-refresh", { detail: { path: `/api/games/${gameId}/chat` } }));
      } catch (err: any) {
        if (err?.status === 429) {
          toast({ title: "Slow down!", message: "You are sending messages too fast", tone: "error" });
        } else {
          toast({ title: "Could not send", message: err?.message || "Please try again", tone: "error" });
        }
      } finally {
        setDockSending(false);
      }
    },
    [dockMsg, dockSending, gameId, toast]
  );

  const copyRoomCode = useCallback(async () => {
    const code = snapshot?.game?.roomCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "Copied", message: `Room code ${code} copied`, tone: "success" });
    } catch {
      toast({ title: "Copy failed", message: "Could not access the clipboard", tone: "error" });
    }
    setMenuOpen(false);
  }, [snapshot, toast]);

  /** Real human opponents in this match (excludes AI seats and me). */
  const humanOpponents = (snapshot?.seats ?? []).filter(
    (s) => !s.isAi && s.userId && s.playerNumber !== snapshot?.mySeatNumber
  );

  const openReport = useCallback(() => {
    setMenuOpen(false);
    if (humanOpponents.length === 0) {
      toast({ title: "No one to report", message: "There are no other players in this match", tone: "info" });
      return;
    }
    setReportTargetId(humanOpponents[0].userId);
    setReportReason("");
    setReportOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [humanOpponents.length, toast]);

  const submitReport = useCallback(async () => {
    if (!reportTargetId) return;
    setReporting(true);
    try {
      await api("/api/social/moderation", {
        method: "POST",
        body: JSON.stringify({ action: "report", userId: reportTargetId, reason: reportReason }),
      });
      toast({ title: "Report sent", message: "Our team will review this player", tone: "success" });
      setReportOpen(false);
      setReportReason("");
    } catch (err: any) {
      toast({ title: "Report failed", message: err?.message || "Please try again", tone: "error" });
    } finally {
      setReporting(false);
    }
  }, [reportTargetId, reportReason, toast]);

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
  const isChess = game.type === "CHESS";
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
        <div className="relative mx-auto w-full max-w-[min(94vw,720px)] px-2 pt-2.5 sm:px-3">
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
              {isChess && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Match settings"
                  onClick={() => {
                    setSettingsOpen((v) => !v);
                    setMenuOpen(false);
                  }}
                  className={cn(
                    "h-9 w-9 rounded-xl p-0 text-slate-400 hover:text-white",
                    settingsOpen && "bg-white/10 text-white"
                  )}
                >
                  <Settings2 className="w-4 h-4" />
                </Button>
              )}
              <span className="hidden lg:flex items-center font-mono text-[10px] text-slate-500 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                #{game.roomCode}
              </span>
            </div>
          </div>

          {/* settings popover — board view (chess) */}
          {isChess && settingsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right animate-in fade-in zoom-in duration-150 rounded-2xl border border-white/15 bg-[#150b2b]/95 p-2 shadow-[0_16px_50px_rgba(0,0,0,0.65),0_0_30px_-8px_rgba(139,92,246,0.35)] backdrop-blur-xl">
                <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Board Style
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { value: "3D", mark: "◈", label: "3D Board" },
                      { value: "2D", mark: "▦", label: "2D Board" },
                    ] as const
                  ).map((opt) => {
                    const active = chessView === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => pickChessView(opt.value)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-colors",
                          active
                            ? "border-violet-400/50 bg-violet-500/20 text-white shadow-[0_0_14px_-4px_rgba(139,92,246,0.6)]"
                            : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <span>{opt.mark}</span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {game.roomCode && (
                  <>
                    <div className="my-2 h-px bg-white/[0.07]" />
                    <button
                      type="button"
                      onClick={() => void copyRoomCode()}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <Copy size={13} className="text-slate-500" />
                      Copy room code
                      <span className="ml-auto font-mono text-[10px] text-slate-500">{game.roomCode}</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* MAIN — single centered column: board → players → panels           */}
      {/* ---------------------------------------------------------------- */}
      <main
        className={cn(
          "mx-auto w-full max-w-[min(94vw,720px)] flex-1 px-3 sm:px-4",
          isChess ? "pb-[calc(env(safe-area-inset-bottom)+5.75rem)]" : "pb-[max(env(safe-area-inset-bottom),2rem)]"
        )}
      >
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
                // Composer lives in the bottom dock on chess screens; the panel
                // is a live read-only feed there. Other games keep the inline composer.
                <ChatWidget gameId={game.id} compact hideComposer={isChess} className="min-h-0 flex-1" />
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

      {/* ---------------------------------------------------------------- */}
      {/* CHESS ONLY — bottom composer dock: menu (⋮) · message · send      */}
      {/* ---------------------------------------------------------------- */}
      {isChess && (
        <div className="fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto w-full max-w-[min(94vw,720px)] px-3 pb-[max(env(safe-area-inset-bottom),0.7rem)]">
            <div className="relative">
              {/* match menu popover (anchored above the dock) */}
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-72 origin-bottom-left animate-in fade-in zoom-in duration-150 rounded-2xl border border-white/15 bg-[#150b2b]/95 p-1.5 shadow-[0_16px_50px_rgba(0,0,0,0.7),0_0_30px_-8px_rgba(139,92,246,0.35)] backdrop-blur-xl">
                    <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Match Menu
                    </p>

                    {/* quick board-style toggle */}
                    <div className="grid grid-cols-2 gap-1.5 px-1 pb-1.5">
                      {(
                        [
                          { value: "3D", mark: "◈", label: "3D" },
                          { value: "2D", mark: "▦", label: "2D" },
                        ] as const
                      ).map((opt) => {
                        const active = chessView === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => pickChessView(opt.value)}
                            className={cn(
                              "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors",
                              active
                                ? "border-violet-400/50 bg-violet-500/20 text-white"
                                : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <span>{opt.mark}</span>
                            {opt.label} Board
                          </button>
                        );
                      })}
                    </div>

                    <div className="mx-1 my-1 h-px bg-white/[0.07]" />

                    {humanOpponents.length > 0 && (
                      <button
                        type="button"
                        onClick={openReport}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-rose-300/90 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                      >
                        <ShieldAlert size={14} className="shrink-0" />
                        Report player…
                      </button>
                    )}
                    {game.roomCode && (
                      <button
                        type="button"
                        onClick={() => void copyRoomCode()}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-200 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <Copy size={14} className="shrink-0 text-slate-400" />
                        Copy room code
                        <span className="ml-auto font-mono text-[10px] uppercase text-slate-500">#{game.roomCode}</span>
                      </button>
                    )}
                    {!isOver && isPlayer && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          if (window.confirm("Are you sure you want to resign?")) act({ action: "resign" });
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-200 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <Flag size={14} className="shrink-0 text-slate-400" />
                        Resign match
                      </button>
                    )}
                    {isOver && isPlayer && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          act({ action: "rematch" });
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-emerald-300/90 transition-colors hover:bg-emerald-500/10"
                      >
                        <RotateCcw size={14} className="shrink-0" />
                        Rematch
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/lobby");
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-200 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <LogOut size={14} className="shrink-0 text-slate-400" />
                      Back to Lobby
                    </button>
                  </div>
                </>
              )}

              {/* the dock bar itself */}
              <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-[#0e0619]/90 py-1.5 pl-1.5 pr-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.55),0_0_26px_-10px_rgba(139,92,246,0.5)] backdrop-blur-xl">
                <button
                  type="button"
                  aria-label="Match menu"
                  onClick={() => {
                    setMenuOpen((v) => !v);
                    setSettingsOpen(false);
                  }}
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-white/5 hover:text-white",
                    menuOpen && "bg-white/10 text-white"
                  )}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                <form onSubmit={sendDockMessage} className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    value={dockMsg}
                    onChange={(e) => setDockMsg(e.target.value.slice(0, CHAT_MAX_LENGTH))}
                    disabled={isAiMode || dockSending}
                    placeholder={isAiMode ? "Chat is disabled in AI mode" : "Type a message..."}
                    aria-label="Match chat message"
                    className={cn(
                      "min-w-0 flex-1 rounded-xl border bg-black/30 px-3.5 py-2.5 text-[13px] text-white outline-none transition-colors placeholder:text-slate-500",
                      isAiMode ? "border-white/5 opacity-60" : "border-white/10 focus:border-violet-400/40"
                    )}
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={isAiMode || dockSending || !dockMsg.trim()}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_0_16px_-4px_rgba(139,92,246,0.8)] transition-all enabled:hover:brightness-110 enabled:active:scale-90 disabled:opacity-30"
                  >
                    {dockSending ? <Spinner size={15} className="text-white" /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report player dialog */}
      {reportOpen && (
        <Modal open onClose={() => setReportOpen(false)} title="Report a player">
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-slate-400">
              Tell us who and why — our team reviews every report. Abusive behaviour or cheating ends with action.
            </p>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Player</p>
              {humanOpponents.map((s: GamePlayerDTO) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setReportTargetId(s.userId)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    reportTargetId === s.userId
                      ? "border-rose-400/50 bg-rose-500/10"
                      : "border-white/10 hover:bg-white/5"
                  )}
                >
                  <span className="text-sm font-bold text-white">{s.username}</span>
                  {reportTargetId === s.userId && <span className="ml-auto text-[10px] font-black text-rose-300">SELECTED</span>}
                </button>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Reason (optional)</p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="e.g. abusive chat, stalling, cheating…"
                className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-rose-400/40"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={reporting}
                disabled={!reportTargetId || reporting}
                onClick={() => void submitReport()}
              >
                <ShieldAlert size={15} className="mr-1.5" /> Submit Report
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
