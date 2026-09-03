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

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { push } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({ username: "", email: "", password: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (formData.password.length < 8) {
      setErrors({ password: "Password must be at least 8 characters" });
      return;
    }

    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      await refresh();
      push({ title: "Welcome to the Arena!", message: "Account created successfully", tone: "success" });
      router.replace("/");
    } catch (err: any) {
      setErrors({ form: err.message });
      push({ title: "Registration failed", message: err.message, tone: "error" });
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
          <p className="text-slate-500 font-medium">Create your account to start playing</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field label="Username" error={errors.username} hint="3-20 characters, letters/numbers only">
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <Input
                  className="pl-11"
                  placeholder="Choose a username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>
            </Field>

            <Field label="Email" error={errors.email}>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <Input
                  type="email"
                  className="pl-11"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                  placeholder="Min. 8 characters"
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
              CREATE ACCOUNT <ArrowRight size={18} />
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="text-arena-blue font-bold hover:underline">
                Log In
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
