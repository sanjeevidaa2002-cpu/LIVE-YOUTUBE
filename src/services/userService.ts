import { supabase } from "@/lib/supabase";
import type { Profile, UserRole } from "@/types";

export type UserStatusFilter = "all" | "active" | "inactive";

export interface ListUsersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: UserRole | "all";
  status?: UserStatusFilter;
}

export async function listUsers(options: ListUsersOptions = {}) {
  const { page = 1, pageSize = 20, search, role = "all", status = "all" } = options;

  let query = supabase.from("profiles").select("*", { count: "exact" });

  if (role !== "all") {
    query = query.eq("role", role);
  }
  if (status !== "all") {
    query = query.eq("is_active", status === "active");
  }
  if (search && search.trim()) {
    const term = search.trim().replace(/[%_]/g, "");
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    data: (data ?? []) as Profile[],
    count: total,
    hasMore: from + (data?.length ?? 0) < total,
  };
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function updateOwnProfile(
  userId: string,
  input: { full_name?: string; avatar_url?: string | null },
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(input)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getUserCounts() {
  const [{ count: totalUsers }, { count: totalManagers }, { count: totalAdmins }] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user"),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "manager"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin"),
    ]);

  return {
    totalUsers: totalUsers ?? 0,
    totalManagers: totalManagers ?? 0,
    totalAdmins: totalAdmins ?? 0,
  };
}

/** Users registered since the given ISO timestamp (dashboard "new users"). */
export async function countUsersSince(sinceIso: string): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Records that the signed-in user is active right now. Best effort. */
export async function touchLastActive(): Promise<void> {
  const { error } = await supabase.rpc("touch_last_active");
  if (error) console.warn("[StreamVault] touch_last_active failed:", error.message);
}

export async function getUserById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** How many active admins exist — used to protect the last Super Admin. */
export async function countActiveAdmins(): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
