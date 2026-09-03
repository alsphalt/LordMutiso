"use client";

import * as React from "react";
import { Trophy, Medal, Search, RefreshCw } from "lucide-react";
import { useApiPoll } from "@/hooks/api";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { GameTypeName, GAME_TYPE_LIST } from "@/lib/constants";

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = React.useState<string>("OVERALL");
  const { data, loading, refresh } = useApiPoll<{ rows: any[] }>(
    `/api/leaderboard?game=${activeTab}`,
    30000
  );

  const tabs = [
    { id: "OVERALL", label: "Overall" },
    ...GAME_TYPE_LIST.map(type => ({ id: type, label: type }))
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tight text-white uppercase">Hall of Fame</h1>
          <p className="text-slate-500 font-medium">Top ranking players in the arena</p>
        </div>
        <div className="flex gap-4">
          <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
          <Button variant="ghost" size="sm" onClick={() => refresh()} className="text-slate-500">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </header>

      <div className="glass overflow-hidden border-white/5 shadow-2xl">
        <LeaderboardTable 
          rows={data?.rows || []} 
          loading={loading && !data} 
          gameType={activeTab}
        />
      </div>
    </div>
  );
}
