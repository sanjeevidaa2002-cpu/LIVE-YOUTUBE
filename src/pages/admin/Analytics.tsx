import { useEffect, useState } from "react";
import { Eye, Shield, Users, Video } from "lucide-react";
import { getDashboardStats, getTopViewedVideos, type DashboardStats } from "@/services/analyticsService";
import { formatViews } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TopVideo {
  id: string;
  title: string;
  views_count: number;
  thumbnail_url: string | null;
}

export default function AdminAnalytics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topVideos, setTopVideos] = useState<TopVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getTopViewedVideos(10)])
      .then(([s, top]) => {
        setStats(s);
        setTopVideos(top);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const maxViews = Math.max(1, ...topVideos.map((v) => v.views_count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Platform-wide performance at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Users", value: stats?.totalUsers, icon: Users },
          { label: "Total Managers", value: stats?.totalManagers, icon: Shield },
          { label: "Total Videos", value: stats?.totalVideos, icon: Video },
          { label: "Total Views", value: stats?.totalViews, icon: Eye },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                {loading ? (
                  <Skeleton className="mt-2 h-8 w-16" />
                ) : (
                  <p className="mt-1 text-3xl font-bold">{(item.value ?? 0).toLocaleString()}</p>
                )}
              </div>
              <item.icon className="h-8 w-8 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 Viewed Videos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
          ) : topVideos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No view data yet.</p>
          ) : (
            topVideos.map((v) => (
              <div key={v.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="line-clamp-1 font-medium">{v.title}</span>
                  <span className="text-muted-foreground">{formatViews(v.views_count)}</span>
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
    </div>
  );
}
