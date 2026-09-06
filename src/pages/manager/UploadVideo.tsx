import { useEffect, useState } from "react";
import { listCategories } from "@/services/categoryService";
import type { Category } from "@/types";
import VideoForm from "@/components/VideoForm";
import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerUploadVideo() {
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    listCategories().then(setCategories).catch(console.error);
  }, []);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Video</h1>
        <p className="text-muted-foreground">Add a new video to your library.</p>
      </div>
      {categories === null ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <VideoForm mode="create" categories={categories} redirectTo="/manager/videos" />
      )}
    </div>
  );
}
