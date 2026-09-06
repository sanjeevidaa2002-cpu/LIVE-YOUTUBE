import { Link } from "react-router-dom";
import { PlayCircle } from "lucide-react";
import type { VideoWithRelations } from "@/types";
import { formatDuration, formatRelativeDate, formatViews } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function VideoCard({ video }: { video: VideoWithRelations }) {
  return (
    <Link
      to={`/videos/${video.id}`}
      className="group flex flex-col gap-2 rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-1"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-secondary">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <PlayCircle className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
        {video.duration ? (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(video.duration)}
          </span>
        ) : null}
        {video.is_featured && (
          <Badge className="absolute left-1.5 top-1.5" variant="default">
            Featured
          </Badge>
        )}
      </div>

      <div className="flex gap-3 px-0.5">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-primary">
            {video.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {video.category && <span>{video.category.name}</span>}
            {video.category && <span>&middot;</span>}
            <span>{formatViews(video.views_count)}</span>
            <span>&middot;</span>
            <span>{formatRelativeDate(video.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
