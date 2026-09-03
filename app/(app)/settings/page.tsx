"use client";

import * as React from "react";
import { Settings as SettingsIcon, Save, Shield, User as UserIcon, Camera, Lock } from "lucide-react";
import { api } from "@/hooks/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const { push } = useToast();
  const [loading, setLoading] = React.useState(false);
  
  const [profile, setProfile] = React.useState({
    username: "",
    image: "",
  });

  const [password, setPassword] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  React.useEffect(() => {
    if (user) {
      setProfile({
        username: user.username,
        image: user.image || "",
      });
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(profile),
      });
      await refresh();
      push({ title: "Profile Updated", message: "Your changes have been saved", tone: "success" });
    } catch (err: any) {
      push({ title: "Update Failed", message: err.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      push({ title: "Error", message: "New passwords do not match", tone: "error" });
      return;
    }

    setLoading(true);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: password.currentPassword,
          newPassword: password.newPassword,
        }),
      });
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
      push({ title: "Password Changed", message: "Security updated successfully", tone: "success" });
    } catch (err: any) {
      push({ title: "Update Failed", message: err.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-black italic tracking-tight text-white uppercase">Settings</h1>
        <p className="text-slate-500 font-medium">Manage your account and preferences</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="md:col-span-1 space-y-4">
          <Card className="p-6 flex flex-col items-center text-center">
            <div className="relative group">
              <Avatar username={profile.username || "user"} src={profile.image} size={120} />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center cursor-pointer">
                <Camera className="text-white" size={24} />
              </div>
            </div>
            <h3 className="mt-4 font-bold text-white text-lg">{user?.username}</h3>
            <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-1">Arena Combatant</p>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-8">
          {/* Profile Section */}
          <Card className="p-8">
            <h2 className="text-lg font-bold uppercase italic tracking-widest text-white mb-6 flex items-center gap-3">
              <UserIcon size={18} className="text-arena-blue" />
              Public Profile
            </h2>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <Field label="Username" hint="Changing this will update your profile URL">
                <Input 
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  placeholder="Username"
                  disabled={loading}
                  required
                />
              </Field>
              
              <Field label="Avatar URL" hint="Direct link to a public image (JPG, PNG, SVG)">
                <Input 
                  value={profile.image}
                  onChange={(e) => setProfile({ ...profile, image: e.target.value })}
                  placeholder="https://example.com/avatar.png"
                  disabled={loading}
                />
              </Field>

              <div className="pt-2">
                <Button type="submit" loading={loading} className="italic font-black tracking-widest uppercase gap-2">
                  <Save size={16} /> SAVE CHANGES
                </Button>
              </div>
            </form>
          </Card>

          {/* Security Section */}
          <Card className="p-8">
            <h2 className="text-lg font-bold uppercase italic tracking-widest text-white mb-6 flex items-center gap-3">
              <Shield size={18} className="text-rose-500" />
              Security
            </h2>
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <Field label="Current Password">
                <Input 
                  type="password"
                  value={password.currentPassword}
                  onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })}
                  placeholder="••••••••"
                  disabled={loading}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="New Password">
                  <Input 
                    type="password"
                    value={password.newPassword}
                    onChange={(e) => setPassword({ ...password, newPassword: e.target.value })}
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </Field>
                <Field label="Confirm New Password">
                  <Input 
                    type="password"
                    value={password.confirmPassword}
                    onChange={(e) => setPassword({ ...password, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </Field>
              </div>

              <div className="pt-2">
                <Button type="submit" loading={loading} variant="secondary" className="italic font-black tracking-widest uppercase gap-2">
                  <Lock size={16} className="w-4 h-4" /> CHANGE PASSWORD
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
