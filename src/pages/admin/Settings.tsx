import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Settings as SettingsIcon } from "lucide-react";
import { getSiteSettings, updateSiteSettings } from "@/services/settingsService";
import { logActivity } from "@/services/activityService";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useToast } from "@/hooks/use-toast";
import type { SiteSettings, VideoVisibility } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorState from "@/components/ErrorState";

export default function AdminSettings() {
  const { toast } = useToast();
  const { refresh } = useSiteSettings();

  const [form, setForm] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getSiteSettings()
      .then((s) => mounted && setForm(s))
      .catch((err: unknown) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Please check your connection and try again.";
        console.error("[StreamVault] Failed to load site settings:", message);
        setError(message);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await updateSiteSettings({
        site_name: form.site_name,
        logo_url: form.logo_url,
        favicon_url: form.favicon_url,
        description: form.description,
        default_theme: form.default_theme,
        maintenance_mode: form.maintenance_mode,
        allow_signup: form.allow_signup,
        default_video_visibility: form.default_video_visibility,
        enable_analytics: form.enable_analytics,
        enable_adsense: form.enable_adsense,
      });
      await logActivity("settings.updated", {
        targetType: "settings",
        details: {
          maintenance_mode: form.maintenance_mode,
          allow_signup: form.allow_signup,
        },
      });
      await refresh();
      toast({ title: "Settings saved" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not save settings",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Website Settings</h1>
        <ErrorState message={error} onRetry={() => setReloadKey((n) => n + 1)} />
      </div>
    );
  }

  if (loading || !form) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Website Settings</h1>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Website Settings</h1>
        <p className="text-muted-foreground">Global configuration for the public site.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SettingsIcon className="h-4 w-4" /> Identity
            </CardTitle>
            <CardDescription>How the platform presents itself.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site-name">Website Name</Label>
              <Input
                id="site-name"
                value={form.site_name}
                onChange={(e) => set("site_name", e.target.value)}
                disabled={saving}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-desc">Website Description</Label>
              <Textarea
                id="site-desc"
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo-url">Logo URL</Label>
              <Input
                id="logo-url"
                value={form.logo_url ?? ""}
                onChange={(e) => set("logo_url", e.target.value)}
                placeholder="https://..."
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="favicon-url">Favicon URL</Label>
              <Input
                id="favicon-url"
                value={form.favicon_url ?? ""}
                onChange={(e) => set("favicon_url", e.target.value)}
                placeholder="https://..."
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Behaviour</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default Theme</Label>
                <Select
                  value={form.default_theme}
                  onValueChange={(v) => set("default_theme", v as "dark" | "light")}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Video Visibility</Label>
                <Select
                  value={form.default_video_visibility}
                  onValueChange={(v) => set("default_video_visibility", v as VideoVisibility)}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="preview">Preview</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {[
              ["maintenance_mode", "Maintenance mode", "Show a maintenance notice to non-admins."],
              ["allow_signup", "Allow user signup", "Let new visitors create accounts."],
              ["enable_analytics", "Enable Analytics", "Master switch for Google Analytics."],
              ["enable_adsense", "Enable AdSense", "Master switch for ads."],
            ].map(([key, label, help]) => (
              <div key={key} className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
                <div>
                  <Label htmlFor={key} className="cursor-pointer">
                    {label}
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>
                </div>
                <Switch
                  id={key}
                  checked={form[key as keyof SiteSettings] as boolean}
                  onCheckedChange={(v) => set(key as keyof SiteSettings, v as never)}
                  disabled={saving}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </form>
    </div>
  );
}
