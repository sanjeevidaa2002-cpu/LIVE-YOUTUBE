import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchX } from "lucide-react";
import { listVideos } from "@/services/videoService";
import { listCategories } from "@/services/categoryService";
import type { Category, VideoWithRelations } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";
import VideoCard from "@/components/VideoCard";
import VideoCardSkeleton from "@/components/VideoCardSkeleton";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import SearchBar from "@/components/SearchBar";
import Pagination from "@/components/Pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 16;

export default function Videos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [search, setSearch] = useState(initialQuery);
  const debouncedSearch = useDebounce(search, 400);
  const [categoryId, setCategoryId] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [videos, setVideos] = useState<VideoWithRelations[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    listCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId]);

  useEffect(() => {
    if (debouncedSearch) {
      setSearchParams(debouncedSearch ? { q: debouncedSearch } : {}, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    listVideos({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      categoryId: categoryId === "all" ? undefined : categoryId,
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
  }, [page, debouncedSearch, categoryId, reloadKey]);

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">Browse Videos</h1>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <SearchBar value={search} onChange={setSearch} className="sm:max-w-md" />
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            setReloadKey((n) => n + 1);
          }}
        />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No videos found"
          description="Try a different search term or category filter."
        />
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
