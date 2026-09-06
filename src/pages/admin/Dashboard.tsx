import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Shield, Users, Video } from "lucide-react";
import {
  getDashboardStats,
  getRecentUsers,
  getRecentVideos,
  getTopViewedVideos,
  type DashboardStats,
} from "@/services/analyticsService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate, formatViews } from "@/lib/utils";

interface RecentVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
}
interface RecentUser {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}
interface TopVideo {
  id: string;
  title: string;
  views_count: number;
  thumbnail_url: string | null;
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-1 text-3xl font-bold">{value.toLocaleString()}</p>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [topVideos, setTopVideos] = useState<TopVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([getDashboardStats(), getRecentVideos(5), getRecentUsers(5), getTopViewedVideos(5)])
      .then(([s, videos, users, top]) => {
        if (!mounted) return;
        setStats(s);
        setRecentVideos(videos);
        setRecentUsers(users);
        setTopVideos(top);
      })
      .catch(console.error)
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of your platform's activity.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} icon={Users} loading={loading} />
        <StatCard label="Total Managers" value={stats?.totalManagers ?? 0} icon={Shield} loading={loading} />
        <StatCard label="Total Videos" value={stats?.totalVideos ?? 0} icon={Video} loading={loading} />
        <StatCard label="Total Views" value={stats?.totalViews ?? 0} icon={Eye} loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Recent Videos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentVideos.length === 0 && <p className="text-sm text-muted-foreground">No videos yet.</p>}
            {recentVideos.map((v) => (
              <Link
                key={v.id}
                to={`/admin/videos`}
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
                <Badge variant={v.status === "published" ? "success" : "secondary"} className="capitalize">
                  {v.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Recent Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentUsers.length === 0 && <p className="text-sm text-muted-foreground">No users yet.</p>}
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeDate(u.created_at)}</p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {u.role}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Top Viewed Videos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topVideos.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
            {topVideos.map((v, idx) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg p-2">
                <span className="w-4 text-sm font-bold text-muted-foreground">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.title}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatViews(v.views_count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
