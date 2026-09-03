"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input, Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/hooks/api";
import { useToast } from "@/components/ui/toast";

export function JoinDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { push } = useToast();
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;

    setLoading(true);
    try {
      const data = await api<{ room: { gameId: string } }>("/api/rooms/join", {
        method: "POST",
        body: JSON.stringify({ roomCode: code.toUpperCase() }),
      });
      push({ title: "Joined!", message: "Entering the arena...", tone: "success" });
      router.push(`/play/${data.room.gameId}`);
      onClose();
    } catch (err: any) {
      push({ title: "Failed to join", message: err.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Join Room">
      <form onSubmit={handleJoin} className="space-y-6">
        <Field label="Room Code" hint="Enter the 6-character room code">
          <Input 
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCDEF"
            className="text-center text-2xl font-black italic tracking-[0.5em] uppercase h-16"
            maxLength={6}
            disabled={loading}
            required
            autoFocus
          />
        </Field>
        
        <Button type="submit" full loading={loading} className="h-12 italic font-black tracking-widest uppercase gap-2">
          ENTER ARENA <LogIn size={18} />
        </Button>
      </form>
    </Modal>
  );
}
