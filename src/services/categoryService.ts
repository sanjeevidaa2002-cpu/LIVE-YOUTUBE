import { supabase } from "@/lib/supabase";
import type { Category } from "@/types";
import { slugify } from "@/lib/utils";

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createCategory(input: {
  name: string;
  description?: string;
}): Promise<Category> {
  const slug = slugify(input.name);
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: input.name, slug, description: input.description ?? null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCategory(
  id: string,
  input: { name?: string; description?: string },
): Promise<Category> {
  const patch: Partial<Category> = { ...input };
  if (input.name) patch.slug = slugify(input.name);
  const { data, error } = await supabase
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
