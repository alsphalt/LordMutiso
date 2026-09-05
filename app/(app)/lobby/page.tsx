"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, LogIn, Search, RefreshCw, Gamepad2 } from "lucide-react";
import { api, useApiPoll } from "@/hooks/api";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import { RoomList } from "@/components/lobby/room-list";
import { JoinDialog } from "@/components/lobby/join-dialog";
import { CreateDialog } from "@/components/lobby/create-dialog";
import { GameModeDialog } from "@/components/games/game-mode-dialog";
import { GameTypeName, GAME_TYPE_LIST, GAME_TYPES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Bot } from "lucide-react";

export default function LobbyPage() {
  const router = useRouter();
  const { push } = useToast();
  const [activeTab, setActiveTab] = React.useState<GameTypeName>("LUDO");
  const [showJoin, setShowJoin] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [showAiDialog, setShowAiDialog] = React.useState(false);

  const { data: roomsData, loading: roomsLoading, refresh: refreshRooms } = useApiPoll<{ rooms: any[] }>(
    `/api/rooms?type=${activeTab}`,
    4000
  );

  const { data: myGamesData } = useApiPoll<{ games: any[] }>("/api/games/mine", 5000);

  const tabs = GAME_TYPE_LIST.map(type => ({ id: type, label: type }));

  const meta = GAME_TYPES[activeTab];

  return (
    <div className="animate-fade-in space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-3xl shadow-inner">
            {meta.emoji}
          </div>
          <div>
            <h1 className="text-3xl font-black italic tracking-tight text-white uppercase">{meta.label}</h1>
            <p className="text-slate-500 font-medium">Choose how you want to play.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setShowAiDialog(true)} className="gap-2 italic font-black uppercase tracking-widest text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
            <Bot size={16} /> Play Vs AI
          </Button>
          <Button variant="secondary" onClick={() => setShowJoin(true)} className="gap-2 italic font-black uppercase tracking-widest text-xs">
            <LogIn size={16} /> Join By Code
          </Button>
          <Button variant="primary" onClick={() => setShowCreate(true)} className="gap-2 italic font-black uppercase tracking-widest text-xs shadow-glow">
            <Plus size={18} /> Create Match
          </Button>
        </div>
      </header>

      {/* Your Active Matches (filtered to the chosen game) */}
      {(() => {
        const mine = (myGamesData?.games || []).filter((g: any) => g.type === activeTab);
        if (mine.length === 0) return null;
        return (
          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-white/10" /> Your Active {meta.label} Matches
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mine.map((game: any) => (
                <Card key={game.id} className="p-4 flex items-center justify-between group hover:bg-white/[0.08] transition-colors border-arena-purple/30">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white text-xs italic uppercase tracking-wider">{meta.label}</p>
                        {game.gameMode === "AI" && <span className="text-[9px]">🤖</span>}
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">
                        Room: #{game.roomCode || "—"} · Players: {game.playersCount}/{game.maxPlayers}
                      </p>
                      <div className="mt-1">
                        <Badge tone={game.status === "PLAYING" ? "green" : "amber"} className="text-[9px] px-1.5 h-4">
                          {game.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button size="xs" variant="primary" onClick={() => router.push(`/play/${game.id}`)} className="italic font-black px-4">
                    RESUME
                  </Button>
                </Card>
              ))}
            </div>
          </section>
        );
      })()}

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} className="w-full sm:w-auto" />
          <Button variant="ghost" size="sm" onClick={() => refreshRooms()} className="text-slate-500 gap-2">
            <RefreshCw size={14} className={roomsLoading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>

        <RoomList 
          rooms={roomsData?.rooms || []} 
          loading={roomsLoading && !roomsData} 
          onJoin={(room) => router.push(`/play/${room.gameId}`)}
        />
      </div>

      <JoinDialog open={showJoin} onClose={() => setShowJoin(false)} />
      <CreateDialog open={showCreate} onClose={() => setShowCreate(false)} activeType={activeTab} />
      <GameModeDialog open={showAiDialog} onClose={() => setShowAiDialog(false)} type={activeTab} />
    </div>
  );
}
