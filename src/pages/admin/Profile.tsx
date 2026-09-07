import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { updateOwnProfile } from "@/services/userService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AdminProfile() {
  const { user, profile, refreshProfile, updatePassword } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateOwnProfile(user.id, {
        full_name: fullName,
        avatar_url: avatarUrl.trim() || null,
      });
      await refreshProfile();
      toast({ title: "Profile updated" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setPasswordError("Use at least 8 characters for an administrator account.");
      return;
    }

    setSavingPassword(true);
    // Goes through Supabase Auth — the password is never written to, or
    // read from, any application table.
    const { error } = await updatePassword(password);
    setSavingPassword(false);

    if (error) {
      setPasswordError(error);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    toast({
      title: "Password updated",
      description: "Your administrator password has been changed.",
    });
  }

  const initial = (profile?.full_name || profile?.email || "A").charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Profile</h1>
        <p className="text-muted-foreground">Your administrator account.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xl">{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="truncate">{profile?.full_name || "Administrator"}</CardTitle>
              <CardDescription className="truncate">{profile?.email}</CardDescription>
              <Badge className="mt-1 gap-1">
                <ShieldCheck className="h-3 w-3" />
                Super Admin
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Full Name</Label>
              <Input
                id="admin-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={savingProfile}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-avatar">Avatar URL</Label>
              <Input
                id="admin-avatar"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                disabled={savingProfile}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email-ro">Email</Label>
              <Input id="admin-email-ro" value={profile?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-created">Account Created</Label>
              <Input
                id="admin-created"
                value={
                  profile?.created_at ? new Date(profile.created_at).toLocaleString() : "—"
                }
                disabled
              />
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Profile
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Change Password
          </CardTitle>
          <CardDescription>
            If you are still using the documented bootstrap password, change it now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pw">New Password</Label>
              <Input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={savingPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <Input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={savingPassword}
              />
            </div>
            {passwordError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {passwordError}
              </div>
            )}
            <Button type="submit" disabled={savingPassword}>
              {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
