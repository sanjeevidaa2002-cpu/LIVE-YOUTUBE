import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileWarning, Pencil } from "lucide-react";
import { getVideoById } from "@/services/videoService";
import type { VideoWithRelations } from "@/types";
import { formatDuration, formatRelativeDate, formatViews } from "@/lib/utils";
import VideoPlayer from "@/components/VideoPlayer";
import StatusBadge from "@/components/StatusBadge";
import VisibilityBadge from "@/components/VisibilityBadge";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Administrator preview. Because admins can read every row under RLS, this
 * plays drafts and private videos that the public player would not serve —
 * without making those videos publicly reachable: the same RLS policy still
 * refuses the request for anyone who is not an admin or the uploader.
 */
export default function AdminVideoPreview() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<VideoWithRelations | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setVideo(undefined);
    setError(null);
    getVideoById(id)
      .then((v) => mounted && setVideo(v))
      .catch((err: unknown) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Please check your connection and try again.";
        console.error("[StreamVault] Failed to load video for preview:", message);
        setError(message);
      });
    return () => {
      mounted = false;
    };
  }, [id, reloadKey]);

  if (error) {
    return (
      <ErrorState
        title="Couldn't load this video"
        message={error}
        onRetry={() => setReloadKey((n) => n + 1)}
      />
    );
  }

  if (video === null) {
    return (
      <EmptyState
        icon={FileWarning}
        title="Video not found"
        description="It may have been deleted."
        action={
          <Button asChild>
            <Link to="/admin/videos">Back to Videos</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/videos" aria-label="Back to videos">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Admin Preview</h1>
            <p className="text-sm text-muted-foreground">
              Plays drafts and private videos that viewers cannot access.
            </p>
          </div>
        </div>
        {video && (
          <Button asChild>
            <Link to={`/admin/videos/${video.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      {video === undefined ? (
        <div className="space-y-4">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ) : (
        <>
          <VideoPlayer src={video.video_path} poster={video.thumbnail_url} />

          <div>
            <h2 className="text-xl font-bold">{video.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={video.status} />
              <VisibilityBadge visibility={video.visibility} />
              {video.is_featured && <Badge>Featured</Badge>}
              {video.category && <Badge variant="secondary">{video.category.name}</Badge>}
            </div>
          </div>

          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              {[
                ["Views", formatViews(video.views_count)],
                ["Duration", video.duration ? formatDuration(video.duration) : "Unknown"],
                ["Uploaded", formatRelativeDate(video.created_at)],
                ["Uploader", video.uploader?.full_name ?? "—"],
                ["Category", video.category?.name ?? "Uncategorized"],
                ["Video ID", video.id],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="break-all text-sm font-medium">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {video.tags.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Tags</p>
              <div className="flex flex-wrap gap-2">
                {video.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {video.description && (
            <Card>
              <CardContent className="p-6">
                <p className="mb-2 text-sm font-medium">Description</p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {video.description}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
