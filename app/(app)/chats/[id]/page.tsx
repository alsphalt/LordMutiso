"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, Trash2, ImagePlus, MoreVertical, Archive, Flag, Ban } from "lucide-react";
import { api } from "@/hooks/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { fileToImageDataUrl } from "@/components/social/media";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  kind: "TEXT" | "IMAGE";
  content: string;
  mediaUrl: string | null;
  fromMe: boolean;
  delivered: boolean;
  read: boolean;
  createdAt: string;
}

export default function ChatRoom() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user } = useAuth();
  const { push } = useToast();
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [peer, setPeer] = React.useState<{ username: string; displayName: string | null; image: string | null; online: boolean } | null>(null);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const endRef = React.useRef<HTMLDivElement>(null);
  const idsRef = React.useRef(new Set<string>());

  const markRead = React.useCallback(() => {
    api(`/api/conversations/${id}`, { method: "POST", body: JSON.stringify({ action: "read" }) }).catch(() => {});
  }, [id]);

  const load = React.useCallback(async () => {
    try {
      const d = await api<{ messages: Msg[]; peerReadAt?: string | null }>(`/api/conversations/${id}`);
      setMessages((prev) => {
        const fresh = d.messages.filter((m) => !idsRef.current.has(m.id));
        fresh.forEach((m) => idsRef.current.add(m.id));
        const merged = [...prev, ...fresh].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
        return merged;
      });
      if (d.messages.some((m) => !m.fromMe)) markRead();
      setLoading(false);
    } catch (e) {
      setLoading(false);
      push({ message: (e as Error).message ?? "Failed to load chat", tone: "error" });
    }
  }, [id, markRead, push]);

  const loadPeer = React.useCallback(() => {
    api<{ conversations: Array<{ id: string; peer: { username: string; displayName: string | null; image: string | null; online: boolean } | null }> }>("/api/conversations")
      .then((d) => {
        const c = d.conversations.find((x) => x.id === id);
        if (c?.peer) setPeer(c.peer);
      })
      .catch(() => {});
  }, [id]);

  React.useEffect(() => {
    idsRef.current = new Set();
    setMessages([]);
    setLoading(true);
    void load();
    void loadPeer();
    const iv = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(iv);
  }, [id, load, loadPeer]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (body.length === 0 || sending) return;
    setSending(true);
    try {
      const d = await api<{ message: Msg }>(`/api/conversations/${id}`, {
        method: "POST",
        body: JSON.stringify({ action: "send", kind: "TEXT", content: body }),
      });
      const m = d.message;
      if (!idsRef.current.has(m.id)) {
        idsRef.current.add(m.id);
        setMessages((prev) => [...prev, m]);
      }
      setText("");
      markRead();
    } catch (e) {
      push({ message: (e as Error).message ?? "Message failed to send", tone: "error" });
    } finally {
      setSending(false);
    }
  };

  const sendImage = async (file: File) => {
    setSending(true);
    try {
      const dataUrl = await fileToImageDataUrl(file, 1024, 0.8);
      const d = await api<{ message: Msg }>(`/api/conversations/${id}`, {
        method: "POST",
        body: JSON.stringify({ action: "send", kind: "IMAGE", content: "[image]", mediaUrl: dataUrl }),
      });
      const m = d.message;
      if (!idsRef.current.has(m.id)) {
        idsRef.current.add(m.id);
        setMessages((prev) => [...prev, m]);
      }
    } catch (e) {
      push({ message: (e as Error).message ?? "Image failed to send", tone: "error" });
    } finally {
      setSending(false);
    }
  };

  const removeMessage = async (msgId: string) => {
    try {
      await api(`/api/conversations/${id}`, { method: "POST", body: JSON.stringify({ action: "deleteMessage", messageId: msgId }) });
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch {
      push({ message: "Could not delete message", tone: "error" });
    }
  };

  const archive = async () => {
    await api(`/api/conversations/${id}`, { method: "POST", body: JSON.stringify({ action: "archive" }) }).catch(() => {});
    router.push("/chats");
  };

  const otherId = user && peer ? null : null; // block/report target needs id — resolved via search page/contacts
  const reportOrBlock = async (action: string) => {
    // target id fetched lazily
    const list = await api<{ conversations: Array<{ id: string; peer: { id: string } | null }> }>("/api/conversations");
    const targetId = list.conversations.find((c) => c.id === id)?.peer?.id;
    if (!targetId) return;
    try {
      await api("/api/social/moderation", { method: "POST", body: JSON.stringify({ action, userId: targetId }) });
      push({ message: action === "block" ? "User blocked" : "User reported", tone: "success" });
      if (action === "block") router.push("/chats");
    } catch (e) {
      push({ message: (e as Error).message ?? "Action failed", tone: "error" });
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] w-full max-w-2xl flex-col px-2 pt-3 pb-2 sm:px-4">
      {/* header */}
      <div className="flex items-center gap-3 rounded-t-2xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur">
        <Link href="/chats" aria-label="Back to chats" className="text-slate-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div className="relative">
          <Avatar username={peer?.displayName ?? peer?.username ?? "?"} src={peer?.image} size={38} />
          {peer?.online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-arena-900 bg-emerald-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{peer?.displayName ?? peer?.username ?? "…"}</p>
          <p className="text-[11px] text-slate-500">@{peer?.username}</p>
        </div>
        <div className="flex items-center gap-1">
          <button aria-label="Archive conversation" title="Archive" onClick={archive} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <Archive size={17} />
          </button>
          <button aria-label="Block user" title="Block" onClick={() => void reportOrBlock("block")} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-rose-400">
            <Ban size={17} />
          </button>
          <button aria-label="Report user" title="Report" onClick={() => void reportOrBlock("report")} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-amber-400">
            <Flag size={17} />
          </button>
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-2 overflow-y-auto rounded-b-none border border-t-0 border-white/10 bg-black/20 px-3 py-3">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Say hi 👋 — messages appear here instantly.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
              <div className={cn("group relative max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow", m.fromMe ? "rounded-br-md bg-violet-600/90 text-white" : "rounded-bl-md bg-white/10 text-slate-100")}>
                {m.kind === "IMAGE" && m.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.mediaUrl} alt="attachment" className="max-h-56 w-full rounded-lg object-cover" />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                )}
                <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] text-white/60">
                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {m.fromMe && <span aria-label={m.read ? "Read" : m.delivered ? "Delivered" : "Sent"}>{m.read ? "✓✓" : m.delivered ? "✓✓" : "✓"}</span>}
                </div>
                {m.fromMe && (
                  <button
                    aria-label="Delete message"
                    onClick={() => void removeMessage(m.id)}
                    className="absolute -bottom-6 right-0 hidden rounded-full p-1 text-slate-400 hover:text-rose-400 group-hover:flex"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="flex items-center gap-2 rounded-b-2xl border border-white/10 bg-white/5 px-2 py-2 backdrop-blur">
        <label className="cursor-pointer rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Attach image">
          <ImagePlus size={20} />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={sending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void sendImage(f);
            }}
          />
        </label>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Message…"
          className="flex-1 border-0 bg-transparent focus:ring-0"
        />
        <Button size="sm" onClick={() => void send()} disabled={sending || text.trim().length === 0} aria-label="Send message">
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
