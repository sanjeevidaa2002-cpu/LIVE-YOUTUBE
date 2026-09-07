import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FolderX } from "lucide-react";
import { getCategoryBySlug } from "@/services/categoryService";
import { listVideos } from "@/services/videoService";
import type { Category, VideoWithRelations } from "@/types";
import VideoCard from "@/components/VideoCard";
import VideoCardSkeleton from "@/components/VideoCardSkeleton";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import Pagination from "@/components/Pagination";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 16;

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<Category | null | undefined>(undefined);
  const [videos, setVideos] = useState<VideoWithRelations[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    getCategoryBySlug(slug)
      .then(async (cat) => {
        if (!mounted) return;
        setCategory(cat);
        if (!cat) return { data: [], count: 0, hasMore: false };
        return listVideos({ categoryId: cat.id, page, pageSize: PAGE_SIZE });
      })
      .then((res) => {
        if (!mounted || !res) return;
        setVideos(res.data);
        setCount(res.count);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Please check your connection and try again.";
        console.error("[StreamVault] Failed to load category:", message);
        setError(message);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [slug, page, reloadKey]);

  if (error) {
    return (
      <div className="container py-16">
        <ErrorState
          title="Couldn't load this category"
          message={error}
          onRetry={() => setReloadKey((n) => n + 1)}
        />
      </div>
    );
  }

  if (category === null) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={FolderX}
          title="Category not found"
          description="This category doesn't exist or may have been removed."
          action={
            <Button asChild>
              <Link to="/videos">Browse all videos</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="mb-1 text-2xl font-bold">{category?.name ?? "Loading..."}</h1>
      {category?.description && (
        <p className="mb-6 text-muted-foreground">{category.description}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <EmptyState title="No videos in this category yet" description="Check back soon." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
