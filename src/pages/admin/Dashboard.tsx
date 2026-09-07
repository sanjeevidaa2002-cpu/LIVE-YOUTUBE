import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Eye,
  FileVideo,
  Flame,
  Globe,
  Info,
  Lock,
  Shield,
  Sparkles,
  UploadCloud,
  UserPlus,
  Users,
  Video as VideoIcon,
} from "lucide-react";
import {
  countViewsSince,
  getDashboardStats,
  getLatestVideo,
  getMostViewedVideo,
  getRecentUsers,
  getRecentVideos,
  getTopViewedVideos,
  type DashboardStats,
} from "@/services/analyticsService";
import { countVideosSince, getVideoStatusSummary } from "@/services/videoService";
import { countUsersSince } from "@/services/userService";
import { getAnalyticsSettings, getAdsenseSettings } from "@/services/settingsService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import ErrorState from "@/components/ErrorState";
import { formatRelativeDate, formatViews } from "@/lib/utils";
import VisibilityBadge from "@/components/VisibilityBadge";
import StatusBadge from "@/components/StatusBadge";
import type { VideoStatus, VideoVisibility } from "@/types";

interface RecentVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  status: VideoStatus;
  visibility: VideoVisibility;
  created_at: string;
}
interface RecentUser {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  is_active: boolean;
  last_active_at: string | null;
}

interface DashboardData {
  stats: DashboardStats;
  summary: Awaited<ReturnType<typeof getVideoStatusSummary>>;
  recentVideos: RecentVideo[];
  recentUsers: RecentUser[];
  topVideos: { id: string; title: string; views_count: number; thumbnail_url: string | null }[];
  mostViewed: Awaited<ReturnType<typeof getMostViewedVideo>>;
  latestVideo: Awaited<ReturnType<typeof getLatestVideo>>;
  newUsersToday: number;
  videosToday: number;
  viewsToday: number;
  notifications: { kind: "info" | "warn"; text: string }[];
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <p className="mt-1 text-2xl font-bold">{value.toLocaleString()}</p>
          )}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            accent ?? "bg-primary/10 text-primary"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const since = startOfDay.toISOString();

        const [
          stats,
          summary,
          recentVideos,
          recentUsers,
          topVideos,
          mostViewed,
          latestVideo,
          newUsersToday,
          videosToday,
          viewsToday,
          analyticsSettings,
          adsenseSettings,
        ] = await Promise.all([
          getDashboardStats(),
          getVideoStatusSummary(),
          getRecentVideos(5),
          getRecentUsers(5),
          getTopViewedVideos(5),
          getMostViewedVideo(),
          getLatestVideo(),
          countUsersSince(since),
          countVideosSince(since),
          countViewsSince(since),
          getAnalyticsSettings().catch(() => null),
          getAdsenseSettings().catch(() => null),
        ]);

        if (!mounted) return;

        // Notifications are derived from real state only — never invented.
        const notifications: DashboardData["notifications"] = [];
        if (newUsersToday > 0)
          notifications.push({
            kind: "info",
            text: `${newUsersToday} new ${newUsersToday === 1 ? "user" : "users"} registered today.`,
          });
        if (videosToday > 0)
          notifications.push({
            kind: "info",
            text: `${videosToday} ${videosToday === 1 ? "video" : "videos"} uploaded today.`,
          });
        if (summary.draft > 0)
          notifications.push({
            kind: "info",
            text: `${summary.draft} ${summary.draft === 1 ? "video is" : "videos are"} still in draft and not visible to viewers.`,
          });
        if (analyticsSettings?.enabled && !analyticsSettings.ga_measurement_id)
          notifications.push({
            kind: "warn",
            text: "Google Analytics is enabled but no measurement ID is configured.",
          });
        if (adsenseSettings?.enabled && !adsenseSettings.publisher_id)
          notifications.push({
            kind: "warn",
            text: "AdSense is enabled but no publisher ID is configured.",
          });

        setData({
          stats,
          summary,
          recentVideos: recentVideos as unknown as RecentVideo[],
          recentUsers: recentUsers as unknown as RecentUser[],
          topVideos,
          mostViewed,
          latestVideo,
          newUsersToday,
          videosToday,
          viewsToday,
          notifications,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Please check your connection and try again.";
        console.error("[StreamVault] Dashboard load failed:", message);
        if (mounted) setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
        <ErrorState
          title="Couldn't load dashboard data"
          message={error}
          onRetry={() => setReloadKey((n) => n + 1)}
        />
      </div>
    );
  }

  const s = data?.stats;
  const sum = data?.summary;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Live overview of your platform.</p>
      </div>

      {data && data.notifications.length > 0 && (
        <div className="space-y-2">
          {data.notifications.map((n, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm ${
                n.kind === "warn"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-border bg-secondary/40 text-muted-foreground"
              }`}
            >
              {n.kind === "warn" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{n.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={s?.totalUsers ?? 0} icon={Users} loading={loading} />
        <StatCard label="Total Managers" value={s?.totalManagers ?? 0} icon={Shield} loading={loading} />
        <StatCard label="Total Videos" value={s?.totalVideos ?? 0} icon={VideoIcon} loading={loading} />
        <StatCard label="Total Views" value={s?.totalViews ?? 0} icon={Eye} loading={loading} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Published Videos"
          value={sum?.published ?? 0}
          icon={Globe}
          loading={loading}
          accent="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          label="Private Videos"
          value={sum?.privateCount ?? 0}
          icon={Lock}
          loading={loading}
          accent="bg-rose-500/10 text-rose-400"
        />
        <StatCard
          label="Preview Videos"
          value={sum?.previewCount ?? 0}
          icon={Sparkles}
          loading={loading}
          accent="bg-sky-500/10 text-sky-400"
        />
        <StatCard
          label="Today's Views"
          value={data?.viewsToday ?? 0}
          icon={Flame}
          loading={loading}
          accent="bg-amber-500/10 text-amber-400"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New Users Today" value={data?.newUsersToday ?? 0} icon={UserPlus} loading={loading} />
        <StatCard label="Uploaded Today" value={data?.videosToday ?? 0} icon={UploadCloud} loading={loading} />
        <StatCard label="Drafts" value={sum?.draft ?? 0} icon={FileVideo} loading={loading} />
        <StatCard label="Unpublished" value={sum?.unpublished ?? 0} icon={FileVideo} loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most Viewed Video</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-14 w-full" />
            ) : data?.mostViewed ? (
              <Link
                to={`/admin/videos/${data.mostViewed.id}/preview`}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
              >
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded bg-secondary">
                  {data.mostViewed.thumbnail_url && (
                    <img src={data.mostViewed.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{data.mostViewed.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatViews(data.mostViewed.views_count)}
                  </p>
                </div>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No videos yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently Uploaded</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-14 w-full" />
            ) : data?.latestVideo ? (
              <Link
                to={`/admin/videos/${data.latestVideo.id}/preview`}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
              >
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded bg-secondary">
                  {data.latestVideo.thumbnail_url && (
                    <img src={data.latestVideo.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{data.latestVideo.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeDate(data.latestVideo.created_at)}
                  </p>
                </div>
                <StatusBadge status={data.latestVideo.status as VideoStatus} />
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No videos yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Video Status Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Published", sum?.published ?? 0],
                ["Draft", sum?.draft ?? 0],
                ["Unpublished", sum?.unpublished ?? 0],
                ["Archived", sum?.archived ?? 0],
                ["Public", sum?.publicCount ?? 0],
                ["Preview", sum?.previewCount ?? 0],
                ["Private", sum?.privateCount ?? 0],
                ["Total", sum?.total ?? 0],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-lg font-semibold">{value as number}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Videos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : data?.recentVideos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No videos yet.</p>
            ) : (
              data?.recentVideos.map((v) => (
                <Link
                  key={v.id}
                  to={`/admin/videos/${v.id}/edit`}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
                >
                  <div className="h-10 w-16 shrink-0 overflow-hidden rounded bg-secondary">
                    {v.thumbnail_url && (
                      <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeDate(v.created_at)}</p>
                  </div>
                  <VisibilityBadge visibility={v.visibility} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : data?.recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            ) : (
              data?.recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.full_name || u.email}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeDate(u.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {!u.is_active && <Badge variant="destructive">Inactive</Badge>}
                    <Badge variant="outline" className="capitalize">
                      {u.role}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Videos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : data?.topVideos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No view data yet.</p>
            ) : (
              data?.topVideos.map((v, idx) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg p-2">
                  <span className="w-4 text-sm font-bold text-muted-foreground">{idx + 1}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{v.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatViews(v.views_count)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
