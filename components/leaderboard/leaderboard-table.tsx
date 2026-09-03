"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty";
import { Trophy, Medal } from "lucide-react";
import { cn, winRatePercent } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface LeaderRow {
  userId: string;
  username: string;
  image: string | null;
  rating: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  draws: number;
  ludoWins: number;
  chessWins: number;
  checkersWins: number;
}

export function LeaderboardTable({ rows, loading, gameType }: { rows: LeaderRow[]; loading: boolean; gameType: string }) {
  const { user: currentUser } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Spinner size={32} />
        <p className="mt-4 text-slate-500 font-bold uppercase tracking-widest text-xs">Fetching Ranks...</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState 
        icon={Trophy}
        title="No Rankings Yet"
        message="The arena is fresh. Play some games to appear on the leaderboard!"
      />
    );
  }

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02]">
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">Rank</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">Player</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic text-center">Rating</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic text-center">GP</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic text-center">W / L / D</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic text-center">Win Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row, i) => {
            const isMe = row.userId === currentUser?.id;
            const rank = i + 1;
            const winRate = winRatePercent(row.gamesWon, row.gamesPlayed);
            
            return (
              <tr 
                key={row.userId} 
                className={cn(
                  "hover:bg-white/[0.04] transition-colors group",
                  isMe && "bg-arena-purple/10"
                )}
              >
                <td className="px-6 py-5">
                  <div className="flex items-center justify-center w-8">
                    {rank === 1 ? (
                      <Medal className="text-amber-400 drop-shadow-glow" size={24} />
                    ) : rank === 2 ? (
                      <Medal className="text-slate-300 drop-shadow-glow-blue" size={22} />
                    ) : rank === 3 ? (
                      <Medal className="text-orange-500" size={20} />
                    ) : (
                      <span className="text-sm font-black italic text-slate-500">#{rank}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <Link href={`/u/${row.username}`} className="flex items-center gap-3">
                    <Avatar username={row.username} src={row.image} size={36} className="group-hover:scale-110 transition-transform" />
                    <div>
                      <p className={cn("text-sm font-bold uppercase italic tracking-wider", isMe ? "text-arena-blue" : "text-white")}>
                        {row.username}
                      </p>
                      {isMe && <p className="text-[10px] font-black text-arena-blue uppercase italic">You</p>}
                    </div>
                  </Link>
                </td>
                <td className="px-6 py-5 text-center">
                  <span className="text-lg font-black italic text-white tracking-tighter drop-shadow-glow-blue">{row.rating}</span>
                </td>
                <td className="px-6 py-5 text-center text-sm font-bold text-slate-400">{row.gamesPlayed}</td>
                <td className="px-6 py-5 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs font-black italic">
                    <span className="text-emerald-400">{row.gamesWon}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-rose-400">{row.gamesLost}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-amber-400">{row.draws}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-black text-white italic">
                    {winRate}%
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
