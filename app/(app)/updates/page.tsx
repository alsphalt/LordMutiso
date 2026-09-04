"use client";

import * as React from "react";
import { Sparkles, Plus, ImagePlus, Trash2, Eye } from "lucide-react";
import { api } from "@/hooks/api";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import { fileToImageDataUrl } from "@/components/social/media";
import { timeAgo } from "@/lib/utils";

interface Story {
  id: string;
  kind: "TEXT" | "IMAGE";
  text: string | null;
  mediaUrl: string | null;
  visibility: "CONTACTS" | "SELECTED" | "ONLY_ME";
  mine: boolean;
  author: { username: string; displayName: string | null; image: string | null } | null;
  createdAt: string;
  viewCount?: number;
  seen?: boolean;
}

type Vis = "CONTACTS" | "SELECTED" | "ONLY_ME";

export default function UpdatesPage() {
  const { push } = useToast();
  const [items, setItems] = React.useState<Story[] | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [text, setText] = React.useState("");
  const [vis, setVis] = React.useState<Vis>("CONTACTS");
  const [contacts, setContacts] = React.useState<Array<{ id: string; username: string; displayName: string | null }>>([]);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api<{ updates: Story[] }>("/api/social/updates")
      .then((d) => setItems(d.updates))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    load();
    const iv = window.setInterval(load, 8000);
    return () => window.clearInterval(iv);
  }, [load]);

  const openPicker = () => {
    setCreating(true);
    api<{ users: Array<{ id: string; username: string; displayName: string | null }> }>("/api/social/people?list=contacts")
      .then((d) => setContacts(d.users))
      .catch(() => setContacts([]));
  };

  const create = async (mediaUrl?: string) => {
    if (!mediaUrl && text.trim().length === 0) return;
    setBusy(true);
    try {
      await api("/api/social/updates", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          kind: mediaUrl ? "IMAGE" : "TEXT",
          text: text.trim(),
          mediaUrl,
          visibility: vis,
          selectedIds: vis === "SELECTED" ? picked : undefined,
        }),
      });
      setText("");
      setPicked([]);
      setCreating(false);
      load();
      push({ message: "Update shared", tone: "success" });
    } catch (e) {
      push({ message: (e as Error).message ?? "Could not share update", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (storyId: string) => {
    try {
      await api("/api/social/updates", { method: "POST", body: JSON.stringify({ action: "delete", storyId }) });
      setItems((prev) => (prev ?? []).filter((s) => s.id !== storyId));
    } catch {
      push({ message: "Could not delete update", tone: "error" });
    }
  };

  const markSeen = async (story: Story) => {
    if (story.mine || story.seen) return;
    api("/api/social/updates", { method: "POST", body: JSON.stringify({ action: "view", storyId: story.id }) })
      .then(() => setItems((prev) => (prev ?? []).map((s) => (s.id === story.id ? { ...s, seen: true } : s))))
      .catch(() => {});
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-24">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">Updates</h1>
          <p className="text-xs text-slate-500">Private moments shared with the people you choose</p>
        </div>
        {!creating && (
          <Button size="sm" onClick={openPicker}>
            <Plus size={16} className="mr-1" /> Create
          </Button>
        )}
      </div>

      {creating && (
        <div className="glass mb-4 space-y-3 rounded-2xl border p-4">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="What's on your mind? (text, or add a photo below)" />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300 hover:text-white">
            <ImagePlus size={18} /> Add photo/video
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const dataUrl = await fileToImageDataUrl(f, 1024, 0.8);
                  await create(dataUrl);
                } catch (err) {
                  push({ message: (err as Error).message ?? "Upload failed", tone: "error" });
                }
              }}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Who can see:</span>
            {(["CONTACTS", "SELECTED", "ONLY_ME"] as Vis[]).map((v) => (
              <button
                key={v}
                onClick={() => setVis(v)}
                className={cn2(vis === v ? "border-arena-purple bg-arena-purple/20 text-white" : "border-white/10 text-slate-400 hover:bg-white/5")}
              >
                {v === "CONTACTS" ? "My Contacts" : v === "SELECTED" ? "Selected Contacts" : "Only Me"}
              </button>
            ))}
          </div>
          {vis === "SELECTED" && (
            <div className="flex flex-wrap gap-1.5">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                  className={cn2(picked.includes(c.id) ? "bg-white text-arena-900" : "bg-white/10 text-slate-200")}
                >
                  {c.displayName ?? c.username}
                </button>
              ))}
              {contacts.length === 0 && <span className="text-xs text-slate-500">No contacts yet — search people from the Chats screen.</span>}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy || (text.trim().length === 0)} onClick={() => void create()}>
              Share
            </Button>
          </div>
        </div>
      )}

      {items === null ? (
        <p className="py-14 text-center text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No updates yet"
          message="Share a photo or message with your contacts."
          action={
            <Button onClick={openPicker}>
              <Plus size={15} className="mr-1" /> Create Update
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <button
              key={s.id}
              onClick={() => void markSeen(s)}
              className="glass flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors hover:bg-white/10"
            >
              <Avatar
                username={s.mine ? "You" : (s.author?.displayName ?? s.author?.username ?? "?")}
                src={s.mine ? undefined : s.author?.image}
                size={42}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {s.mine ? "My Update" : (s.author?.displayName ?? s.author?.username)}
                  </span>
                  {!s.seen && !s.mine && <span className="h-2 w-2 rounded-full bg-arena-purple" />}
                  {s.mine && <Badge tone="cyan">{s.visibility === "ONLY_ME" ? "Only me" : s.visibility === "SELECTED" ? "Selected" : "Contacts"}</Badge>}
                  <span className="ml-auto text-[10px] text-slate-500">{timeAgo(s.createdAt)}</span>
                </div>
                {s.kind === "IMAGE" && s.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.mediaUrl} alt="update" className="mt-2 max-h-64 w-full rounded-xl object-cover" />
                ) : (
                  s.text && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-200">{s.text}</p>
                )}
                <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                  {s.mine ? (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Eye size={12} /> {s.viewCount ?? 0} {s.viewCount === 1 ? "view" : "views"}
                      </span>
                      <button
                        aria-label="Delete update"
                        onClick={(e) => {
                          e.stopPropagation();
                          void remove(s.id);
                        }}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </>
                  ) : (
                    <span>{s.seen ? "Seen ✓" : "Tap to mark seen"}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function cn2(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
