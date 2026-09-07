import { supabase } from "@/lib/supabase";
import type { AdminActivityLogWithAdmin } from "@/types";

export type ActivityAction =
  | "video.uploaded"
  | "video.edited"
  | "video.deleted"
  | "video.status_changed"
  | "video.visibility_changed"
  | "user.role_changed"
  | "user.activated"
  | "user.deactivated"
  | "category.created"
  | "category.edited"
  | "category.deleted"
  | "settings.updated"
  | "analytics.updated"
  | "adsense.updated";

export const ACTIVITY_LABELS: Record<ActivityAction, string> = {
  "video.uploaded": "Video uploaded",
  "video.edited": "Video edited",
  "video.deleted": "Video deleted",
  "video.status_changed": "Video status changed",
  "video.visibility_changed": "Video visibility changed",
  "user.role_changed": "User role changed",
  "user.activated": "User activated",
  "user.deactivated": "User deactivated",
  "category.created": "Category created",
  "category.edited": "Category edited",
  "category.deleted": "Category deleted",
  "settings.updated": "Settings changed",
  "analytics.updated": "Analytics settings changed",
  "adsense.updated": "AdSense settings changed",
};

/**
 * Appends an admin action to the audit log.
 *
 * Deliberately never throws: an audit write failing must not roll back or
 * mask the operation the admin actually performed. Failures are logged to
 * the console instead. RLS restricts inserts to admins writing rows
 * attributed to themselves.
 */
export async function logActivity(
  action: ActivityAction,
  options: {
    targetType?: string;
    targetId?: string;
    details?: Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const adminId = sessionData.session?.user.id;
    if (!adminId) return;

    const { error } = await supabase.from("admin_activity_logs").insert({
      admin_id: adminId,
      action,
      target_type: options.targetType ?? null,
      target_id: options.targetId ?? null,
      details: options.details ?? {},
    });
    if (error) {
      console.warn("[StreamVault] Could not write activity log:", error.message);
    }
  } catch (err) {
    console.warn("[StreamVault] Could not write activity log:", err);
  }
}

export interface ListActivityOptions {
  page?: number;
  pageSize?: number;
  action?: string;
}

export async function listActivity(options: ListActivityOptions = {}) {
  const { page = 1, pageSize = 25, action } = options;

  let query = supabase
    .from("admin_activity_logs")
    .select("*, admin:profiles ( id, full_name, email )", { count: "exact" });

  if (action && action !== "all") {
    query = query.eq("action", action);
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    data: (data ?? []) as unknown as AdminActivityLogWithAdmin[],
    count: total,
    hasMore: from + (data?.length ?? 0) < total,
  };
}
