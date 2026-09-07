import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Eye, FileWarning, PlayCircle } from "lucide-react";
import { getRelatedVideos, getVideoById, recordVideoView } from "@/services/videoService";
import type { VideoWithRelations } from "@/types";
import { formatRelativeDate, formatViews } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import VideoPlayer from "@/components/VideoPlayer";
import VideoCard from "@/components/VideoCard";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import AdSlot from "@/components/AdSlot";
import { analytics } from "@/lib/analytics";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function VideoDetails() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();

  const [video, setVideo] = useState<VideoWithRelations | null | undefined>(undefined);
  const [related, setRelated] = useState<VideoWithRelations[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setVideo(undefined);
    setLoadError(null);

    getVideoById(id)
      .then((v) => {
        if (!mounted) return;
        setVideo(v);

        // Related videos load independently: a failure here must not
        // discard the video we already fetched successfully.
        if (v) {
          getRelatedVideos(v.category_id, v.id)
            .then((r) => mounted && setRelated(r))
            .catch((err: unknown) => {
              console.error("[StreamVault] Failed to load related videos:", err);
              if (mounted) setRelated([]);
            });
        }
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Please check your connection and try again.";
        console.error("[StreamVault] Failed to load video:", message);
        if (mounted) setLoadError(message);
      });

    return () => {
      mounted = false;
    };
  }, [id, reloadKey]);

  function handleFirstPlay() {
    if (!id) return;
    if (video) analytics.videoPlay(video.id, video.title);
    if (!isAuthenticated) return;
    recordVideoView(id).catch((err) => console.error("Failed to record view:", err));
  }

  if (loadError) {
    return (
      <div className="container py-16">
        <ErrorState
          title="Couldn't load this video"
          message={loadError}
          onRetry={() => setReloadKey((n) => n + 1)}
        />
      </div>
    );
  }

  if (video === undefined) {
    return (
      <div className="container grid gap-8 py-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="mt-4 h-7 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/3" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (video === null) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={FileWarning}
          title="Video not found"
          description="This video may have been removed or is not available."
          action={
            <Button asChild>
              <Link to="/videos">Browse videos</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const uploaderInitial = (video.uploader?.full_name || "U").charAt(0).toUpperCase();

  return (
    <div className="container grid gap-8 py-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <VideoPlayer src={video.video_path} poster={video.thumbnail_url} onFirstPlay={handleFirstPlay} />

        <AdSlot placement="below_player" className="mt-4" />

        <h1 className="mt-4 text-xl font-bold sm:text-2xl">{video.title}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" /> {formatViews(video.views_count)}
          </span>
          <span>&middot;</span>
          <span>{formatRelativeDate(video.created_at)}</span>
          {video.category && (
            <Link to={`/categories/${video.category.slug}`}>
              <Badge variant="secondary">{video.category.name}</Badge>
            </Link>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Avatar>
            <AvatarImage src={video.uploader?.avatar_url ?? undefined} />
            <AvatarFallback>{uploaderInitial}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{video.uploader?.full_name ?? "StreamVault"}</p>
            <p className="text-xs text-muted-foreground">Content Publisher</p>
          </div>
        </div>

        {video.description && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <p className="whitespace-pre-line text-sm text-muted-foreground">{video.description}</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <PlayCircle className="h-4 w-4" /> Related Videos
        </h2>
        <AdSlot placement="video_details" className="mb-4" />

        {related.length === 0 ? (
          <p className="text-sm text-muted-foreground">No related videos found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
            {related.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
