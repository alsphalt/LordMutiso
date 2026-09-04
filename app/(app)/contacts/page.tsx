"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users, Search, UserPlus, Share2 } from "lucide-react";
import { api } from "@/hooks/api";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";

interface Person {
  id: string;
  username: string;
  displayName: string | null;
  image: string | null;
  online: boolean;
}

export default function ContactsPage() {
  const router = useRouter();
  const { push } = useToast();
  const [contacts, setContacts] = React.useState<Person[] | null>(null);
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Person[]>([]);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api<{ users: Person[] }>("/api/social/people?list=contacts")
      .then((d) => setContacts(d.users))
      .catch(() => setContacts([]));
  }, []);

  React.useEffect(() => {
    load();
    const iv = window.setInterval(load, 10000);
    return () => window.clearInterval(iv);
  }, [load]);

  const search = React.useCallback(async () => {
    if (q.trim().length < 3) return;
    setBusy(true);
    try {
      const d = await api<{ users: Person[] }>(`/api/social/people?q=${encodeURIComponent(q.trim())}`);
      setResults(d.users);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }, [q]);

  const dm = async (userId: string) => {
    try {
      const d = await api<{ conversation: { id: string } }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ targetId: userId }),
      });
      router.push(`/chats/${d.conversation.id}`);
    } catch (e) {
      push({ message: (e as Error).message ?? "Cannot start chat", tone: "error" });
    }
  };

  const addContact = async (userId: string) => {
    try {
      await api("/api/social/people", { method: "POST", body: JSON.stringify({ action: "add", userId }) });
      push({ message: "Contact added", tone: "success" });
      load();
    } catch (e) {
      push({ message: (e as Error).message ?? "Failed", tone: "error" });
    }
  };

  const invite = async () => {
    const link = `${window.location.origin}/register`;
    try {
      await navigator.clipboard.writeText(link);
      push({ message: "Invite link copied", tone: "success" });
    } catch {
      push({ message: `Invite friends: ${link}`, tone: "info" });
    }
  };

  const Row = ({ p }: { p: Person }) => (
    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar username={p.displayName ?? p.username} src={p.image} size={42} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{p.displayName ?? p.username}</p>
          <p className="text-xs text-slate-500">
            @{p.username}
            {p.online ? " · online" : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button size="xs" variant="outline" onClick={() => void dm(p.id)}>
          Message
        </Button>
        <Button size="xs" variant="ghost" onClick={() => void addContact(p.id)} aria-label={`Add ${p.username} to contacts`}>
          <UserPlus size={14} />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-24">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">Contacts</h1>
          <p className="text-xs text-slate-500">People you know on DARKNOTE</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void invite()}>
          <Share2 size={15} className="mr-1" /> Invite
        </Button>
      </div>

      {/* search */}
      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Search by username or display name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void search()}
        />
        <Button onClick={() => void search()} disabled={busy || q.trim().length < 3}>
          <Search size={16} />
        </Button>
      </div>
      {results.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Search results</p>
          {results.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </div>
      )}

      {contacts === null ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading contacts…</p>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          message="Search for someone by username to message them, then add them as a contact."
        />
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">My contacts</p>
          {contacts.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
