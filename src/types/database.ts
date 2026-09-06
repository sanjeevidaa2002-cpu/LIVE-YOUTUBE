export type UserRole = "user" | "manager" | "admin";
export type VideoStatus = "published" | "draft" | "archived";

export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
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
