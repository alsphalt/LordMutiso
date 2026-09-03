"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/hooks/api";
import { useToast } from "@/components/ui/toast";
import { GameTypeName, GAME_TYPES, GAME_TYPE_LIST } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function CreateDialog({ open, onClose, activeType }: { open: boolean; onClose: () => void; activeType: GameTypeName }) {
  const router = useRouter();
  const { push } = useToast();
  const [type, setType] = React.useState<GameTypeName>(activeType);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) setType(activeType);
  }, [open, activeType]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const data = await api<{ room: { gameId: string } }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ type }),
      });
      push({ title: "Room Created!", message: "Your arena is ready", tone: "success" });
      router.push(`/play/${data.room.gameId}`);
      onClose();
    } catch (err: any) {
      push({ title: "Creation failed", message: err.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create New Arena">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          {GAME_TYPE_LIST.map((t) => {
            const meta = GAME_TYPES[t];
            const active = type === t;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                  active 
                    ? "bg-arena-purple/10 border-arena-purple ring-2 ring-arena-purple/20" 
                    : "bg-white/5 border-white/10 hover:border-white/20"
                )}
              >
                <span className="text-4xl">{meta.emoji}</span>
                <div>
                  <h4 className="font-black italic uppercase text-white">{meta.label}</h4>
                  <p className="text-xs text-slate-500 font-medium">{meta.tagline}</p>
                </div>
              </button>
            );
          })}
        </div>

        <Button full variant="primary" loading={loading} onClick={handleCreate} className="h-14 italic font-black tracking-widest uppercase gap-2">
          CREATE ROOM <Plus size={20} />
        </Button>
      </div>
    </Modal>
  );
}
