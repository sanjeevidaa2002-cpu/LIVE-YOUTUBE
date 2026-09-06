import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { listCategories } from "@/services/categoryService";
import { getVideoById } from "@/services/videoService";
import type { Category, VideoWithRelations } from "@/types";
import VideoForm from "@/components/VideoForm";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { FileWarning } from "lucide-react";

export default function AdminEditVideo() {
  const { id } = useParams<{ id: string }>();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [video, setVideo] = useState<VideoWithRelations | null | undefined>(undefined);

  useEffect(() => {
    listCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    if (!id) return;
    getVideoById(id)
      .then(setVideo)
      .catch(() => setVideo(null));
  }, [id]);

  if (video === null) {
    return (
      <EmptyState
        icon={FileWarning}
        title="Video not found"
        action={
          <Button asChild>
            <Link to="/admin/videos">Back to Videos</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Video</h1>
        <p className="text-muted-foreground">Update video details, files, and visibility.</p>
      </div>
      {categories === null || video === undefined ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <VideoForm mode="edit" video={video} categories={categories} redirectTo="/admin/videos" />
      )}
    </div>
  );
}
