import { supabase } from "@/lib/supabase";
import type {
  PaginatedResult,
  VideoStatus,
  VideoVisibility,
  VideoWithRelations,
} from "@/types";

const VIDEO_SELECT = `
  *,
  category:categories ( id, name, slug ),
  uploader:profiles ( id, full_name, avatar_url )
`;

export interface ListVideosOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  categorySlug?: string;
  categoryId?: string;
  status?: VideoStatus | "all";
  visibility?: VideoVisibility | "all";
  featuredOnly?: boolean;
  uploaderId?: string;
  orderBy?: "created_at" | "views_count";
  ascending?: boolean;
}

export async function listVideos(
  options: ListVideosOptions = {},
): Promise<PaginatedResult<VideoWithRelations>> {
  const {
    page = 1,
    pageSize = 12,
    search,
    categorySlug,
    categoryId,
    status = "published",
    visibility = "all",
    featuredOnly,
    uploaderId,
    orderBy = "created_at",
    ascending = false,
  } = options;

  let query = supabase.from("videos").select(VIDEO_SELECT, { count: "exact" });

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (visibility !== "all") {
    query = query.eq("visibility", visibility);
  }
  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }
  if (categorySlug) {
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();
    if (!category) return { data: [], count: 0, hasMore: false };
    query = query.eq("category_id", category.id);
  }
  if (featuredOnly) {
    query = query.eq("is_featured", true);
  }
  if (uploaderId) {
    query = query.eq("uploaded_by", uploaderId);
  }
  if (search && search.trim()) {
    const term = search.trim().replace(/[%_]/g, "");
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order(orderBy, { ascending })
    .range(from, to);

  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    data: (data ?? []) as unknown as VideoWithRelations[],
    count: total,
    hasMore: from + (data?.length ?? 0) < total,
  };
}

export async function getVideoById(id: string): Promise<VideoWithRelations | null> {
  const { data, error } = await supabase
    .from("videos")
    .select(VIDEO_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as VideoWithRelations | null;
}

export async function getRelatedVideos(
  categoryId: string | null,
  excludeId: string,
  limit = 8,
): Promise<VideoWithRelations[]> {
  let query = supabase
    .from("videos")
    .select(VIDEO_SELECT)
    .eq("status", "published")
    .in("visibility", ["public", "preview"])
    .neq("id", excludeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as VideoWithRelations[];
}

export interface CreateVideoInput {
  title: string;
  description: string | null;
  categoryId: string | null;
  videoPath: string;
  thumbnailUrl: string | null;
  duration: number | null;
  isFeatured: boolean;
  status: VideoStatus;
  visibility: VideoVisibility;
  tags: string[];
  uploadedBy: string;
}

export async function createVideo(input: CreateVideoInput) {
  const { data, error } = await supabase
    .from("videos")
    .insert({
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      video_path: input.videoPath,
      thumbnail_url: input.thumbnailUrl,
      duration: input.duration,
      is_featured: input.isFeatured,
      status: input.status,
      visibility: input.visibility,
      tags: input.tags,
      uploaded_by: input.uploadedBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface UpdateVideoInput {
  title?: string;
  description?: string | null;
  categoryId?: string | null;
  videoPath?: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  isFeatured?: boolean;
  status?: VideoStatus;
  visibility?: VideoVisibility;
  tags?: string[];
}

export async function updateVideo(id: string, input: UpdateVideoInput) {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.videoPath !== undefined) patch.video_path = input.videoPath;
  if (input.thumbnailUrl !== undefined) patch.thumbnail_url = input.thumbnailUrl;
  if (input.duration !== undefined) patch.duration = input.duration;
  if (input.isFeatured !== undefined) patch.is_featured = input.isFeatured;
  if (input.status !== undefined) patch.status = input.status;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.tags !== undefined) patch.tags = input.tags;

  const { data, error } = await supabase
    .from("videos")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteVideo(id: string): Promise<void> {
  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function recordVideoView(videoId: string): Promise<void> {
  const { error } = await supabase.rpc("record_video_view", { p_video_id: videoId });
  if (error) throw new Error(error.message);
}

/** Counts grouped by status and visibility, for the admin dashboard. */
export async function getVideoStatusSummary() {
  const { data, error } = await supabase.from("videos").select("status, visibility");
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { status: VideoStatus; visibility: VideoVisibility }[];
  const tally = <T extends string>(key: "status" | "visibility", value: T) =>
    rows.filter((r) => r[key] === value).length;

  return {
    total: rows.length,
    draft: tally("status", "draft"),
    published: tally("status", "published"),
    unpublished: tally("status", "unpublished"),
    archived: tally("status", "archived"),
    publicCount: tally("visibility", "public"),
    privateCount: tally("visibility", "private"),
    previewCount: tally("visibility", "preview"),
  };
}

/** Videos created since the given ISO timestamp (dashboard "uploaded today"). */
export async function countVideosSince(sinceIso: string): Promise<number> {
  const { count, error } = await supabase
    .from("videos")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
