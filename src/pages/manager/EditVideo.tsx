import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileWarning } from "lucide-react";
import { listCategories } from "@/services/categoryService";
import { getVideoById } from "@/services/videoService";
import { useAuth } from "@/contexts/AuthContext";
import type { Category, VideoWithRelations } from "@/types";
import VideoForm from "@/components/VideoForm";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

export default function ManagerEditVideo() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
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

  const notOwner = video && user && video.uploaded_by !== user.id;

  if (video === null || notOwner) {
    return (
      <EmptyState
        icon={FileWarning}
        title={notOwner ? "You can only edit your own videos" : "Video not found"}
        action={
          <Button asChild>
            <Link to="/manager/videos">Back to My Videos</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Video</h1>
        <p className="text-muted-foreground">Update your video's details, files, and visibility.</p>
      </div>
      {categories === null || video === undefined ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <VideoForm mode="edit" video={video} categories={categories} redirectTo="/manager/videos" />
      )}
    </div>
  );
}
