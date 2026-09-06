import type { CategoryRow, ProfileRow, UserRole, VideoRow, VideoStatus } from "./database";

export type { UserRole, VideoStatus };

export type Profile = ProfileRow;
export type Category = CategoryRow;
export type Video = VideoRow;

export interface VideoWithRelations extends Video {
  category: Pick<Category, "id" | "name" | "slug"> | null;
  uploader: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  hasMore: boolean;
}

export interface VideoFormValues {
  title: string;
  description: string;
  categoryId: string;
  isFeatured: boolean;
  status: VideoStatus;
  videoFile: File | null;
  thumbnailFile: File | null;
}
