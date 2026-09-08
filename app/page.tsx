"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * "/" — DARKNOTE home.
 *  - Guests: premium landing page.
 *  - Signed-in users: the main Darknote social experience. Games no longer
 *    live here — they were moved into the Arena (reachable via the 🎮 game
 *    button in the top-right of the app shell). Home redirects to the social
 *    hub (chats/updates) so there is never an empty area or game cards.
 */
export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const authed = !!user;

  // Signed-in users go straight to the social home (/chats shows the main
  // Darknote experience — chats, updates strip, contacts).
  React.useEffect(() => {
    if (!authLoading && authed) {
      router.replace("/chats");
    }
  }, [authLoading, authed, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (authed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Hero Section */}
      <main className="relative z-10 pt-20 pb-32 px-4 flex flex-col items-center">
        <div className="animate-pop-in flex flex-col items-center text-center max-w-4xl">
          <Logo size="lg" className="mb-8" />
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none text-white italic uppercase">
            Battle for <span className="text-gradient">Glory</span> <br />
            in the Digital Arena
          </h1>
          <p className="mt-6 text-xl text-slate-400 max-w-2xl leading-relaxed">
            Multiplayer Ludo, Chess, and Checkers. Real-time competition,{" "}
            global leaderboards, and a premium gaming experience.
          </p>

          <div className="mt-12 flex flex-wrap justify-center gap-6">
            <Link href="/register">
              <Button size="lg" className="h-16 px-10 text-lg italic font-black tracking-widest gap-3">
                JOIN THE ARENA <ArrowRight size={20} />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="h-16 px-10 text-lg italic font-black tracking-widest">
                LOG IN
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Decorative background elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[800px] pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,#8b5cf6_0%,transparent_70%)]" />
      </div>
    </div>
  );
}
