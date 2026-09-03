"use client";

import * as React from "react";
import { Send, Smile, Trash2, ChevronUp } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { api, useApiPoll } from "@/hooks/api";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { CHAT_MAX_LENGTH } from "@/lib/constants";

interface ChatMsg {
  id: string;
  senderId: string;
  username: string;
  image: string | null;
  message: string;
  createdAt: string;
}

export function ChatWidget({ gameId = null, compact, className, maxHeight = "500px" }: { gameId?: string | null; compact?: boolean; className?: string; maxHeight?: string }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [msg, setMsg] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [before, setBefore] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = React.useState(true);

  const path = gameId ? `/api/games/${gameId}/chat` : "/api/chat";
  const { data, refresh, loading } = useApiPoll<{ messages: ChatMsg[]; nextCursor: string | null }>(
    `${path}?limit=30${before ? `&before=${before}` : ""}`,
    3000
  );

  const messages = React.useMemo(() => {
    if (!data) return [];
    return [...data.messages].reverse();
  }, [data]);

  const scrollToBottom = React.useCallback(() => {
    if (scrollRef.current && isAutoScroll) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isAutoScroll]);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAutoScroll(atBottom);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = msg.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      await api(path, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setMsg("");
      refresh();
      setIsAutoScroll(true);
    } catch (err: any) {
      if (err.status === 429) {
        push({ title: "Slow down!", message: "You are sending messages too fast", tone: "error" });
      } else {
        push({ title: "Error", message: err.message, tone: "error" });
      }
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`${path}/${id}`, { method: "DELETE" });
      refresh();
    } catch (err: any) {
      push({ title: "Error", message: err.message, tone: "error" });
    }
  };

  const emojis = ["😀", "😂", "🔥", "🎉", "👍", "🎲", "♟️", "🎯"];

  return (
    <div className={cn("flex flex-col glass overflow-hidden", className)} style={{ maxHeight }}>
      {!compact && (
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
          <h3 className="font-bold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {gameId ? "Game Chat" : "Global Chat"}
          </h3>
          {data?.nextCursor && (
            <Button variant="ghost" size="xs" onClick={() => setBefore(data.nextCursor)} className="text-[10px] uppercase font-bold text-slate-500">
              Load Older
            </Button>
          )}
        </div>
      )}

      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {loading && !data && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm italic">
            No messages yet. Say hi!
          </div>
        )}
        {messages.map((m) => {
          const isOwn = m.senderId === user?.id;
          return (
            <div key={m.id} className={cn("flex gap-3 group", isOwn && "flex-row-reverse")}>
              <Avatar username={m.username} src={m.image} size={32} className="shrink-0" />
              <div className={cn("flex flex-col gap-1 min-w-0 max-w-[80%]", isOwn && "items-end")}>
                <div className="flex items-center gap-2">
                  {!isOwn && <span className="text-xs font-bold text-slate-300">{m.username}</span>}
                  <span className="text-[10px] text-slate-500 uppercase">{timeAgo(m.createdAt)}</span>
                  {isOwn && (
                    <button 
                      onClick={() => handleDelete(m.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className={cn(
                  "px-3 py-2 rounded-2xl text-sm break-words",
                  isOwn ? "bg-arena-purple text-white rounded-tr-none" : "bg-white/5 text-slate-200 rounded-tl-none"
                )}>
                  {m.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 pt-2 shrink-0 border-t border-white/10 bg-black/20">
        <div className="flex gap-1 mb-2">
          {emojis.map((e) => (
            <button 
              key={e} 
              onClick={() => setMsg(prev => (prev + e).slice(0, CHAT_MAX_LENGTH))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-lg"
            >
              {e}
            </button>
          ))}
        </div>
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value.slice(0, CHAT_MAX_LENGTH))}
            placeholder="Type a message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus-ring outline-none"
            disabled={sending}
          />
          <Button type="submit" size="sm" loading={sending} disabled={!msg.trim()}>
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}
