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
import { GameTypeName, GAME_TYPE_LIST, STATUS_LABEL } from "@/lib/constants";
import { Card } from "@/components/ui/card";

export default function LobbyPage() {
  const router = useRouter();
  const { push } = useToast();
  const [activeTab, setActiveTab] = React.useState<GameTypeName>("LUDO");
  const [showJoin, setShowJoin] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);

  const { data: roomsData, loading: roomsLoading, refresh: refreshRooms } = useApiPoll<{ rooms: any[] }>(
    `/api/rooms?type=${activeTab}`,
    4000
  );

  const { data: myGamesData } = useApiPoll<{ games: any[] }>("/api/games/mine", 5000);

  const tabs = GAME_TYPE_LIST.map(type => ({ id: type, label: type }));

  return (
    <div className="animate-fade-in space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tight text-white uppercase">Game Lobby</h1>
          <p className="text-slate-500 font-medium">Join a room or create your own</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowJoin(true)} className="gap-2 italic font-black uppercase tracking-widest text-xs">
            <LogIn size={16} /> Join By Code
          </Button>
          <Button variant="primary" onClick={() => setShowCreate(true)} className="gap-2 italic font-black uppercase tracking-widest text-xs shadow-glow">
            <Plus size={18} /> Create Room
          </Button>
        </div>
      </header>

      {/* Your Active Matches */}
      {myGamesData?.games && myGamesData.games.length > 0 && (
        <section>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
            <span className="w-8 h-px bg-white/10" /> Your Active Matches
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myGamesData.games.map((game: any) => (
              <Card key={game.id} className="p-4 flex items-center justify-between group hover:bg-white/[0.08] transition-colors border-arena-purple/30">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{game.type === 'LUDO' ? '🎲' : game.type === 'CHESS' ? '♟️' : '🔴'}</span>
                  <div>
                    <p className="font-bold text-white text-xs italic uppercase tracking-wider">{game.type}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">#{game.roomCode}</p>
                  </div>
                </div>
                <Button size="xs" variant="primary" onClick={() => router.push(`/play/${game.id}`)} className="italic font-black px-4">
                  RESUME
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

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
    </div>
  );
}
