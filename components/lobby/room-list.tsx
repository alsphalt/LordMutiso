"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty";
import { Gamepad2, Users, ArrowRight } from "lucide-react";
import { STATUS_LABEL, GAME_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  gameId: string;
  roomCode: string;
  type: string;
  status: string;
  maxPlayers: number;
  players: { userId: string; username: string; image: string | null; color: string }[];
  createdAt: string;
}

export function RoomList({ rooms, loading, onJoin }: { rooms: Room[]; loading: boolean; onJoin: (room: Room) => void }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 glass">
        <Spinner size={32} className="text-arena-purple" />
        <p className="mt-4 text-slate-500 font-bold uppercase tracking-widest text-xs">Scanning Arena...</p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <EmptyState 
        icon={Gamepad2}
        title="No Rooms Found"
        message="There are no waiting rooms for this game type right now. Why not create one?"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {rooms.map((room) => {
        const meta = GAME_TYPES[room.type as any];
        const isFull = room.players.length >= room.maxPlayers;
        
        return (
          <Card key={room.id} className="group p-6 flex flex-col hover:bg-white/[0.08] transition-all border-white/5 hover:border-white/20">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="text-4xl drop-shadow-lg group-hover:scale-110 transition-transform">
                  {meta?.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black italic uppercase tracking-tight text-white">
                      {room.type}
                    </h3>
                    <Badge tone="cyan">#{room.roomCode}</Badge>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                    {STATUS_LABEL[room.status as any]}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end mb-1">
                  <Users size={14} className="text-slate-500" />
                  <span className="text-sm font-black text-white italic">
                    {room.players.length} / {room.maxPlayers}
                  </span>
                </div>
                <div className="flex gap-1 justify-end">
                  {Array.from({ length: room.maxPlayers }).map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "w-2 h-2 rounded-full",
                        i < room.players.length ? "bg-arena-purple" : "bg-white/10"
                      )} 
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3 mb-6">
              <div className="flex flex-wrap gap-2">
                {room.players.map((p) => (
                  <div key={p.userId} className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                    <Avatar username={p.username} src={p.image} size={20} />
                    <span className="text-[10px] font-bold text-slate-300 uppercase truncate max-w-[80px]">
                      {p.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              full 
              variant={isFull ? "secondary" : "primary"} 
              disabled={isFull}
              onClick={() => onJoin(room)}
              className="h-12 italic font-black tracking-widest uppercase gap-2"
            >
              {isFull ? "ROOM FULL" : "JOIN ARENA"} <ArrowRight size={18} />
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
