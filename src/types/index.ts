import type {
  AdminActivityLogRow,
  AdsenseSettingsRow,
  AnalyticsSettingsRow,
  CategoryRow,
  ProfileRow,
  SiteSettingsRow,
  UserRole,
  VideoRow,
  VideoStatus,
  VideoVisibility,
} from "./database";

export type { UserRole, VideoStatus, VideoVisibility };

export type Profile = ProfileRow;
export type Category = CategoryRow;
export type Video = VideoRow;
export type SiteSettings = SiteSettingsRow;
export type AnalyticsSettings = AnalyticsSettingsRow;
export type AdsenseSettings = AdsenseSettingsRow;
export type AdminActivityLog = AdminActivityLogRow;

export interface AdminActivityLogWithAdmin extends AdminActivityLog {
  admin: Pick<Profile, "id" | "full_name" | "email"> | null;
}

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
  visibility: VideoVisibility;
  tags: string[];
  videoFile: File | null;
  thumbnailFile: File | null;
}
