"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessagesSquare, Plus, Search, Send } from "lucide-react";
import { api } from "@/hooks/api";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Peer {
  id: string;
  username: string;
  displayName: string | null;
  image: string | null;
  online: boolean;
}

interface Conv {
  id: string;
  peer: Peer | null;
  lastMessage: { content: string; createdAt: string; fromMe: boolean } | null;
  unread: number;
}

export default function ChatsPage() {
  const router = useRouter();
  const [convs, setConvs] = React.useState<Conv[] | null>(null);
  const [showSearch, setShowSearch] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Array<Peer & { bio: string | null }>>([]);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api<{ conversations: Conv[] }>("/api/conversations")
      .then((d) => setConvs(d.conversations))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    load();
    const iv = window.setInterval(load, 5000);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const search = React.useCallback(() => {
    if (q.trim().length < 3) return;
    setBusy(true);
    api<{ users: Array<Peer & { bio: string | null }> }>(`/api/social/people?q=${encodeURIComponent(q.trim())}`)
      .then((d) => setResults(d.users))
      .catch(() => setResults([]))
      .finally(() => setBusy(false));
  }, [q]);

  const start = async (targetId: string) => {
    const d = await api<{ conversation: Conv }>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ targetId }),
    });
    router.push(`/chats/${d.conversation.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-24">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">Chats</h1>
          <p className="text-xs text-slate-500">Private 1-to-1 messages</p>
        </div>
        <Button size="sm" onClick={() => setShowSearch((v) => !v)}>
          <Plus size={16} className="mr-1" /> New
        </Button>
      </div>

      {showSearch && (
        <div className="glass mb-4 space-y-2 rounded-2xl border p-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search by username or display name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <Button size="sm" onClick={search} disabled={busy || q.trim().length < 3}>
              <Search size={15} />
            </Button>
          </div>
          {busy && <p className="px-1 text-xs text-slate-500">Searching…</p>}
          <div className="space-y-1">
            {results.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl px-2 py-2 hover:bg-white/5">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar username={u.displayName ?? u.username} src={u.image} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{u.displayName ?? u.username}</p>
                    <p className="truncate text-xs text-slate-500">@{u.username}</p>
                  </div>
                </div>
                <Button size="xs" onClick={() => start(u.id)}>
                  <Send size={12} className="mr-1" /> Message
                </Button>
              </div>
            ))}
            {!busy && q.trim().length >= 3 && results.length === 0 && (
              <p className="px-1 py-1 text-xs text-slate-500">No one found (privacy settings apply).</p>
            )}
          </div>
        </div>
      )}

      {convs === null ? (
        <p className="py-16 text-center text-sm text-slate-500">Loading conversations…</p>
      ) : convs.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No conversations yet"
          message="Start a private conversation with someone you know."
          action={
            <Button onClick={() => setShowSearch(true)}>
              <Search size={15} className="mr-1" /> Find Contacts
            </Button>
          }
        />
      ) : (
        <div className="space-y-1.5">
          {convs.map((c) => (
            <Link
              key={c.id}
              href={`/chats/${c.id}`}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-3 py-3 transition-colors hover:bg-white/10"
            >
              <div className="relative">
                <Avatar username={c.peer?.displayName ?? c.peer?.username ?? "?"} src={c.peer?.image} size={46} />
                {c.peer?.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-arena-900 bg-emerald-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-bold text-white">{c.peer?.displayName ?? c.peer?.username}</p>
                  {c.lastMessage && <span className="shrink-0 text-[10px] text-slate-500">{fmtTime(c.lastMessage.createdAt)}</span>}
                </div>
                <p className="truncate text-xs text-slate-400">
                  {c.lastMessage ? `${c.lastMessage.fromMe ? "You: " : ""}${c.lastMessage.content}` : "Say hello 👋"}
                </p>
              </div>
              {c.unread > 0 && <Badge tone="purple">{c.unread}</Badge>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
