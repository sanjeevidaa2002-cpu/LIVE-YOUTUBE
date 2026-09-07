import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileVideo, Loader2, UploadCloud, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  formatBytes,
} from "@/lib/utils";
import type { Category, VideoStatus, VideoVisibility, VideoWithRelations } from "@/types";
import {
  buildStoragePath,
  deleteFile,
  getPublicUrl,
  uploadFileWithProgress,
} from "@/services/storageService";
import { createVideo, updateVideo } from "@/services/videoService";
import { logActivity } from "@/services/activityService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface VideoFormProps {
  mode: "create" | "edit";
  video?: VideoWithRelations;
  categories: Category[];
  redirectTo: string;
}

function getVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    };
    video.onerror = () => resolve(null);
    video.src = URL.createObjectURL(file);
  });
}

export default function VideoForm({ mode, video, categories, redirectTo }: VideoFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(video?.title ?? "");
  const [description, setDescription] = useState(video?.description ?? "");
  const [categoryId, setCategoryId] = useState(video?.category_id ?? "");
  const [status, setStatus] = useState<VideoStatus>(video?.status ?? "published");
  const [isFeatured, setIsFeatured] = useState(video?.is_featured ?? false);
  const [visibility, setVisibility] = useState<VideoVisibility>(video?.visibility ?? "public");
  const [tagsInput, setTagsInput] = useState((video?.tags ?? []).join(", "));

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    video?.thumbnail_url ?? null,
  );

  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving" | "success" | "error">(
    "idle",
  );

  useEffect(() => {
    return () => {
      if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailPreview);
      }
    };
  }, [thumbnailPreview]);

  function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileError(null);
    if (!file) return;

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setFileError("Unsupported video format. Please upload MP4, WebM, or MOV files only.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setFileError(`Video file is too large. Maximum size is ${formatBytes(MAX_VIDEO_SIZE_BYTES)}.`);
      e.target.value = "";
      return;
    }
    setVideoFile(file);
  }

  function handleThumbnailFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileError(null);
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setFileError("Unsupported image format. Please upload JPG, PNG, or WebP files only.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFileError(`Thumbnail is too large. Maximum size is ${formatBytes(MAX_IMAGE_SIZE_BYTES)}.`);
      e.target.value = "";
      return;
    }
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!user) {
      setSubmitError("You must be signed in.");
      return;
    }
    if (mode === "create" && !videoFile) {
      setSubmitError("Please select a video file to upload.");
      return;
    }

    let uploadedVideoPath: string | null = null;
    let uploadedThumbnailPath: string | null = null;

    try {
      setPhase("uploading");
      setUploadProgress(0);

      if (videoFile) {
        uploadedVideoPath = buildStoragePath(user.id, videoFile);
        await uploadFileWithProgress("videos", uploadedVideoPath, videoFile, setUploadProgress);
      }

      if (thumbnailFile) {
        uploadedThumbnailPath = buildStoragePath(user.id, thumbnailFile);
        await uploadFileWithProgress("thumbnails", uploadedThumbnailPath, thumbnailFile);
      }

      setPhase("saving");

      const duration = videoFile ? await getVideoDuration(videoFile) : (video?.duration ?? null);
      const videoPublicUrl = uploadedVideoPath ? getPublicUrl("videos", uploadedVideoPath) : null;
      const thumbnailPublicUrl = uploadedThumbnailPath
        ? getPublicUrl("thumbnails", uploadedThumbnailPath)
        : null;

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (mode === "create") {
        const created = await createVideo({
          title,
          description: description || null,
          categoryId: categoryId || null,
          videoPath: videoPublicUrl as string,
          thumbnailUrl: thumbnailPublicUrl,
          duration,
          isFeatured,
          status,
          visibility,
          tags,
          uploadedBy: user.id,
        });
        await logActivity("video.uploaded", {
          targetType: "video",
          targetId: created.id,
          details: { title, status, visibility },
        });
      } else if (video) {
        await updateVideo(video.id, {
          title,
          description: description || null,
          categoryId: categoryId || null,
          videoPath: videoPublicUrl ?? undefined,
          thumbnailUrl: thumbnailPublicUrl ?? undefined,
          duration,
          isFeatured,
          status,
          visibility,
          tags,
        });
        await logActivity("video.edited", {
          targetType: "video",
          targetId: video.id,
          details: { title, status, visibility },
        });

        // Clean up replaced files now that the DB row points elsewhere.
        if (uploadedVideoPath && video.video_path) {
          const oldPath = extractStoragePath(video.video_path, "videos");
          if (oldPath) await deleteFile("videos", oldPath).catch(() => undefined);
        }
        if (uploadedThumbnailPath && video.thumbnail_url) {
          const oldPath = extractStoragePath(video.thumbnail_url, "thumbnails");
          if (oldPath) await deleteFile("thumbnails", oldPath).catch(() => undefined);
        }
      }

      setPhase("success");
      toast({
        title: mode === "create" ? "Video uploaded" : "Video updated",
        description: `"${title}" has been saved successfully.`,
      });
      navigate(redirectTo);
    } catch (err) {
      setPhase("error");
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setSubmitError(message);

      // Roll back any files we already uploaded so nothing is orphaned.
      if (uploadedVideoPath) await deleteFile("videos", uploadedVideoPath).catch(() => undefined);
      if (uploadedThumbnailPath)
        await deleteFile("thumbnails", uploadedThumbnailPath).catch(() => undefined);

      toast({
        variant: "destructive",
        title: "Upload failed",
        description: message,
      });
    }
  }

  const isBusy = phase === "uploading" || phase === "saving";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="title">Video Title</Label>
            <Input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title"
              disabled={isBusy}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this video about?"
              rows={4}
              disabled={isBusy}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={isBusy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VideoStatus)} disabled={isBusy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="unpublished">Unpublished</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as VideoVisibility)}
                disabled={isBusy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — any signed-in viewer</SelectItem>
                  <SelectItem value="preview">Preview — teaser, any signed-in viewer</SelectItem>
                  <SelectItem value="private">Private — admins and the uploader only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="comma, separated, tags"
                disabled={isBusy}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="featured" checked={isFeatured} onCheckedChange={setIsFeatured} disabled={isBusy} />
            <Label htmlFor="featured" className="cursor-pointer font-normal">
              Feature this video on the homepage
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-6 pt-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Video File {mode === "edit" && "(optional — replaces existing)"}</Label>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={isBusy}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/60 disabled:opacity-60"
            >
              <FileVideo className="h-8 w-8 text-muted-foreground" />
              {videoFile ? (
                <div>
                  <p className="text-sm font-medium">{videoFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(videoFile.size)}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {mode === "edit" && video ? "Click to replace video file" : "Click to select MP4, WebM, or MOV"}
                </p>
              )}
            </button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={handleVideoFileChange}
            />
          </div>

          <div className="space-y-2">
            <Label>Thumbnail (optional)</Label>
            <button
              type="button"
              onClick={() => thumbInputRef.current?.click()}
              disabled={isBusy}
              className="flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/60 disabled:opacity-60"
            >
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="Thumbnail preview" className="h-24 w-full rounded object-cover" />
              ) : (
                <>
                  <UploadCloud className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to select JPG, PNG, or WebP</p>
                </>
              )}
            </button>
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleThumbnailFileChange}
            />
          </div>
        </CardContent>
      </Card>

      {fileError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          {fileError}
        </div>
      )}

      {phase === "uploading" && (
        <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading video...
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {phase === "saving" && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-4 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Saving video details...
        </div>
      )}

      {phase === "success" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> Saved successfully. Redirecting...
        </div>
      )}

      {submitError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          {submitError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(redirectTo)} disabled={isBusy}>
          Cancel
        </Button>
        <Button type="submit" disabled={isBusy}>
          {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "create" ? "Upload Video" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}
