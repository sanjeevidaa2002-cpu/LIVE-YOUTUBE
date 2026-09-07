import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Eye,
  Globe,
  Lock,
  MoreHorizontal,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  Video as VideoIcon,
} from "lucide-react";
import { deleteVideo, listVideos, updateVideo } from "@/services/videoService";
import { deleteFile } from "@/services/storageService";
import { logActivity } from "@/services/activityService";
import type { VideoStatus, VideoVisibility, VideoWithRelations } from "@/types";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import StatusBadge from "@/components/StatusBadge";
import VisibilityBadge from "@/components/VisibilityBadge";
import { Skeleton } from "@/components/ui/skeleton";
import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";
import { useDebounce } from "@/hooks/useDebounce";

const PAGE_SIZE = 10;

interface VideoManagementTableProps {
  uploaderId?: string;
  basePath: string;
  showUploaderColumn?: boolean;
  /** Admin gets visibility controls and a preview route; managers do not. */
  isAdmin?: boolean;
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
  isAdmin = false,
}: VideoManagementTableProps) {
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoWithRelations[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState<VideoStatus | "all">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<VideoVisibility | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<VideoWithRelations | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => setPage(1), [debouncedSearch, statusFilter, visibilityFilter]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    listVideos({
      page,
      pageSize: PAGE_SIZE,
      status: statusFilter,
      visibility: visibilityFilter,
      uploaderId,
      search: debouncedSearch,
      orderBy: "created_at",
      ascending: false,
    })
      .then((res) => {
        if (!mounted) return;
        setVideos(res.data);
        setCount(res.count);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Please check your connection and try again.";
        console.error("[StreamVault] Failed to load videos:", message);
        setError(message);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [page, debouncedSearch, statusFilter, visibilityFilter, uploaderId, reloadKey]);

  const refresh = () => setReloadKey((n) => n + 1);

  async function changeStatus(video: VideoWithRelations, status: VideoStatus) {
    try {
      await updateVideo(video.id, { status });
      await logActivity("video.status_changed", {
        targetType: "video",
        targetId: video.id,
        details: { title: video.title, from: video.status, to: status },
      });
      toast({ title: "Status updated", description: `"${video.title}" is now ${status}.` });
      refresh();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not update status",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  async function changeVisibility(video: VideoWithRelations, visibility: VideoVisibility) {
    try {
      await updateVideo(video.id, { visibility });
      await logActivity("video.visibility_changed", {
        targetType: "video",
        targetId: video.id,
        details: { title: video.title, from: video.visibility, to: visibility },
      });
      toast({ title: "Visibility updated", description: `"${video.title}" is now ${visibility}.` });
      refresh();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not update visibility",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

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

      await logActivity("video.deleted", {
        targetType: "video",
        targetId: deleteTarget.id,
        details: { title: deleteTarget.title },
      });
      toast({ title: "Video deleted", description: `"${deleteTarget.title}" has been removed.` });
      setDeleteTarget(null);
      refresh();
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
      <div className="flex flex-col gap-3 lg:flex-row">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search videos..."
          className="lg:max-w-sm"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as VideoStatus | "all")}>
          <SelectTrigger className="lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
            <SelectItem value="unpublished">Unpublished</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select
            value={visibilityFilter}
            onValueChange={(v) => setVisibilityFilter(v as VideoVisibility | "all")}
          >
            <SelectTrigger className="lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All visibility</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="preview">Preview</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={VideoIcon}
          title="No videos found"
          description="Upload a video or change the filters above."
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
                <TableHead>Visibility</TableHead>
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
                      <span className="line-clamp-1 max-w-[180px] font-medium">{video.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {video.category?.name ?? "—"}
                  </TableCell>
                  {showUploaderColumn && (
                    <TableCell className="text-muted-foreground">
                      {video.uploader?.full_name ?? "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <StatusBadge status={video.status} />
                  </TableCell>
                  <TableCell>
                    <VisibilityBadge visibility={video.visibility} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatViews(video.views_count)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatRelativeDate(video.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild title="Preview">
                        <Link
                          to={isAdmin ? `${basePath}/${video.id}/preview` : `/videos/${video.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild title="Edit">
                        <Link to={`${basePath}/${video.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" title="More actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Status</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => changeStatus(video, "published")}
                            disabled={video.status === "published"}
                          >
                            <Send className="h-4 w-4" /> Publish
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => changeStatus(video, "unpublished")}
                            disabled={video.status === "unpublished"}
                          >
                            Unpublish
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => changeStatus(video, "draft")}
                            disabled={video.status === "draft"}
                          >
                            Move to draft
                          </DropdownMenuItem>

                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Visibility</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => changeVisibility(video, "public")}
                                disabled={video.visibility === "public"}
                              >
                                <Globe className="h-4 w-4" /> Make public
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => changeVisibility(video, "preview")}
                                disabled={video.visibility === "preview"}
                              >
                                <Sparkles className="h-4 w-4" /> Make preview
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => changeVisibility(video, "private")}
                                disabled={video.visibility === "private"}
                              >
                                <Lock className="h-4 w-4" /> Make private
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(video)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        title="Delete Video?"
        description={`This action will permanently remove "${deleteTarget?.title}" and its associated metadata, including the video and thumbnail files in storage. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
