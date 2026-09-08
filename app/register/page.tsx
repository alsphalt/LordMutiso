"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Lock, Mail, Search, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/hooks/api";
import { useToast } from "@/components/ui/toast";
import { COUNTRIES, flagEmoji, countryName } from "@/lib/countries";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { push } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({ username: "", email: "", password: "", country: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [countryOpen, setCountryOpen] = React.useState(false);
  const [countryQuery, setCountryQuery] = React.useState("");

  const filteredCountries = React.useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [countryQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (formData.password.length < 8) {
      setErrors({ password: "Password must be at least 8 characters" });
      return;
    }
    if (!formData.country) {
      setErrors({ country: "Select your country to continue" });
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

            {/* ---------- Select your country ---------- */}
            <div>
              <p className="mb-2 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Select your country</span>
                {errors.country && <span className="text-xs font-medium text-rose-400">{errors.country}</span>}
              </p>
              <button
                type="button"
                onClick={() => setCountryOpen((v) => !v)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border bg-white/[0.03] px-4 py-3.5 text-left transition-colors ${
                  countryOpen ? "border-arena-purple/60" : formData.country ? "border-emerald-500/40" : "border-white/10"
                } ${errors.country ? "border-rose-400/60" : ""}`}
              >
                <span className="flex items-center gap-3">
                  {formData.country ? (
                    <>
                      <span className="text-xl leading-none">{flagEmoji(formData.country)}</span>
                      <span className="font-bold text-white">{countryName(formData.country) || formData.country}</span>
                    </>
                  ) : (
                    <span className="text-slate-500 font-medium">Search your country…</span>
                  )}
                </span>
                <ChevronDown size={16} className={`text-slate-500 transition-transform ${countryOpen ? "rotate-180" : ""}`} />
              </button>

              {countryOpen && (
                <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  <div className="relative border-b border-white/10">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                    <input
                      autoFocus
                      value={countryQuery}
                      onChange={(e) => setCountryQuery(e.target.value)}
                      placeholder="Search country"
                      className="w-full bg-transparent py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 outline-none"
                    />
                  </div>
                  <ul className="max-h-64 overflow-y-auto custom-scrollbar py-1">
                    {filteredCountries.map((c) => {
                      const selected = formData.country === c.code;
                      return (
                        <li key={c.code}>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((f) => ({ ...f, country: c.code }));
                              setCountryOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              selected ? "bg-arena-purple/15 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span className="text-lg leading-none">{flagEmoji(c.code)}</span>
                            <span className="flex-1 text-sm font-semibold">{c.name}</span>
                            {selected && <Check size={16} className="text-arena-purple" />}
                          </button>
                        </li>
                      );
                    })}
                    {filteredCountries.length === 0 && (
                      <li className="px-4 py-6 text-center text-sm text-slate-500">No countries match “{countryQuery}”</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

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
