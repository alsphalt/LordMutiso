import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-arena-gradient text-center">
      <Logo size="lg" className="mb-12" />
      
      <h1 className="text-8xl font-black italic tracking-tighter text-white drop-shadow-glow">404</h1>
      <h2 className="text-3xl font-bold uppercase italic tracking-widest text-gradient mt-2">Zone Not Found</h2>
      
      <p className="mt-6 text-slate-400 max-w-md mx-auto leading-relaxed">
        The arena you are looking for does not exist or has been moved to a different dimension.
      </p>

      <div className="mt-12">
        <Link href="/">
          <Button size="lg" className="h-16 px-10 italic font-black tracking-widest gap-3">
            <Home size={20} /> BACK TO BASE
          </Button>
        </Link>
      </div>
    </div>
  );
}
