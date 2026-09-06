import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, UploadCloud, Video as VideoIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listVideos } from "@/services/videoService";
import type { VideoWithRelations } from "@/types";
import { formatRelativeDate, formatViews } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";

export default function ManagerDashboard() {
  const { user, profile } = useAuth();
  const [videos, setVideos] = useState<VideoWithRelations[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    listVideos({ uploaderId: user.id, status: "all", pageSize: 5 })
      .then((res) => {
        setVideos(res.data);
        setTotalCount(res.count);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    listVideos({ uploaderId: user.id, status: "all", pageSize: 1000 }).then((res) => {
      setTotalViews(res.data.reduce((sum, v) => sum + v.views_count, 0));
    });
  }, [user]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {profile?.full_name || "Manager"}</h1>
        <p className="text-muted-foreground">Here's an overview of your uploaded content.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Your Videos</p>
              {loading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="mt-1 text-3xl font-bold">{totalCount}</p>}
            </div>
            <VideoIcon className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Views</p>
              {loading ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p className="mt-1 text-3xl font-bold">{totalViews.toLocaleString()}</p>
              )}
            </div>
            <Eye className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Your Recent Videos</CardTitle>
          <Button size="sm" asChild>
            <Link to="/manager/videos/upload">
              <UploadCloud className="h-4 w-4" /> Upload
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : videos.length === 0 ? (
            <EmptyState
              icon={VideoIcon}
              title="No videos yet"
              description="Upload your first video to get started."
            />
          ) : (
            videos.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent">
                <div className="h-10 w-16 shrink-0 overflow-hidden rounded bg-secondary">
                  {v.thumbnail_url && <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.title}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeDate(v.created_at)}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatViews(v.views_count)}</span>
                <Badge variant={v.status === "published" ? "success" : "secondary"} className="capitalize">
                  {v.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
