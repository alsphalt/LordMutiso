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
import { GAME_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Flag, Play, LogOut, RotateCcw, Bot } from "lucide-react";

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
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-white/10 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/lobby">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Lobby
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xl">{GAME_TYPES[game.type].emoji}</span>
              <h1 className="font-bold text-white tracking-tight">{GAME_TYPES[game.type].label} Room</h1>
            </div>
            {game.gameMode === 'AI' && (
              <Badge tone="cyan" className="ml-2">🤖 AI · {game.aiDifficulty?.toLowerCase()}</Badge>
            )}
          </div>
          <Badge tone="amber">Waiting</Badge>
        </div>

        <div className="flex-1 container max-w-6xl mx-auto p-4 lg:p-8 grid lg:grid-cols-[1fr,360px] gap-8">
          <div className="space-y-8">
            <Card className="p-8 text-center flex flex-col items-center justify-center gap-6 glass-strong">
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

  return (
    <div className="min-h-screen bg-arena-gradient flex flex-col h-screen overflow-hidden">
      {/* Auto-play after 15s of inactivity on the player's turn */}
      <IdleAutoplay snapshot={snapshot} act={act} />
      {/* Play Header */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-white/10 bg-black/40 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="xs" className="h-8 w-8 p-0 rounded-full">
            <Link href="/lobby"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-lg">{GAME_TYPES[game.type].emoji}</span>
            <span className="font-bold text-sm tracking-tight text-white hidden sm:inline">
              {GAME_TYPES[game.type].label}
            </span>
            {game.gameMode === "AI" && game.aiDifficulty && (
              <Badge tone="cyan" className="text-[10px] px-1.5 h-5 ml-1">
                🤖 AI · {game.aiDifficulty.charAt(0) + game.aiDifficulty.slice(1).toLowerCase()}
              </Badge>
            )}
          </div>
          <Badge tone={isOver ? "slate" : "green"} className="text-[10px] px-1.5 h-5">
            {isOver ? (game.status === "DRAW" ? "Draw" : "Finished") : "Playing"}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          {!isOver && isPlayer && (
            <div className="flex items-center gap-2">
              <div className={cn(
                "hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                isMyTurn ? "bg-indigo-500/20 text-indigo-400 animate-pulse" : "bg-white/5 text-slate-500"
              )}>
                {isMyTurn ? "Your Turn" : "Opponent Turn"}
              </div>
              <Button 
                variant="ghost" 
                size="xs" 
                className="text-slate-500 hover:text-rose-400 h-8"
                onClick={() => {
                  if (confirm("Are you sure you want to resign?")) act({ action: "resign" });
                }}
              >
                <Flag className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Resign</span>
              </Button>
            </div>
          )}
          {isOver && isPlayer && (
            <Button 
              variant="success" 
              size="xs" 
              className="h-8 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
              onClick={() => act({ action: "rematch" })}
              loading={isActing}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Rematch
            </Button>
          )}
          <div className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-1 rounded border border-white/5 hidden xs:block">
            #{game.roomCode}
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
        {/* Main Board Area */}
        <main className="flex-1 relative flex flex-col items-center justify-center p-4 lg:p-8 min-h-0">
          <div className="relative w-full max-w-[min(92vw,560px)] aspect-square">
             {game.type === "LUDO" && <LudoBoard snapshot={snapshot} act={act} isActing={isActing} />}
             {game.type === "CHESS" && <ChessBoard snapshot={snapshot} act={act} isActing={isActing} />}
             {game.type === "CHECKERS" && <CheckersBoard snapshot={snapshot} act={act} isActing={isActing} />}
          </div>
        </main>

        {/* Side Panel (Desktop) / Bottom Panel (Mobile) */}
        <aside className="w-full lg:w-[360px] border-t lg:border-t-0 lg:border-l border-white/10 bg-black/20 flex flex-col min-h-0 h-[40vh] lg:h-auto">
          <div className="flex-1 flex flex-col p-4 gap-6 overflow-hidden">
            <div className="shrink-0">
              <PlayersPanel snapshot={snapshot} />
            </div>
            
            <div className="flex-1 flex flex-col min-h-0 gap-4">
              <div className="flex-1 flex flex-col min-h-0">
                {game.gameMode !== 'AI' ? (
                  <ChatWidget gameId={game.id} compact className="h-full" />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-xs italic gap-2 p-8 text-center glass border-dashed border-white/5">
                    <Bot size={32} className="opacity-20" />
                    Chat is disabled in AI mode
                  </div>
                )}
              </div>
              <div className="h-[200px] shrink-0">
                <MoveHistory snapshot={snapshot} />
              </div>
            </div>
          </div>
        </aside>

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
                 {game.gameMode === 'AI' ? (
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
    </div>
  );
}
