"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Gamepad2, 
  MessageSquare, 
  MessagesSquare, 
  Sparkles, 
  Trophy, 
  History, 
  Settings, 
  LogOut, 
  Bell, 
  User as UserIcon,
  ChevronDown
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useApiPoll } from "@/hooks/api";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, fmtDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { api } from "@/hooks/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  gameId?: string;
  read: boolean;
  createdAt: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPlayPage = pathname.startsWith("/play/");
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const { push } = useToast();

  const { data: onlineData } = useApiPoll<{ count: number; users: any[] }>("/api/online", 15000, { enabled: !!user });
  const { data: notifData, refresh: refreshNotifs } = useApiPoll<{ items: Notification[]; unread: number }>("/api/notifications", 12000, { enabled: !!user });

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setShowUserMenu(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifications(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api("/api/notifications/read", { method: "POST", body: JSON.stringify({}) });
      refreshNotifs();
    } catch (err) {}
  };

  if (isPlayPage) return <>{children}</>;

  const navItems = [
    { label: "Arena", href: "/lobby", icon: Gamepad2 },
    { label: "Chats", href: "/chats", icon: MessagesSquare },
    { label: "Updates", href: "/updates", icon: Sparkles },
    { label: "Arena Chat", href: "/chat", icon: MessageSquare },
    { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { label: "History", href: "/history", icon: History },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Desktop Header */}
      <header className="sticky top-0 z-40 w-full glass border-x-0 border-t-0 rounded-none h-16 px-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:text-white",
                  pathname === item.href ? "bg-white/10 text-white" : "text-slate-400"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Games — the single entrance to DARKNOTE ARENA */}
          <Link
            href="/lobby"
            aria-label="Arena — play games"
            title="Arena"
            className="group relative flex h-9 w-9 items-center justify-center rounded-xl border border-arena-purple/40 bg-arena-purple/15 text-arena-purple transition-all hover:bg-arena-purple/25 hover:shadow-[0_0_18px_rgba(139,92,246,0.55)] active:scale-90 sm:h-10 sm:w-10"
          >
            <Gamepad2 size={20} className="transition-colors group-hover:text-white" />
          </Link>

          {onlineData && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {onlineData.count} online
            </div>
          )}

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) handleMarkAllRead();
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors relative"
            >
              <Bell size={20} />
              {notifData && notifData.unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center rounded-full border-2 border-arena-900">
                  {notifData.unread}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 glass-strong shadow-2xl animate-pop-in overflow-hidden z-50">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-bold">Notifications</h3>
                  {notifData && notifData.unread > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-arena-blue hover:underline">Mark all read</button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  {!notifData?.items.length ? (
                    <div className="p-8 text-center text-slate-500 text-sm">No notifications</div>
                  ) : (
                    notifData.items.map((n) => (
                      <Link 
                        key={n.id} 
                        href={n.gameId ? `/play/${n.gameId}` : "#"}
                        onClick={() => setShowNotifications(false)}
                        className={cn(
                          "block p-4 border-b border-white/5 hover:bg-white/5 transition-colors",
                          !n.read && "bg-white/[0.02]"
                        )}
                      >
                        <p className="text-sm font-bold text-white">{n.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-slate-500 mt-2 uppercase">{fmtDate(n.createdAt)}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
            >
              <Avatar username={user?.username || "user"} src={user?.image} size={32} />
              <ChevronDown size={14} className={cn("text-slate-500 transition-transform", showUserMenu && "rotate-180")} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 glass-strong shadow-2xl animate-pop-in py-1 z-50">
                <div className="px-4 py-2 border-b border-white/10 mb-1">
                  <p className="text-sm font-bold truncate">{user?.username}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                </div>
                <Link href={`/u/${user?.username}`} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5" onClick={() => setShowUserMenu(false)}>
                  <UserIcon size={16} /> Profile
                </Link>
                <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5" onClick={() => setShowUserMenu(false)}>
                  <Settings size={16} /> Settings
                </Link>
                <button 
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1">
        {children}
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 glass border-x-0 border-b-0 rounded-none z-40 px-5 flex items-center justify-between">
        <Link href="/chats" className={cn("flex flex-col items-center gap-1", pathname.startsWith("/chats") ? "text-arena-blue" : "text-slate-500")}>
          <MessagesSquare size={20} />
          <span className="text-[10px] font-bold uppercase">Chats</span>
        </Link>
        <Link href="/updates" className={cn("flex flex-col items-center gap-1", pathname === "/updates" ? "text-arena-blue" : "text-slate-500")}>
          <Sparkles size={20} />
          <span className="text-[10px] font-bold uppercase">Updates</span>
        </Link>
        <Link href="/chat" className={cn("flex flex-col items-center gap-1", pathname === "/chat" ? "text-arena-blue" : "text-slate-500")}>
          <MessageSquare size={20} />
          <span className="text-[10px] font-bold uppercase">Community</span>
        </Link>
        <Link href={`/u/${user?.username}`} className={cn("flex flex-col items-center gap-1", pathname.startsWith("/u/") ? "text-arena-blue" : "text-slate-500")}>
          <UserIcon size={20} />
          <span className="text-[10px] font-bold uppercase">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
