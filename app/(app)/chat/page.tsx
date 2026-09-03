"use client";

import { ChatWidget } from "@/components/chat/chat-widget";

export default function GlobalChatPage() {
  return (
    <div className="animate-fade-in space-y-8">
      <header>
        <h1 className="text-3xl font-black italic tracking-tight text-white uppercase">Global Chat</h1>
        <p className="text-slate-500 font-medium">Connect with the community and find opponents</p>
      </header>

      <ChatWidget maxHeight="calc(100vh - 200px)" className="h-[700px] border-white/5" />
    </div>
  );
}
