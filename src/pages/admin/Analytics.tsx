import { useEffect, useState, type FormEvent } from "react";
import { BarChart3, Eye, Loader2, Shield, Users, Video } from "lucide-react";
import {
  getDashboardStats,
  getTopViewedVideos,
  type DashboardStats,
} from "@/services/analyticsService";
import {
  getAnalyticsSettings,
  isValidMeasurementId,
  updateAnalyticsSettings,
} from "@/services/settingsService";
import { logActivity } from "@/services/activityService";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useToast } from "@/hooks/use-toast";
import { formatViews } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import ErrorState from "@/components/ErrorState";

interface TopVideo {
  id: string;
  title: string;
  views_count: number;
  thumbnail_url: string | null;
}

export default function AdminAnalytics() {
  const { toast } = useToast();
  const { refresh } = useSiteSettings();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topVideos, setTopVideos] = useState<TopVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [measurementId, setMeasurementId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([getDashboardStats(), getTopViewedVideos(10), getAnalyticsSettings()])
      .then(([s, top, settings]) => {
        if (!mounted) return;
        setStats(s);
        setTopVideos(top);
        setMeasurementId(settings?.ga_measurement_id ?? "");
        setEnabled(settings?.enabled ?? false);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Please check your connection and try again.";
        console.error("[StreamVault] Failed to load analytics:", message);
        setError(message);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setIdError(null);

    const trimmed = measurementId.trim();
    if (trimmed && !isValidMeasurementId(trimmed)) {
      setIdError("Measurement ID must look like G-XXXXXXXXXX.");
      return;
    }
    if (enabled && !trimmed) {
      setIdError("Add a measurement ID before enabling Google Analytics.");
      return;
    }

    setSaving(true);
    try {
      await updateAnalyticsSettings({
        ga_measurement_id: trimmed || null,
        enabled,
      });
      await logActivity("analytics.updated", {
        targetType: "settings",
        details: { enabled, configured: !!trimmed },
      });
      await refresh();
      toast({
        title: "Analytics settings saved",
        description: enabled
          ? "Google Analytics will load on the next page load."
          : "Google Analytics is disabled and will not load.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not save analytics settings",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  const maxViews = Math.max(1, ...topVideos.map((v) => v.views_count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Platform metrics from your own database, plus Google Analytics configuration.
        </p>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((n) => n + 1)} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Users", value: stats?.totalUsers, icon: Users },
              { label: "Total Managers", value: stats?.totalManagers, icon: Shield },
              { label: "Total Videos", value: stats?.totalVideos, icon: Video },
              { label: "Total Views", value: stats?.totalViews, icon: Eye },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    {loading ? (
                      <Skeleton className="mt-2 h-7 w-16" />
                    ) : (
                      <p className="mt-1 text-2xl font-bold">{(item.value ?? 0).toLocaleString()}</p>
                    )}
                  </div>
                  <item.icon className="h-7 w-7 text-primary" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" /> Google Analytics 4
              </CardTitle>
              <CardDescription>
                Paste your GA4 measurement ID. The tag loads only when a valid ID is saved and
                analytics is switched on — leave it off and nothing is sent to Google.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ga-id">Measurement ID</Label>
                  <Input
                    id="ga-id"
                    value={measurementId}
                    onChange={(e) => setMeasurementId(e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                    className="font-mono"
                    disabled={loading || saving}
                  />
                  {idError && <p className="text-sm text-destructive">{idError}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="ga-enabled"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                    disabled={loading || saving}
                  />
                  <Label htmlFor="ga-enabled" className="cursor-pointer font-normal">
                    Enable Google Analytics
                  </Label>
                </div>

                <p className="text-xs text-muted-foreground">
                  Tracked events: page_view, video_play, video_progress, video_complete, search,
                  login, sign_up. No passwords, keys, or personal details are ever sent.
                </p>

                <Button type="submit" disabled={loading || saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Analytics Settings
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 Viewed Videos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              ) : topVideos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No view data yet.</p>
              ) : (
                topVideos.map((v) => (
                  <div key={v.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="line-clamp-1 font-medium">{v.title}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatViews(v.views_count)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(v.views_count / maxViews) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
