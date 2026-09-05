"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  BellOff,
  CheckCheck,
  ImagePlus,
  MoreVertical,
  Send,
  Smile,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/hooks/api";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Conv,
  HistoryResponse,
  Msg,
  convAvatarSeed,
  convTitle,
  fmtClock,
  fmtDayLabel,
  fmtLastSeen,
  senderColor,
} from "@/components/social/chats-shared";

const EMOJIS = ["😀", "😂", "😍", "👍", "🙏", "🔥", "🎉", "😅", "😢", "🤔", "😎", "🥳", "❤️", "♟️", "🎲"];
const PAGE = 20;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

/* ---------------------------------------------------------------- */
/* Small UI pieces                                                   */
/* ---------------------------------------------------------------- */

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] align-middle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-[3px] w-[3px] rounded-full bg-violet-300 animate-pulse"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  );
}

function Ticks({ delivered, read, className }: { delivered: boolean; read: boolean; className?: string }) {
  if (!delivered) return <span className={cn("text-slate-400", className)}>✓</span>;
  return (
    <span className={cn(read ? "text-sky-400" : "text-cyan-400", className)}>✓✓</span>
  );
}

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

/**
 * Client-side image compression → JPEG data URL ≤ ~360KB.
 * Canvas downscale (max 900px) + quality stepping; never sends raw files.
 */
async function fileToChatImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file (JPG/PNG/WEBP)");
  if (file.size > 12 * 1024 * 1024) throw new Error("Image is too large (max 12MB)");
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Not a valid image"));
    im.src = raw;
  });
  const bytesOf = (d: string) => Math.floor(((d.split(",")[1] ?? "").length * 3) / 4);
  const encode = (maxDim: number, q: number): string => {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", q);
  };
  for (const [dim, q] of [
    [900, 0.82],
    [900, 0.6],
    [720, 0.6],
    [560, 0.55],
  ] as const) {
    const out = encode(dim, q);
    if (bytesOf(out) <= 360_000) return out;
  }
  throw new Error("Image is too large even after compression");
}

/* ---------------------------------------------------------------- */
/* Thread                                                            */
/* ---------------------------------------------------------------- */

export default function ChatThread() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { push } = useToast();

  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [meta, setMeta] = React.useState<Conv | null>(null);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [text, setText] = React.useState("");
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [clearArmed, setClearArmed] = React.useState(false);
  const [menuBusy, setMenuBusy] = React.useState(false);
  const [visible, setVisible] = React.useState(true);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const idsRef = React.useRef<Set<string>>(new Set());
  const oldestRef = React.useRef<string | null>(null);
  const hasMoreRef = React.useRef(true);
  const inFlightRef = React.useRef(false);
  const nearBottomRef = React.useRef(true);
  const lastReadRef = React.useRef(0);
  const lastTypingRef = React.useRef(0);
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  const postTyping = React.useCallback(
    (state: boolean) => {
      api(`/api/conversations/${id}/typing`, {
        method: "POST",
        body: JSON.stringify({ typing: state }),
      }).catch(() => {});
    },
    [id]
  );

  const notifyTyping = React.useCallback(
    (state: boolean) => {
      if (state) {
        const now = Date.now();
        if (now - lastTypingRef.current >= 3000) {
          lastTypingRef.current = now;
          postTyping(true);
        }
      } else {
        lastTypingRef.current = 0;
        postTyping(false);
      }
    },
    [postTyping]
  );

  const scrollToBottom = React.useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const markReadIfNeeded = React.useCallback(
    (fresh: Msg[]) => {
      if (!fresh.some((m) => !m.fromMe)) return;
      if (!nearBottomRef.current || document.hidden) return;
      const now = Date.now();
      if (now - lastReadRef.current < 1500) return;
      lastReadRef.current = now;
      api(`/api/conversations/${id}`, { method: "POST", body: JSON.stringify({ action: "read" }) }).catch(() => {});
      setMeta((prev) => (prev ? { ...prev, unread: 0 } : prev));
    },
    [id]
  );

  const loadOlder = React.useCallback(async () => {
    if (inFlightRef.current || !hasMoreRef.current || !oldestRef.current) return;
    inFlightRef.current = true;
    const el = scrollRef.current;
    const prevH = el ? el.scrollHeight : 0;
    const prevT = el ? el.scrollTop : 0;
    try {
      const d = await api<HistoryResponse>(
        `/api/conversations/${id}?limit=${PAGE}&before=${encodeURIComponent(oldestRef.current)}`
      );
      const fresh = d.messages.filter((m) => !idsRef.current.has(m.id));
      fresh.forEach((m) => idsRef.current.add(m.id));
      if (fresh.length === 0) {
        hasMoreRef.current = false;
        return;
      }
      oldestRef.current = fresh[0].id;
      hasMoreRef.current = d.hasMore;
      setMsgs((prev) => [...fresh, ...prev]);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevH + prevT;
      });
    } catch {
      hasMoreRef.current = false;
    } finally {
      inFlightRef.current = false;
    }
  }, [id]);

  const pollNewer = React.useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const d = await api<HistoryResponse>(`/api/conversations/${id}?limit=${PAGE}`);
      setMeta(d.meta);
      hasMoreRef.current = d.hasMore;
      const fresh = d.messages.filter((m) => !idsRef.current.has(m.id));
      if (fresh.length === 0) return;
      fresh.forEach((m) => idsRef.current.add(m.id));
      setMsgs((prev) => [...prev, ...fresh]);
      markReadIfNeeded(fresh);
    } catch {
      /* silent — next poll retries */
    } finally {
      inFlightRef.current = false;
    }
  }, [id, markReadIfNeeded]);

  const loadInitial = React.useCallback(async () => {
    setInitialLoading(true);
    setLoadError(null);
    try {
      const d = await api<HistoryResponse>(`/api/conversations/${id}?limit=${PAGE}`);
      idsRef.current = new Set(d.messages.map((m) => m.id));
      oldestRef.current = d.messages[0]?.id ?? null;
      hasMoreRef.current = d.hasMore;
      setMsgs(d.messages);
      setMeta(d.meta);
      markReadIfNeeded(d.messages);
      scrollToBottom();
    } catch (e) {
      setLoadError(errMsg(e));
    } finally {
      setInitialLoading(false);
    }
  }, [id, markReadIfNeeded, scrollToBottom]);

  /* Mount + poll lifecycle */
  React.useEffect(() => {
    void loadInitial();
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      postTyping(false);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!visible || initialLoading || loadError) return;
    const iv = window.setInterval(() => void pollNewer(), 3000);
    return () => window.clearInterval(iv);
  }, [visible, initialLoading, loadError, pollNewer]);

  /* Keep pinned to bottom while near the bottom (own sends & new messages). */
  React.useEffect(() => {
    if (nearBottomRef.current) scrollToBottom();
  }, [msgs, scrollToBottom]);

  /* Typing heartbeat while composing. */
  React.useEffect(() => {
    if (text.trim().length === 0) {
      notifyTyping(false);
      return;
    }
    notifyTyping(true);
    const iv = window.setInterval(() => notifyTyping(true), 3000);
    return () => window.clearInterval(iv);
  }, [text, notifyTyping]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 60) void loadOlder();
  };

  const resizeTa = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    notifyTyping(false);
    try {
      const d = await api<{ message: Msg }>(`/api/conversations/${id}`, {
        method: "POST",
        body: JSON.stringify({ action: "send", kind: "TEXT", content: body }),
      });
      const m = d.message;
      if (!idsRef.current.has(m.id)) {
        idsRef.current.add(m.id);
        setMsgs((prev) => [...prev, m]);
      }
      setText("");
      if (taRef.current) taRef.current.style.height = "auto";
    } catch (e) {
      push({ message: errMsg(e), tone: "error" });
    } finally {
      setSending(false);
    }
  };

  const sendImage = async (file: File) => {
    if (sending) return;
    setSending(true);
    try {
      const dataUrl = await fileToChatImage(file);
      const d = await api<{ message: Msg }>(`/api/conversations/${id}`, {
        method: "POST",
        body: JSON.stringify({ action: "send", kind: "IMAGE", content: "", mediaUrl: dataUrl }),
      });
      const m = d.message;
      if (!idsRef.current.has(m.id)) {
        idsRef.current.add(m.id);
        setMsgs((prev) => [...prev, m]);
      }
    } catch (e) {
      push({ message: errMsg(e), tone: "error" });
    } finally {
      setSending(false);
    }
  };

  const menuAction = async (action: string) => {
    setMenuBusy(true);
    try {
      await api(`/api/conversations/${id}`, { method: "POST", body: JSON.stringify({ action }) });
      if (action === "archive") {
        push({ message: "Chat archived", tone: "success" });
        router.push("/chats");
        return;
      }
      if (action === "unarchive") {
        push({ message: "Chat restored", tone: "success" });
        setMeta((p) => (p ? { ...p, archived: false } : p));
      }
      if (action === "mute") setMeta((p) => (p ? { ...p, muted: true } : p));
      if (action === "unmute") setMeta((p) => (p ? { ...p, muted: false } : p));
      if (action === "clear") {
        setMsgs([]);
        push({ message: "History cleared", tone: "success" });
      }
      setMenuOpen(false);
    } catch (e) {
      push({ message: errMsg(e), tone: "error" });
    } finally {
      setMenuBusy(false);
    }
  };

  const title = meta ? convTitle(meta) : "…";
  const subtitle = React.useMemo(() => {
    if (!meta) return "";
    if (meta.typing) return "typing";
    if (meta.kind === "GROUP") return "Group";
    const peer = meta.peer;
    if (peer?.online) return "online";
    return fmtLastSeen(peer?.lastSeenAt ?? null) ?? "";
  }, [meta]);

  /* ---------------- render ---------------- */
  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] w-full max-w-2xl flex-col md:h-[calc(100dvh-7.5rem)]">
      {/* Sticky header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-arena-900/90 px-2 py-2 backdrop-blur-xl sm:px-3">
        <button
          aria-label="Back to chats"
          onClick={() => router.push("/chats")}
          className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="relative shrink-0">
          <Avatar
            username={meta ? convAvatarSeed(meta) : "?"}
            src={meta ? (meta.kind === "GROUP" ? meta.avatarUrl : meta.peer?.image ?? null) : null}
            size={40}
          />
          {meta && meta.kind === "DM" && meta.peer?.online && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-arena-900 bg-emerald-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-white">{title}</p>
          <p className={cn("flex h-4 items-center truncate text-[11.5px]", meta?.typing ? "text-violet-400" : "text-slate-500")}>
            {subtitle === "typing" ? (
              <>
                typing
                <TypingDots />
              </>
            ) : subtitle === "online" ? (
              <span className="text-emerald-400">online</span>
            ) : (
              subtitle
            )}
          </p>
        </div>
        <button
          aria-label="Conversation options"
          onClick={() => setMenuOpen(true)}
          className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <MoreVertical size={19} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto custom-scrollbar px-2 py-3 sm:px-4"
        style={{
          background:
            "radial-gradient(700px 320px at 15% 0%, rgba(139,92,246,0.10), transparent 60%), radial-gradient(700px 320px at 85% 100%, rgba(34,211,238,0.07), transparent 60%), #0a0614",
        }}
      >
        {initialLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size={26} className="text-violet-400" />
          </div>
        ) : loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-slate-400">{loadError}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => router.push("/chats")}>
                Back
              </Button>
              <Button size="sm" onClick={() => void loadInitial()}>
                Retry
              </Button>
            </div>
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-slate-500">Say hi 👋</p>
          </div>
        ) : (
          <div className="space-y-1">
            {msgs.map((m, i) => {
              const prev = i > 0 ? msgs[i - 1] : null;
              const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);
              const showSender = meta?.kind === "GROUP" && !m.fromMe;
              return (
                <React.Fragment key={m.id}>
                  {showDay && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                        {fmtDayLabel(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={cn("flex w-full", m.fromMe ? "justify-end" : "justify-start")}>
                    <div className={cn("flex max-w-[82%] flex-col", m.fromMe ? "items-end" : "items-start")}>
                      {showSender && (
                        <span
                          className={cn(
                            "mb-0.5 ml-2 text-[11px] font-bold",
                            senderColor(m.sender?.id ?? m.sender?.username ?? m.id)
                          )}
                        >
                          {m.sender?.displayName ?? m.sender?.username ?? "Unknown"}
                        </span>
                      )}
                      <div
                        className={cn(
                          "relative px-1.5 pb-1 pt-1.5 text-[14px] leading-snug shadow-sm",
                          m.fromMe
                            ? "rounded-2xl rounded-br-[5px] bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white"
                            : "rounded-2xl rounded-bl-[5px] border border-white/10 bg-white/[0.07] text-slate-100"
                        )}
                      >
                        {m.kind === "IMAGE" ? (
                          m.mediaUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.mediaUrl}
                              alt="Shared photo"
                              className="max-h-72 w-full max-w-[300px] rounded-xl object-cover"
                            />
                          ) : (
                            <div className="px-2 py-4 text-center text-xs text-slate-400">Photo</div>
                          )
                        ) : (
                          <p className="whitespace-pre-wrap break-words px-1.5">{m.content}</p>
                        )}
                        <div
                          className={cn(
                            "flex items-center justify-end gap-1 px-1.5 pt-1 text-[10px]",
                            m.fromMe ? "text-white/70" : "text-slate-500"
                          )}
                        >
                          <span>{fmtClock(m.createdAt)}</span>
                          {m.fromMe && <Ticks delivered={m.delivered} read={m.read} />}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-white/10 bg-arena-900/95 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {emojiOpen && (
          <div className="grid grid-cols-8 gap-1 border-b border-white/5 px-3 py-2 animate-pop-in sm:grid-cols-10">
            {EMOJIS.map((e) => (
              <button
                key={e}
                aria-label={`Emoji ${e}`}
                onClick={() => setText((t) => t + e)}
                className="flex h-9 items-center justify-center rounded-lg text-xl transition-colors hover:bg-white/10"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5 px-2 py-2">
          <button
            aria-label="Emoji picker"
            onClick={() => setEmojiOpen((v) => !v)}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
              emojiOpen ? "bg-violet-600/25 text-violet-300" : "text-slate-400 hover:bg-white/10 hover:text-white"
            )}
          >
            <Smile size={20} />
          </button>
          <label
            aria-label="Attach image"
            className={cn(
              "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
              sending ? "opacity-40" : "text-slate-400 hover:bg-white/10 hover:text-white"
            )}
          >
            <ImagePlus size={20} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={sending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void sendImage(f);
              }}
            />
          </label>
          <textarea
            ref={taRef}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              resizeTa();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Message…"
            className="max-h-24 min-h-[40px] flex-1 resize-none overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm leading-5 text-white placeholder:text-slate-500 focus-ring"
          />
          <button
            aria-label="Send message"
            onClick={() => void send()}
            disabled={sending || text.trim().length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-glow transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100"
          >
            {sending ? <Spinner size={17} /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {/* ⋮ action menu */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 pb-3 pt-4">
          <Avatar
            username={meta ? convAvatarSeed(meta) : "?"}
            src={meta ? (meta.kind === "GROUP" ? meta.avatarUrl : meta.peer?.image ?? null) : null}
            size={34}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{title}</p>
            <p className="text-[11px] text-slate-500">{meta?.kind === "GROUP" ? "Group chat" : meta?.peer ? `@${meta.peer.username}` : ""}</p>
          </div>
        </div>
        {clearArmed ? (
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-300">Clear chat history? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setClearArmed(false)} disabled={menuBusy}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" loading={menuBusy} onClick={() => void menuAction("clear")}>
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-1">
            {meta?.muted ? (
              <MenuItem icon={BellOff} label="Unmute" onClick={() => void menuAction("unmute")} />
            ) : (
              <MenuItem icon={BellOff} label="Mute" onClick={() => void menuAction("mute")} />
            )}
            {meta?.archived ? (
              <MenuItem icon={ArchiveRestore} label="Unarchive" onClick={() => void menuAction("unarchive")} />
            ) : (
              <MenuItem icon={Archive} label="Archive" onClick={() => void menuAction("archive")} />
            )}
            <MenuItem icon={Trash2} label="Clear history" onClick={() => setClearArmed(true)} />
            {meta?.kind === "DM" && meta.peer && (
              <MenuItem
                icon={User}
                label="View profile"
                onClick={() => {
                  setMenuOpen(false);
                  router.push(`/u/${meta.peer!.username}`);
                }}
              />
            )}
            {meta?.unread ? (
              <MenuItem
                icon={CheckCheck}
                label="Mark as read"
                onClick={() => {
                  void menuAction("read");
                  setMeta((p) => (p ? { ...p, unread: 0 } : p));
                }}
              />
            ) : null}
          </div>
        )}
      </Sheet>
    </div>
  );
}
