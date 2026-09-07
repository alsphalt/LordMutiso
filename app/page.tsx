"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gamepad2, Trophy, Users, History, ArrowRight, Play, ChevronRight, Star } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useApiPoll } from "@/hooks/api";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Stat } from "@/components/ui/stat";
import { Spinner } from "@/components/ui/spinner";
import { ChatWidget } from "@/components/chat/chat-widget";
import { GameCard } from "@/components/games/game-card";
import { GameModeDialog } from "@/components/games/game-mode-dialog";
import { GAME_TYPE_LIST, STATUS_LABEL } from "@/lib/constants";
import { cn, fmtDate } from "@/lib/utils";
import { GameTypeName } from "@/lib/games/types";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [openFor, setOpenFor] = React.useState<GameTypeName | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LandingView />
        <GameModeDialog 
          open={!!openFor} 
          onClose={() => setOpenFor(null)} 
          type={openFor || "LUDO"} 
        />
      </>
    );
  }

  return (
    <>
      <DashboardView user={user} setOpenFor={setOpenFor} />
      <GameModeDialog 
        open={!!openFor} 
        onClose={() => setOpenFor(null)} 
        type={openFor || "LUDO"} 
      />
    </>
  );
}

function LandingView() {
  // We can't use setOpenFor here easily since it's a separate component, 
  // but we can lift it or just keep it as is since landing redirects to register.
  // Actually, the prompt says "dashboard — replace direct game-card...".
  // Landing usually just leads to auth.
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Hero Section */}
      <main className="relative z-10 pt-20 pb-32 px-4 flex flex-col items-center">
        <div className="animate-pop-in flex flex-col items-center text-center max-w-4xl">
          <Logo size="lg" className="mb-8" />
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none text-white italic uppercase">
            Battle for <span className="text-gradient">Glory</span> <br />
            in the Digital Arena
          </h1>
          <p className="mt-6 text-xl text-slate-400 max-w-2xl leading-relaxed">
            Multiplayer Ludo, Chess, and Checkers. Real-time competition, 
            global leaderboards, and a premium gaming experience.
          </p>
          
          <div className="mt-12 flex flex-wrap justify-center gap-6">
            <Link href="/register">
              <Button size="lg" className="h-16 px-10 text-lg italic font-black tracking-widest gap-3">
                JOIN THE ARENA <ArrowRight size={20} />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="h-16 px-10 text-lg italic font-black tracking-widest">
                LOG IN
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
          {GAME_TYPE_LIST.map((type) => (
            <div key={type} className="animate-pop-in" style={{ animationDelay: type === 'CHESS' ? '100ms' : type === 'CHECKERS' ? '200ms' : '0ms' }}>
              <GameCard type={type} onPlay={() => window.location.href = '/register'} />
            </div>
          ))}
        </div>
      </main>

      {/* Decorative background elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[800px] pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,#8b5cf6_0%,transparent_70%)]" />
      </div>
    </div>
  );
}

function DashboardView({ user, setOpenFor }: { user: any, setOpenFor: (type: GameTypeName) => void }) {
  const router = useRouter();
  const { data: onlineData } = useApiPoll<{ count: number; users: any[] }>("/api/online", 15000);
  const { data: myGamesData } = useApiPoll<{ games: any[] }>("/api/games/mine", 5000);
  const { data: roomsData } = useApiPoll<{ rooms: any[]; activeCount: number }>("/api/rooms", 6000);
  const { data: leaderboardData } = useApiPoll<{ rows: any[] }>("/api/leaderboard?game=OVERALL&limit=5", 30000);

  return (
    <div className="animate-fade-in space-y-10 py-6 px-4 max-w-7xl mx-auto">
      {/* Welcome & Stats */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black italic tracking-tight text-white uppercase">
            Welcome back, <span className="text-gradient">{user.username}</span>
          </h1>
          <p className="text-slate-500 font-medium">Ready for your next victory?</p>
        </div>
        
        <div className="grid grid-cols-2 sm:flex gap-4">
          <Stat label="Total Online" value={onlineData?.count || 0} accent />
          <Stat label="Active Games" value={myGamesData?.games?.length || 0} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Play & Matches */}
        <div className="lg:col-span-8 space-y-10">
          {/* Play Now */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold uppercase italic tracking-widest text-white flex items-center gap-3">
                <Play size={20} className="text-arena-blue fill-arena-blue" />
                Play Now
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {GAME_TYPE_LIST.map((type) => (
                <GameCard key={type} type={type as GameTypeName} onPlay={() => setOpenFor(type as GameTypeName)} />
              ))}
            </div>
          </section>

          {/* Active Matches */}
          {myGamesData && myGamesData.games && myGamesData.games.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold uppercase italic tracking-widest text-white flex items-center gap-3">
                  <Gamepad2 size={22} className="text-arena-purple" />
                  Your Matches
                </h2>
                <Link href="/history" className="text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest">
                  View All
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {myGamesData.games.map((game: any) => (
                  <Card key={game.id} className="p-4 flex items-center justify-between group hover:bg-white/[0.08] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl border border-white/10 group-hover:border-white/20 transition-colors">
                        {game.type === 'LUDO' ? '🎲' : game.type === 'CHESS' ? '♟️' : '🔴'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white uppercase italic text-sm">{game.type}</p>
                          <Badge tone={game.status === 'PLAYING' ? 'green' : 'amber'}>{STATUS_LABEL[game.status]}</Badge>
                          {game.gameMode === 'AI' && <Badge tone="cyan">🤖 AI</Badge>}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-tighter">
                          vs {game.seats.filter((s: string) => s !== user.username).join(', ') || 'Waiting...'}
                        </p>
                      </div>
                    </div>
                    <Link href={`/play/${game.id}`}>
                      <Button size="sm" variant="primary" className="italic font-black text-xs px-4">
                        RESUME
                      </Button>
                    </Link>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Live Arena */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold uppercase italic tracking-widest text-white flex items-center gap-3">
                <Users size={22} className="text-cyan-400" />
                Live Arena
              </h2>
            </div>
            <div className="glass p-6">
              {!onlineData?.users.length ? (
                <div className="py-8 text-center text-slate-500 text-sm">Waiting for players to join...</div>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {onlineData.users.map((u: any) => (
                    <Link key={u.username} href={`/u/${u.username}`} className="group flex flex-col items-center gap-2">
                      <div className="relative">
                        <Avatar username={u.username} src={u.image} size={52} className="group-hover:ring-2 ring-arena-blue ring-offset-2 ring-offset-arena-900 transition-all" />
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-arena-900" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-white uppercase truncate w-16 text-center">{u.username}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Chat & Leaderboard */}
        <div className="lg:col-span-4 space-y-10">
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold uppercase italic tracking-widest text-white flex items-center gap-3">
                <Star size={20} className="text-amber-400" />
                Top Players
              </h2>
              <Link href="/leaderboard" className="text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest">
                Full Rank
              </Link>
            </div>
            <div className="glass overflow-hidden">
              {leaderboardData?.rows?.map((row: any, i: number) => (
                <Link 
                  key={row.userId} 
                  href={`/u/${row.username}`}
                  className={cn(
                    "flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors",
                    i === 4 && "border-b-0"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-6 text-center font-black italic",
                      i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-500" : "text-slate-600"
                    )}>
                      #{i + 1}
                    </span>
                    <Avatar username={row.username} src={row.image} size={32} />
                    <span className="font-bold text-sm text-slate-200">{row.username}</span>
                  </div>
                  <span className="text-xs font-black text-cyan-400 italic">{row.rating} ELO</span>
                </Link>
              ))}
              {!leaderboardData?.rows?.length && (
                <div className="p-8 text-center text-slate-500 text-sm italic">Rankings loading...</div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold uppercase italic tracking-widest text-white flex items-center gap-3">
                Global Chat
              </h2>
            </div>
            <ChatWidget maxHeight="420px" compact />
          </section>
        </div>
      </div>
    </div>
  );
}
