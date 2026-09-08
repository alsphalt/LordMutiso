"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  LogIn,
  RefreshCw,
  Gamepad2,
  Users,
  MessagesSquare,
  ChevronRight,
  Bot,
  Play,
  Swords,
} from "lucide-react";
import { api, useApiPoll } from "@/hooks/api";
import { useAuth } from "@/hooks/use-auth";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { RoomList } from "@/components/lobby/room-list";
import { JoinDialog } from "@/components/lobby/join-dialog";
import { CreateDialog } from "@/components/lobby/create-dialog";
import { GameModeDialog } from "@/components/games/game-mode-dialog";
import { GAME_TYPE_LIST, GAME_TYPES } from "@/lib/constants";
import { flagFor } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface ArenaTile {
  id: string;
  emoji: string;
  title: string;
  tagline: string;
  type?: string; // set when playable (game type)
  comingSoon?: boolean;
  accent: string;
}

const PLAYABLE_TILES: ArenaTile[] = GAME_TYPE_LIST.map((type) => {
  const meta = GAME_TYPES[type];
  return {
    id: type,
    emoji: meta?.emoji ?? "🎮",
    title: meta?.label ?? type,
    tagline: meta?.tagline ?? "Play online or vs AI",
    type,
    accent: type === "LUDO" ? "from-emerald-500/25 to-emerald-500/5 border-emerald-500/25" : type === "CHESS" ? "from-slate-400/20 to-slate-400/5 border-slate-300/20" : "from-amber-500/20 to-amber-500/5 border-amber-500/25",
  };
});

const SOON_TILES: ArenaTile[] = [
  { id: "TICTACTOE", emoji: "⭕", title: "Tic Tac Toe", tagline: "Quick classic duel", comingSoon: true, accent: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20" },
  { id: "COLOR", emoji: "🌈", title: "Color Game", tagline: "Match & clear colors", comingSoon: true, accent: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/20" },
  { id: "MORE", emoji: "🎁", title: "More Games", tagline: "New titles landing soon", comingSoon: true, accent: "from-arena-purple/20 to-arena-purple/5 border-arena-purple/25" },
];

export default function ArenaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { push } = useToast();
  const [activeTab, setActiveTab] = React.useState<string>("LUDO");
  const [showJoin, setShowJoin] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [showAiDialog, setShowAiDialog] = React.useState(false);

  const { data: roomsData, loading: roomsLoading, refresh: refreshRooms } = useApiPoll<{ rooms: any[] }>(
    `/api/rooms?type=${activeTab}`,
    4000
  );
  const { data: onlineData } = useApiPoll<{ count: number; users: any[] }>("/api/online", 15000);
  const onlineUsers = (onlineData?.users || []).filter((u: any) => u?.username !== user?.username);

  const openPlay = (tile: ArenaTile) => {
    if (tile.comingSoon || !tile.type) {
      push({ title: "Coming soon", message: `${tile.title} is on its way to the Arena.`, tone: "info" });
      return;
    }
    setActiveTab(tile.type);
    setShowAiDialog(true); // play vs AI, quick match or private room
  };

  const messagePlayer = async (username: string) => {
    try {
      const res: any = await api("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      if (res?.conversation?.id) router.push(`/chats/${res.conversation.id}`);
      else router.push("/chats");
    } catch (e: any) {
      push({ title: "Message", message: e?.message || "Could not open a chat", tone: "error" });
    }
  };

  const tabs = GAME_TYPE_LIST.map((type) => ({ id: type, label: type }));

  return (
    <div className="animate-fade-in space-y-10">
      {/* ============ HERO — DARKNOTE ARENA ============ */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-arena-purple/25 via-white/[0.03] to-cyan-500/10 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-arena-purple/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-arena-purple/40 bg-arena-purple/20 text-arena-purple shadow-glow">
                <Gamepad2 size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-arena-purple">Gaming · Community</p>
                <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tight text-white">
                  Darknote Arena
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {onlineData?.count ?? 0} online
            </div>
          </div>

          <div>
            <p className="text-xl sm:text-2xl font-black italic uppercase text-white/90">
              Welcome to <span className="text-gradient">Darknote Arena</span>
            </p>
            <p className="mt-1 text-sm text-slate-400">Find players, chat, and play.</p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button variant="primary" onClick={() => setShowCreate(true)} className="gap-2 italic font-black uppercase tracking-widest text-xs shadow-glow">
              <Swords size={15} /> New Match
            </Button>
            <Button variant="secondary" onClick={() => setShowJoin(true)} className="gap-2 italic font-black uppercase tracking-widest text-xs">
              <LogIn size={15} /> Join by Code
            </Button>
            <Button variant="outline" onClick={() => setShowAiDialog(true)} className="gap-2 italic font-black uppercase tracking-widest text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
              <Bot size={15} /> Play vs AI
            </Button>
            <Link href="/chat">
              <Button variant="ghost" className="gap-2 italic font-black uppercase tracking-widest text-xs text-slate-300">
                <MessagesSquare size={15} /> Arena Chat
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ GAME HUB ============ */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="h-5 w-1 rounded-full bg-arena-purple shadow-glow" />
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Play Now</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {[...PLAYABLE_TILES, ...SOON_TILES].map((tile) => (
            <button
              key={tile.id}
              onClick={() => openPlay(tile)}
              className={cn(
                "group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]",
                tile.accent
              )}
            >
              <span className="text-3xl sm:text-4xl drop-shadow-[0_0_12px_rgba(139,92,246,0.35)]">{tile.emoji}</span>
              <span className="flex w-full items-center justify-between">
                <span className="font-black uppercase italic tracking-wide text-white text-sm sm:text-base">{tile.title}</span>
                <ChevronRight size={16} className="text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
              </span>
              <span className="text-[11px] text-slate-400">
                {tile.comingSoon ? "Coming soon to the Arena" : tile.tagline}
              </span>
              {!tile.comingSoon && (
                <span className="mt-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  <Play size={10} className="fill-emerald-400" /> Play
                </span>
              )}
              {tile.comingSoon && <Badge tone="purple" className="mt-1 text-[9px] px-2 h-4 uppercase tracking-widest">Soon</Badge>}
            </button>
          ))}
        </div>
      </section>

      {/* ============ ONLINE PLAYERS ============ */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-emerald-400" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Online Players</h2>
          </div>
          <Link href="/leaderboard" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
            Rankings →
          </Link>
        </div>

        {!onlineData && (
          <div className="glass flex items-center justify-center gap-3 py-8 text-slate-500 text-sm">
            <Spinner size={18} /> Finding players…
          </div>
        )}
        {onlineData && onlineUsers.length === 0 && (
          <EmptyState
            icon={Users}
            title="No players online"
            message="Be the first — start a match or invite a friend."
            action={
              <Button variant="primary" onClick={() => setShowCreate(true)} className="italic font-black uppercase tracking-widest text-xs shadow-glow">
                <Plus size={15} /> Create a Match
              </Button>
            }
          />
        )}
        {onlineUsers.length > 0 && (
          <div className="glass divide-y divide-white/5 overflow-hidden">
            {onlineUsers.map((u: any) => (
              <div key={u.username} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-white/5">
                <Link href={`/u/${u.username}`} className="shrink-0">
                  <div className="relative">
                    <Avatar username={u.username} src={u.image} size={44} className="ring-2 ring-white/10" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-arena-900 bg-emerald-500" />
                  </div>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${u.username}`} className="flex items-center gap-1.5">
                    <span className="truncate font-bold text-white text-sm">{u.username}</span>
                    {u.country && <span title={u.country}>{flagFor(u.country)}</span>}
                  </Link>
                  <p className="truncate text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">
                    {u.activity ?? "Online"} · Available to play
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="xs" variant="ghost" onClick={() => messagePlayer(u.username)} className="text-slate-300 gap-1.5">
                    <MessagesSquare size={13} /> Message
                  </Button>
                  <Link href={`/u/${u.username}`}>
                    <Button size="xs" variant="outline" className="gap-1.5">Profile</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ LIVE TABLES ============ */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-cyan-400" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Live Tables</h2>
          </div>
          <div className="flex items-center gap-3">
            <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} className="w-full sm:w-auto" />
            <Button variant="ghost" size="sm" onClick={() => refreshRooms()} className="text-slate-500 gap-2">
              <RefreshCw size={14} className={roomsLoading ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
        </div>

        <RoomList rooms={roomsData?.rooms || []} loading={roomsLoading && !roomsData} onJoin={(room) => router.push(`/play/${room.gameId}`)} />
      </section>

      {/* ============ ARENA COMMUNITY ============ */}
      <section className="relative overflow-hidden rounded-3xl border border-arena-purple/25 bg-gradient-to-r from-arena-purple/15 via-white/[0.03] to-transparent p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-arena-purple/40 bg-arena-purple/15 text-arena-purple">
              <MessagesSquare size={22} />
            </div>
            <div>
              <h2 className="font-black uppercase italic tracking-wider text-white">Arena Community</h2>
              <p className="mt-0.5 text-sm text-slate-400 max-w-md">
                Players meet here — chat, hype up matches and find your next opponent.
              </p>
            </div>
          </div>
          <Link href="/chat">
            <Button variant="primary" className="gap-2 italic font-black uppercase tracking-widest text-xs shadow-glow">
              Open Community Chat
            </Button>
          </Link>
        </div>
      </section>

      <JoinDialog open={showJoin} onClose={() => setShowJoin(false)} />
      <CreateDialog open={showCreate} onClose={() => setShowCreate(false)} activeType={(activeTab as any) || "LUDO"} />
      <GameModeDialog open={showAiDialog} onClose={() => setShowAiDialog(false)} type={(activeTab as any) || "LUDO"} />
    </div>
  );
}
