import { supabase } from "@/lib/supabase";
import type { AdsenseSettings, AnalyticsSettings, SiteSettings } from "@/types";

// Each settings table holds exactly one row, id = 1.
const SINGLETON_ID = 1;

export async function getSiteSettings(): Promise<SiteSettings | null> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", SINGLETON_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSiteSettings(
  patch: Partial<Omit<SiteSettings, "id" | "updated_at">>,
): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .update(patch)
    .eq("id", SINGLETON_ID)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getAnalyticsSettings(): Promise<AnalyticsSettings | null> {
  const { data, error } = await supabase
    .from("analytics_settings")
    .select("*")
    .eq("id", SINGLETON_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAnalyticsSettings(
  patch: Partial<Omit<AnalyticsSettings, "id" | "updated_at">>,
): Promise<AnalyticsSettings> {
  const { data, error } = await supabase
    .from("analytics_settings")
    .update(patch)
    .eq("id", SINGLETON_ID)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getAdsenseSettings(): Promise<AdsenseSettings | null> {
  const { data, error } = await supabase
    .from("adsense_settings")
    .select("*")
    .eq("id", SINGLETON_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAdsenseSettings(
  patch: Partial<Omit<AdsenseSettings, "id" | "updated_at">>,
): Promise<AdsenseSettings> {
  const { data, error } = await supabase
    .from("adsense_settings")
    .update(patch)
    .eq("id", SINGLETON_ID)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** GA4 measurement IDs look like G-XXXXXXXXXX. */
export function isValidMeasurementId(value: string): boolean {
  return /^G-[A-Z0-9]{6,}$/i.test(value.trim());
}

/** AdSense publisher IDs look like ca-pub-0000000000000000. */
export function isValidPublisherId(value: string): boolean {
  return /^ca-pub-\d{10,20}$/i.test(value.trim());
}
