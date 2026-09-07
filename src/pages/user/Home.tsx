import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Flame, Sparkles } from "lucide-react";
import { listVideos } from "@/services/videoService";
import { listCategories } from "@/services/categoryService";
import type { Category, VideoWithRelations } from "@/types";
import VideoCard from "@/components/VideoCard";
import VideoCardSkeleton from "@/components/VideoCardSkeleton";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { Button } from "@/components/ui/button";

function VideoRow({
  title,
  icon: Icon,
  videos,
  loading,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  videos: VideoWithRelations[];
  loading: boolean;
}) {
  return (
    <section className="container py-8">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <EmptyState title="No videos yet" description="Check back soon for new content." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [featured, setFeatured] = useState<VideoWithRelations[]>([]);
  const [latest, setLatest] = useState<VideoWithRelations[]>([]);
  const [popular, setPopular] = useState<VideoWithRelations[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setError(null);
      try {
        const [featuredRes, latestRes, popularRes, categoriesRes] = await Promise.all([
          listVideos({ featuredOnly: true, pageSize: 8 }),
          listVideos({ pageSize: 12, orderBy: "created_at", ascending: false }),
          listVideos({ pageSize: 12, orderBy: "views_count", ascending: false }),
          listCategories(),
        ]);
        if (!mounted) return;
        setFeatured(featuredRes.data);
        setLatest(latestRes.data);
        setPopular(popularRes.data);
        setCategories(categoriesRes);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Please check your connection and try again.";
        console.error("[StreamVault] Failed to load homepage content:", message);
        if (mounted) setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  const hero = featured[0] ?? latest[0];

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/40 to-background">
        <div className="container flex flex-col items-start gap-6 py-16 sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Stream premium content, on demand
          </span>
          <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            {hero ? hero.title : "Watch what matters, whenever you want."}
          </h1>
          <p className="max-w-xl text-muted-foreground sm:text-lg">
            Discover curated videos across technology, music, gaming, education, and more —
            all in one clean, distraction-free player.
          </p>
          <div className="flex gap-3">
            <Button size="lg" asChild>
              <Link to={hero ? `/videos/${hero.id}` : "/videos"}>
                {hero ? "Watch Now" : "Browse Videos"}
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/videos">Explore Library</Link>
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="container pt-8">
          <ErrorState
            title="Couldn't load videos"
            message={error}
            onRetry={() => {
              setLoading(true);
              setReloadKey((n) => n + 1);
            }}
          />
        </div>
      )}

      {!error && categories.length > 0 && (
        <section className="container py-8">
          <div className="mb-4 flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Categories</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/categories/${c.slug}`}
                className="rounded-full border border-border bg-secondary/50 px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {!error && (
        <>
          <VideoRow title="Featured" icon={Sparkles} videos={featured} loading={loading} />
          <VideoRow title="Latest Videos" icon={Compass} videos={latest} loading={loading} />
          <VideoRow title="Popular Videos" icon={Flame} videos={popular} loading={loading} />
        </>
      )}
    </div>
  );
}
