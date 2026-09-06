import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Pencil, Trash2, Video as VideoIcon } from "lucide-react";
import { deleteVideo, listVideos } from "@/services/videoService";
import { deleteFile } from "@/services/storageService";
import type { VideoWithRelations } from "@/types";
import { formatRelativeDate, formatViews } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";
import { useDebounce } from "@/hooks/useDebounce";

const PAGE_SIZE = 10;

interface VideoManagementTableProps {
  uploaderId?: string;
  basePath: string;
  showUploaderColumn?: boolean;
}

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

export default function VideoManagementTable({
  uploaderId,
  basePath,
  showUploaderColumn = false,
}: VideoManagementTableProps) {
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoWithRelations[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [deleteTarget, setDeleteTarget] = useState<VideoWithRelations | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setPage(1), [debouncedSearch]);

  async function load() {
    setLoading(true);
    try {
      const res = await listVideos({
        page,
        pageSize: PAGE_SIZE,
        status: "all",
        uploaderId,
        search: debouncedSearch,
        orderBy: "created_at",
        ascending: false,
      });
      setVideos(res.data);
      setCount(res.count);
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Failed to load videos",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, uploaderId]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVideo(deleteTarget.id);
      const videoPath = extractStoragePath(deleteTarget.video_path, "videos");
      if (videoPath) await deleteFile("videos", videoPath).catch(() => undefined);
      if (deleteTarget.thumbnail_url) {
        const thumbPath = extractStoragePath(deleteTarget.thumbnail_url, "thumbnails");
        if (thumbPath) await deleteFile("thumbnails", thumbPath).catch(() => undefined);
      }
      toast({ title: "Video deleted", description: `"${deleteTarget.title}" has been removed.` });
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <SearchBar value={search} onChange={setSearch} placeholder="Search your videos..." className="max-w-sm" />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <EmptyState
          icon={VideoIcon}
          title="No videos found"
          description="Upload your first video to get started."
          action={
            <Button asChild>
              <Link to={`${basePath}/upload`}>Upload Video</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead>Category</TableHead>
                {showUploaderColumn && <TableHead>Uploader</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((video) => (
                <TableRow key={video.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-16 shrink-0 overflow-hidden rounded bg-secondary">
                        {video.thumbnail_url && (
                          <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <span className="line-clamp-1 max-w-[200px] font-medium">{video.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{video.category?.name ?? "—"}</TableCell>
                  {showUploaderColumn && (
                    <TableCell className="text-muted-foreground">
                      {video.uploader?.full_name ?? "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge
                      variant={
                        video.status === "published"
                          ? "success"
                          : video.status === "draft"
                            ? "warning"
                            : "secondary"
                      }
                      className="capitalize"
                    >
                      {video.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatViews(video.views_count)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeDate(video.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild title="View">
                        <Link to={`/videos/${video.id}`} target="_blank">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild title="Edit">
                        <Link to={`${basePath}/${video.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(video)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete video"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
