"use client";

import { useParams } from "next/navigation";
import { GameShell } from "@/components/games/game-shell";

export default function PlayPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  if (!gameId) return null;

  return <GameShell gameId={gameId} />;
}
