"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/hooks/api";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { push } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({ identifier: "", password: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      await refresh();
      push({ title: "Welcome back!", message: "Successfully logged in", tone: "success" });
      router.replace("/");
    } catch (err: any) {
      setErrors({ form: err.message });
      push({ title: "Login failed", message: err.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-20">
      <div className="w-full max-w-md animate-pop-in">
        <div className="flex flex-col items-center mb-10">
          <Link href="/">
            <Logo size="lg" className="mb-4" />
          </Link>
          <p className="text-slate-500 font-medium">Log in to enter the arena</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field label="Email or Username" error={errors.identifier}>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <Input
                  className="pl-11"
                  placeholder="Enter your email or username"
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>
            </Field>

            <Field label="Password" error={errors.password}>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <Input
                  type="password"
                  className="pl-11"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>
            </Field>

            {errors.form && (
              <p className="text-sm text-rose-400 text-center font-medium bg-rose-400/10 py-3 rounded-xl border border-rose-400/20">
                {errors.form}
              </p>
            )}

            <Button type="submit" full loading={loading} className="h-12 italic font-black tracking-widest gap-2">
              LOG IN <ArrowRight size={18} />
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-arena-blue font-bold hover:underline">
                Join the Arena
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
