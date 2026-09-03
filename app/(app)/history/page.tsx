"use client";

import * as React from "react";
import Link from "next/link";
import { History as HistoryIcon, Search, RefreshCw, ChevronRight } from "lucide-react";
import { useApiPoll } from "@/hooks/api";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty";
import { GAME_TYPE_LIST, STATUS_LABEL } from "@/lib/constants";
import { cn, fmtDate, timeAgo, fmtDurationMs } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface HistoryRow {
  id: string;
  type: string;
  status: string;
  roomCode: string;
  result: 'win' | 'loss' | 'draw' | null;
  winnerId: string;
  winnerUsername: string | null;
  opponentNames: string[];
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<string>("ALL");
  const { data, loading, refresh } = useApiPoll<{ games: HistoryRow[] }>(
    `/api/history?game=${activeTab === 'ALL' ? '' : activeTab}`,
    15000
  );

  const tabs = [
    { id: "ALL", label: "All Games" },
    ...GAME_TYPE_LIST.map(type => ({ id: type, label: type }))
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tight text-white uppercase">Match History</h1>
          <p className="text-slate-500 font-medium">Review your past battles and performance</p>
        </div>
        <div className="flex gap-4">
          <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
          <Button variant="ghost" size="sm" onClick={() => refresh()} className="text-slate-500">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </header>

      <div className="glass overflow-hidden border-white/5">
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Spinner size={32} />
            <p className="mt-4 text-slate-500 font-bold uppercase tracking-widest text-xs">Replaying History...</p>
          </div>
        ) : !data?.games.length ? (
          <EmptyState 
            icon={HistoryIcon}
            title="No History Found"
            message="You haven't completed any games yet. Go play some matches!"
          />
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">Match</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">Result</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">Opponents</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">Duration</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.games.map((game) => (
                  <tr key={game.id} className="hover:bg-white/[0.04] transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{game.type === 'LUDO' ? '🎲' : game.type === 'CHESS' ? '♟️' : '🔴'}</span>
                        <div>
                          <p className="text-sm font-bold text-white uppercase italic tracking-wider">{game.type}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">#{game.roomCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {game.result === 'win' ? (
                        <Badge tone="green" className="italic font-black uppercase tracking-widest">VICTORY</Badge>
                      ) : game.result === 'loss' ? (
                        <Badge tone="rose" className="italic font-black uppercase tracking-widest">DEFEAT</Badge>
                      ) : game.result === 'draw' ? (
                        <Badge tone="amber" className="italic font-black uppercase tracking-widest">DRAW</Badge>
                      ) : (
                        <Badge tone="slate" className="italic font-black uppercase tracking-widest">{STATUS_LABEL[game.status as any]}</Badge>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs font-bold text-slate-300 uppercase tracking-tighter truncate max-w-[200px]">
                        {game.opponentNames.join(', ') || '—'}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-medium text-slate-400">{timeAgo(game.createdAt)}</p>
                      <p className="text-[10px] text-slate-600 uppercase font-bold">{fmtDate(game.createdAt)}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">
                        {game.durationMs ? fmtDurationMs(game.durationMs) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link href={`/play/${game.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 group-hover:bg-arena-purple group-hover:text-white rounded-full transition-all">
                          <ChevronRight size={18} />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
