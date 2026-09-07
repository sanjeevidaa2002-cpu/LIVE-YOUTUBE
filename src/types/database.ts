export type UserRole = "user" | "manager" | "admin";
export type VideoStatus = "draft" | "published" | "unpublished" | "archived";
export type VideoVisibility = "public" | "private" | "preview";

export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_path: string;
  duration: number | null;
  category_id: string | null;
  uploaded_by: string | null;
  status: VideoStatus;
  visibility: VideoVisibility;
  tags: string[];
  is_featured: boolean;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export interface VideoViewRow {
  id: string;
  video_id: string | null;
  user_id: string | null;
  created_at: string;
}

// Minimal typed surface for the supabase-js client. We keep this hand-rolled
// (rather than generated) so the project has zero dependency on the
// Supabase CLI to build; it mirrors supabase/schema.sql exactly.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
      };
      categories: {
        Row: CategoryRow;
        Insert: Partial<CategoryRow> & { name: string; slug: string };
        Update: Partial<CategoryRow>;
      };
      videos: {
        Row: VideoRow;
        Insert: Partial<VideoRow> & { title: string; video_path: string };
        Update: Partial<VideoRow>;
      };
      video_views: {
        Row: VideoViewRow;
        Insert: Partial<VideoViewRow>;
        Update: Partial<VideoViewRow>;
      };
    };
    Functions: {
      record_video_view: {
        Args: { p_video_id: string };
        Returns: void;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_manager_or_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
}

export interface SiteSettingsRow {
  id: number;
  site_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  description: string | null;
  default_theme: "dark" | "light";
  maintenance_mode: boolean;
  allow_signup: boolean;
  default_video_visibility: VideoVisibility;
  enable_analytics: boolean;
  enable_adsense: boolean;
  updated_at: string;
}

export interface AnalyticsSettingsRow {
  id: number;
  ga_measurement_id: string | null;
  enabled: boolean;
  updated_at: string;
}

export interface AdsenseSettingsRow {
  id: number;
  publisher_id: string | null;
  ad_slot_video_list: string | null;
  ad_slot_between_cards: string | null;
  ad_slot_video_details: string | null;
  ad_slot_below_player: string | null;
  enabled: boolean;
  show_on_video_list: boolean;
  show_between_cards: boolean;
  show_on_video_details: boolean;
  show_below_player: boolean;
  updated_at: string;
}

export interface AdminActivityLogRow {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
