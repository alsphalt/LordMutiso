"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Archive,
  ArchiveRestore,
  BellOff,
  Check,
  CheckCheck,
  MessagesSquare,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/hooks/api";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Conv,
  PublicUser,
  convAvatarSeed,
  convTitle,
  fmtRowTime,
} from "@/components/social/chats-shared";

type Filter = "ALL" | "UNREAD" | "GROUPS" | "ARCHIVED";
const FILTERS: Filter[] = ["ALL", "UNREAD", "GROUPS", "ARCHIVED"];

/* ---------------------------------------------------------------- */
/* Small pieces                                                      */
/* ---------------------------------------------------------------- */

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] align-middle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-[3px] w-[3px] rounded-full bg-violet-400 animate-pulse"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  );
}

function RingAvatar({ conv, size = 44 }: { conv: Conv; size?: number }) {
  const src =
    conv.kind === "GROUP" ? conv.avatarUrl : conv.peer?.image ?? null;
  const seed = convAvatarSeed(conv);
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "rounded-full p-[2px] bg-gradient-to-br",
          conv.kind === "GROUP"
            ? "from-violet-500 via-fuchsia-500 to-cyan-400 shadow-glow"
            : "from-arena-purple to-cyan-400 shadow-glow-blue"
        )}
      >
        <div className="rounded-full bg-arena-900">
          <Avatar username={seed} src={src} size={size} />
        </div>
      </div>
      {conv.kind === "DM" && conv.peer?.online && (
        <span className="absolute -bottom-px -right-px h-3 w-3 rounded-full border-2 border-arena-950 bg-emerald-400" />
      )}
    </div>
  );
}

/** Slate → cyan → blue read ticks for the viewer's own messages. */
function Ticks({ delivered, read, className }: { delivered: boolean; read: boolean; className?: string }) {
  if (!delivered) return <span className={cn("text-slate-400", className)}>✓</span>;
  return (
    <span className={cn(read ? "text-sky-400" : "text-cyan-400", className)}>✓✓</span>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

/* ---------------------------------------------------------------- */
/* Overlay menu (modal, not a browser menu)                          */
/* ---------------------------------------------------------------- */

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-arena-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm glass-strong rounded-t-2xl sm:rounded-2xl shadow-2xl animate-pop-in overflow-hidden max-h-[80vh] flex flex-col">
        {children}
      </div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors text-left",
        danger ? "text-rose-400 hover:bg-rose-500/10" : "text-slate-200 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon size={17} className={danger ? "text-rose-400" : "text-slate-400"} />
      {label}
    </button>
  );
}

function RowMenu({
  conv,
  onClose,
  onChanged,
}: {
  conv: Conv;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState<"clear" | "delete" | null>(null);

  const act = async (action: string) => {
    setBusy(true);
    try {
      await api(`/api/conversations/${conv.id}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      onChanged();
      onClose();
    } catch (e) {
      push({ message: errMsg(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const doDestructive = async () => {
    setBusy(true);
    try {
      if (confirming === "delete") {
        await api(`/api/conversations/${conv.id}`, { method: "POST", body: JSON.stringify({ action: "archive" }) });
        await api(`/api/conversations/${conv.id}`, { method: "POST", body: JSON.stringify({ action: "clear" }) });
      } else {
        await api(`/api/conversations/${conv.id}`, { method: "POST", body: JSON.stringify({ action: "clear" }) });
      }
      onChanged();
      onClose();
    } catch (e) {
      push({ message: errMsg(e), tone: "error" });
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  return (
    <Sheet open onClose={onClose}>
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-white/10">
        <RingAvatar conv={conv} size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{convTitle(conv)}</p>
          <p className="text-[11px] text-slate-500">{conv.kind === "GROUP" ? "Group chat" : conv.peer ? `@${conv.peer.username}` : ""}</p>
        </div>
      </div>

      {confirming ? (
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-300">
            {confirming === "delete"
              ? "Delete this chat? Messages are cleared and the chat is archived."
              : "Clear chat history? This cannot be undone."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={busy} onClick={() => void doDestructive()}>
              {confirming === "delete" ? "Delete" : "Clear"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-1 overflow-y-auto">
          <MenuItem
            icon={ArrowUpRight}
            label="Open"
            onClick={() => {
              onClose();
              router.push(`/chats/${conv.id}`);
            }}
          />
          {conv.unread > 0 ? (
            <MenuItem icon={CheckCheck} label="Mark as read" onClick={() => void act("read")} />
          ) : (
            <MenuItem icon={CheckCheck} label="Mark as unread" onClick={() => void act("markUnread")} />
          )}
          {conv.muted ? (
            <MenuItem icon={BellOff} label="Unmute" onClick={() => void act("unmute")} />
          ) : (
            <MenuItem icon={BellOff} label="Mute" onClick={() => void act("mute")} />
          )}
          {conv.archived ? (
            <MenuItem icon={ArchiveRestore} label="Unarchive" onClick={() => void act("unarchive")} />
          ) : (
            <MenuItem icon={Archive} label="Archive" onClick={() => void act("archive")} />
          )}
          <MenuItem icon={Trash2} label="Clear history" onClick={() => setConfirming("clear")} />
          <MenuItem icon={Trash2} label="Delete" danger onClick={() => setConfirming("delete")} />
        </div>
      )}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */
/* New chat / New group compose modal                                */
/* ---------------------------------------------------------------- */

function ComposeModal({
  open,
  initialTab,
  onClose,
}: {
  open: boolean;
  initialTab: "chat" | "group";
  onClose: () => void;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [tab, setTab] = React.useState<"chat" | "group">(initialTab);
  const [q, setQ] = React.useState("");
  const [users, setUsers] = React.useState<PublicUser[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [groupName, setGroupName] = React.useState("");
  const [selected, setSelected] = React.useState<PublicUser[]>([]);
  const [working, setWorking] = React.useState(false);

  const switchTab = (t: "chat" | "group") => {
    setTab(t);
    setQ("");
    setUsers([]);
  };

  React.useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setQ("");
    setUsers([]);
    setSelected([]);
    setGroupName("");
  }, [open, initialTab]);

  React.useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setUsers([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const h = window.setTimeout(() => {
      api<{ users: PublicUser[] }>(`/api/social/people?q=${encodeURIComponent(t)}`)
        .then((d) => setUsers(d.users))
        .catch(() => setUsers([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(h);
  }, [q]);

  const startChat = async (u: PublicUser) => {
    if (working) return;
    setWorking(true);
    try {
      const d = await api<{ conversation: Conv }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ targetId: u.id }),
      });
      onClose();
      router.push(`/chats/${d.conversation.id}`);
    } catch (e) {
      push({ message: errMsg(e), tone: "error" });
      setWorking(false);
    }
  };

  const toggleMember = (u: PublicUser) => {
    setSelected((prev) => (prev.some((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u]));
  };

  const createGroup = async () => {
    if (working || selected.length === 0) return;
    setWorking(true);
    try {
      const d = await api<{ conversation: Conv }>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName.trim() || undefined, userIds: selected.map((u) => u.id) }),
      });
      push({ message: "Group created", tone: "success" });
      onClose();
      router.push(`/chats/${d.conversation.id}`);
    } catch (e) {
      push({ message: errMsg(e), tone: "error" });
      setWorking(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-arena-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg glass-strong rounded-t-2xl sm:rounded-2xl shadow-2xl animate-pop-in flex flex-col max-h-[88dvh] overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex gap-1.5 p-1 bg-white/[0.05] border border-white/10 rounded-xl">
            {(
              [
                { id: "chat", label: "New chat" },
                { id: "group", label: "New group" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={cn(
                  "px-4 py-1.5 text-sm font-semibold rounded-lg transition-all",
                  tab === t.id
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-glow"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-1 pb-3 overflow-y-auto flex-1">
          {tab === "group" && (
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (optional)"
              className="mb-3"
              maxLength={40}
            />
          )}

          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === "chat" ? "Search by name or @username…" : "Add members by name or @username…"}
              className="pl-9"
            />
          </div>

          {tab === "group" && selected.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600/25 to-fuchsia-600/25 border border-violet-500/30 pl-1 pr-2 py-1 text-xs text-white"
                >
                  <Avatar username={u.displayName ?? u.username} src={u.image} size={18} />
                  {u.displayName ?? u.username}
                  <button aria-label="Remove" onClick={() => toggleMember(u)} className="text-slate-400 hover:text-white">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 space-y-0.5">
            {searching && <p className="px-1 py-3 text-xs text-slate-500">Searching…</p>}
            {!searching && q.trim().length >= 2 && users.length === 0 && (
              <p className="px-1 py-3 text-xs text-slate-500">No one found (privacy settings apply).</p>
            )}
            {!searching && q.trim().length < 2 && (
              <p className="px-1 py-3 text-xs text-slate-500">
                {tab === "chat" ? "Type at least 2 characters to search." : "Search for people to add to the group."}
              </p>
            )}
            {users.map((u) => {
              const isSel = selected.some((x) => x.id === u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => (tab === "chat" ? void startChat(u) : toggleMember(u))}
                  disabled={working}
                  className="w-full flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/5 disabled:opacity-60"
                >
                  <Avatar username={u.displayName ?? u.username} src={u.image} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{u.displayName ?? u.username}</p>
                    <p className="truncate text-xs text-slate-500">@{u.username}</p>
                  </div>
                  {tab === "group" && (
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border transition-all",
                        isSel ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 border-transparent text-white" : "border-white/20 text-transparent"
                      )}
                    >
                      <Check size={14} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "group" && (
          <div className="px-5 py-3 border-t border-white/10 flex justify-end">
            <Button onClick={() => void createGroup()} disabled={selected.length === 0 || working} loading={working}>
              <Users size={15} className="mr-2" /> Create group
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function ChatsPage() {
  const router = useRouter();
  const [data, setData] = React.useState<{ conversations: Conv[]; archived: Conv[] } | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [menuConv, setMenuConv] = React.useState<Conv | null>(null);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [composeTab, setComposeTab] = React.useState<"chat" | "group">("chat");

  const load = React.useCallback(async () => {
    try {
      const d = await api<{ conversations: Conv[]; archived: Conv[] }>("/api/conversations");
      setData(d);
      setLoadError(null);
    } catch (e) {
      setLoadError(errMsg(e));
    }
  }, []);

  React.useEffect(() => {
    void load();
    const iv = window.setInterval(() => void load(), 4000);
    const onVis = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const counts = React.useMemo(() => {
    const active = data?.conversations ?? [];
    const archived = data?.archived ?? [];
    return {
      ALL: active.length,
      UNREAD: active.filter((c) => c.unread > 0).length,
      GROUPS: active.filter((c) => c.kind === "GROUP").length,
      ARCHIVED: archived.length,
    } as Record<Filter, number>;
  }, [data]);

  const rows = React.useMemo(() => {
    const base = data ? (filter === "ARCHIVED" ? data.archived : data.conversations) : [];
    const scoped = filter === "ALL" ? base : filter === "UNREAD" ? base.filter((c) => c.unread > 0) : filter === "GROUPS" ? base.filter((c) => c.kind === "GROUP") : base;
    const t = q.trim().toLowerCase();
    if (!t) return scoped;
    return scoped.filter((c) => {
      const title = convTitle(c).toLowerCase();
      const preview = c.lastMessage?.content.toLowerCase() ?? "";
      const sender = c.lastMessage?.senderName.toLowerCase() ?? "";
      return title.includes(t) || preview.includes(t) || sender.includes(t);
    });
  }, [data, filter, q]);

  const emptyTitle =
    filter === "ALL"
      ? "No conversations yet"
      : filter === "UNREAD"
        ? "You're all caught up"
        : filter === "GROUPS"
          ? "No groups yet"
          : "No archived chats";

  const emptyMessage =
    filter === "UNREAD"
      ? "New messages will show up here."
      : filter === "ARCHIVED"
        ? "Chats you archive will be kept here."
        : "Start a chat and it will appear here.";

  return (
    <div className="mx-auto w-full max-w-2xl px-2 sm:px-4">
      {/* Header */}
      <div className="sticky top-16 z-20 -mx-2 sm:-mx-4 px-2 sm:px-4 pt-1 pb-2 bg-arena-950/85 backdrop-blur-xl">
        <div className="flex items-center justify-between py-1">
          <h1 className="text-[26px] font-extrabold tracking-tight text-white">CHATS</h1>
          <div className="flex items-center gap-1">
            <button
              aria-label="Search chats"
              onClick={() => setSearchOpen((v) => !v)}
              className={cn(
                "rounded-full p-2.5 transition-colors",
                searchOpen ? "bg-violet-600/25 text-violet-300" : "text-slate-400 hover:bg-white/10 hover:text-white"
              )}
            >
              <Search size={19} />
            </button>
            <button
              aria-label="More options"
              onClick={() => setMoreOpen(true)}
              className="rounded-full p-2.5 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <MoreVertical size={19} />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search chats or messages…"
              className="pl-9 h-10"
            />
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-all border",
                filter === f
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-transparent shadow-glow"
                  : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200"
              )}
            >
              {f === "ALL" ? "All" : f === "UNREAD" ? "Unread" : f === "GROUPS" ? "Groups" : "Archived"}
              <span className={cn("ml-1.5", filter === f ? "text-white/80" : "text-slate-500")}>{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {data === null && !loadError ? (
        <div className="space-y-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl px-3 py-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="glass mt-6 flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-slate-400">{loadError}</p>
          <Button size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        q.trim().length > 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-slate-500">No chats match “{q.trim()}”.</p>
            <button
              onClick={() => setQ("")}
              className="mt-2 text-xs font-semibold text-arena-blue hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="pt-6">
            <EmptyState
              icon={MessagesSquare}
              title={emptyTitle}
              message={emptyMessage}
              action={
                filter === "ALL" ? (
                  <Button onClick={() => setComposeOpen(true)}>
                    <Plus size={15} className="mr-1" /> New chat
                  </Button>
                ) : undefined
              }
            />
          </div>
        )
      ) : (
        <div className="pt-1.5">
          {rows.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/chats/${c.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(`/chats/${c.id}`);
              }}
              className="group flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
            >
              <RingAvatar conv={c} size={44} />

              <div className="min-w-0 flex-1 py-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[15px] font-bold text-white">{convTitle(c)}</p>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {fmtRowTime(c.lastMessage?.createdAt ?? c.lastAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px] leading-snug",
                      c.typing ? "text-violet-400" : c.unread > 0 ? "text-slate-200 font-semibold" : "text-slate-500"
                    )}
                  >
                    {c.typing ? (
                      <>
                        typing
                        <TypingDots />
                      </>
                    ) : c.lastMessage ? (
                      <>
                        {c.kind === "GROUP" && !c.lastMessage.fromMe && (
                          <span className="font-semibold text-slate-300">{c.lastMessage.senderName}: </span>
                        )}
                        {c.lastMessage.fromMe && (
                          <>
                            <span className="font-semibold text-slate-300">You: </span>
                            <Ticks delivered={c.lastMessage.delivered} read={c.lastMessage.read} className="mr-0.5 text-[11px]" />
                          </>
                        )}
                        {c.lastMessage.kind === "IMAGE" ? "🖼 Photo" : c.lastMessage.content}
                      </>
                    ) : (
                      <span className="text-slate-600">No messages yet</span>
                    )}
                  </p>
                  <span className="flex shrink-0 items-center gap-1.5 pl-2">
                    {c.muted && <BellOff size={13} className="text-slate-500" />}
                    {c.unread > 0 && (
                      <span className="flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 px-1.5 text-[10px] font-bold text-white shadow-glow">
                        {c.unread > 99 ? "99+" : c.unread}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <button
                aria-label="Conversation options"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuConv(c);
                }}
                className="shrink-0 rounded-full p-2 text-slate-500 opacity-60 transition-all hover:bg-white/10 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
              >
                <MoreVertical size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Row action menu */}
      {menuConv && (
        <RowMenu
          key={menuConv.id}
          conv={menuConv}
          onClose={() => setMenuConv(null)}
          onChanged={() => void load()}
        />
      )}

      {/* NEW CHAT FAB */}
      <button
        aria-label="New chat"
        onClick={() => {
          setComposeTab("chat");
          setComposeOpen(true);
        }}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-glow transition-transform active:scale-95 md:bottom-6"
      >
        <Plus size={26} />
      </button>

      {/* More menu */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)}>
        <div className="py-1">
          <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">More</p>
          <MenuItem
            icon={MessagesSquare}
            label="New chat"
            onClick={() => {
              setMoreOpen(false);
              setComposeTab("chat");
              setComposeOpen(true);
            }}
          />
          <MenuItem
            icon={Users}
            label="New group"
            onClick={() => {
              setMoreOpen(false);
              setComposeTab("group");
              setComposeOpen(true);
            }}
          />
        </div>
      </Sheet>

      <ComposeModal open={composeOpen} initialTab={composeTab} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
