"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Trophy, Calendar, Gamepad2, Star, TrendingUp, History } from "lucide-react";
import { api, useApiPoll } from "@/hooks/api";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { cn, fmtDate, winRatePercent, timeAgo, fmtDurationMs } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/constants";
import Link from "next/link";

interface ProfileData {
  user: {
    id: string;
    username: string;
    image: string | null;
    createdAt: string;
  };
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    draws: number;
    rating: number;
    ludoWins: number;
    chessWins: number;
    checkersWins: number;
    aiGames: number;
    aiWins: number;
    aiDraws: number;
  } | null;
  recent: any[];
  isSelf: boolean;
}

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const { data, loading, error } = useApiPoll<ProfileData>(
    `/api/users/${username}`,
    60000
  );

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-40">
        <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">Combatant Not Found</h2>
        <p className="text-slate-500 mt-2">The user you are looking for has not entered the arena yet.</p>
        <Link href="/">
          <Button className="mt-8 italic font-black uppercase tracking-widest">Back to Base</Button>
        </Link>
      </div>
    );
  }

  const { user, stats, recent, isSelf } = data;
  const winRate = stats ? winRatePercent(stats.gamesWon, stats.gamesPlayed) : 0;
  const aiWinRate = stats ? winRatePercent(stats.aiWins, stats.aiGames) : 0;

  return (
    <div className="animate-fade-in space-y-10">
      {/* Profile Header */}
      <Card className="p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-arena-purple/10 blur-[100px] -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-arena-blue/5 blur-[100px] -ml-32 -mb-32" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-8">
          <div className="relative">
            <Avatar username={user.username} src={user.image} size={160} className="ring-4 ring-white/10 ring-offset-4 ring-offset-arena-950 shadow-2xl" />
            {isSelf && (
              <Link href="/settings">
                <Button size="xs" variant="secondary" className="absolute bottom-2 right-2 rounded-full h-8 w-8 p-0 border-2 border-arena-950">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                </Button>
              </Link>
            )}
          </div>
          
          <div className="text-center md:text-left space-y-4 flex-1">
            <div>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase leading-none">
                  {user.username}
                </h1>
                {isSelf && <Badge tone="cyan" className="self-center">YOU</Badge>}
              </div>
              <div className="flex items-center justify-center md:justify-start gap-4 mt-3 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                <span className="flex items-center gap-1.5"><Calendar size={12} /> Joined {fmtDate(user.createdAt)}</span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="flex items-center gap-1.5 text-arena-blue"><Gamepad2 size={12} /> Arena Combatant</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <Badge tone="purple" className="italic font-black text-[10px] tracking-[0.2em] px-3 py-1 uppercase">{stats?.ludoWins || 0} LUDO WINS</Badge>
              <Badge tone="cyan" className="italic font-black text-[10px] tracking-[0.2em] px-3 py-1 uppercase">{stats?.chessWins || 0} CHESS WINS</Badge>
              <Badge tone="green" className="italic font-black text-[10px] tracking-[0.2em] px-3 py-1 uppercase">{stats?.checkersWins || 0} CHECKERS WINS</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
            <Stat label="Arena Rating" value={stats?.rating || 1000} accent />
            <Stat label="Win Rate" value={`${winRate}%`} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Statistics Grid */}
        <div className="lg:col-span-4 space-y-8">
          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
              <span className="w-8 h-px bg-white/10" /> Online Combat
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="glass p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Played</p>
                <p className="mt-1 text-2xl font-black italic text-white">{stats?.gamesPlayed || 0}</p>
              </div>
              <div className="glass p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Win Rate</p>
                <p className="mt-1 text-2xl font-black italic text-indigo-400">{winRate}%</p>
              </div>
              <div className="glass p-5 border-emerald-500/20">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">Won</p>
                <p className="mt-1 text-2xl font-black italic text-emerald-400">{stats?.gamesWon || 0}</p>
              </div>
              <div className="glass p-5 border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rating</p>
                <p className="mt-1 text-2xl font-black italic text-cyan-400">{stats?.rating || 1000}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
              <span className="w-8 h-px bg-white/10" /> AI Practice
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="glass p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Games</p>
                <p className="mt-1 text-2xl font-black italic text-white">{stats?.aiGames || 0}</p>
              </div>
              <div className="glass p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Win Rate</p>
                <p className="mt-1 text-2xl font-black italic text-cyan-400">{aiWinRate}%</p>
              </div>
              <div className="glass p-5 border-emerald-500/20">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">Wins</p>
                <p className="mt-1 text-2xl font-black italic text-emerald-400">{stats?.aiWins || 0}</p>
              </div>
              <div className="glass p-5 border-amber-500/20">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/60">Draws</p>
                <p className="mt-1 text-2xl font-black italic text-amber-400">{stats?.aiDraws || 0}</p>
              </div>
            </div>
          </section>

          <section>
            <div className="glass p-6 space-y-6">
              <h3 className="font-black italic uppercase tracking-widest text-sm text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-arena-blue" />
                Performance Rank
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">GLOBAL STANDING</span>
                  <span className="text-sm font-black italic text-white">#42</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div className="bg-arena-blue h-full w-[85%] shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Top 15% of all arena combatants</p>
              </div>
            </div>
          </section>
        </div>

        {/* Recent Matches */}
        <div className="lg:col-span-8 space-y-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <span className="w-8 h-px bg-white/10" /> Recent Battles
          </h2>
          
          <div className="glass overflow-hidden border-white/5">
            {!recent.length ? (
              <div className="py-20 text-center text-slate-500 text-sm italic">No recent battles recorded</div>
            ) : (
              <div className="divide-y divide-white/5">
                {recent.map((game) => (
                  <div key={game.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-5">
                      <div className="text-4xl">{game.type === 'LUDO' ? '🎲' : game.type === 'CHESS' ? '♟️' : '🔴'}</div>
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="font-black italic uppercase tracking-tight text-white">{game.type}</p>
                          {game.result === 'win' ? (
                            <Badge tone="green" className="text-[10px] italic font-black uppercase tracking-widest">VICTORY</Badge>
                          ) : game.result === 'loss' ? (
                            <Badge tone="rose" className="text-[10px] italic font-black uppercase tracking-widest">DEFEAT</Badge>
                          ) : (
                            <Badge tone="amber" className="text-[10px] italic font-black uppercase tracking-widest">DRAW</Badge>
                          )}
                         {game.gameMode === 'AI' && <Badge tone="cyan" className="text-[8px] px-1 h-3.5">🤖 AI</Badge>}
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-1">
                          vs {game.gameMode === 'AI' && "🤖 "}{game.opponentNames.join(', ')} • {timeAgo(game.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-10">
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Duration</p>
                        <p className="text-xs font-bold text-white mt-0.5 italic">{game.durationMs ? fmtDurationMs(game.durationMs) : '—'}</p>
                      </div>
                      <Link href={`/play/${game.id}`}>
                        <Button size="sm" variant="secondary" className="italic font-black text-xs px-6 border-white/10">
                          VIEW
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
