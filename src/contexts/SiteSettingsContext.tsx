import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getAdsenseSettings,
  getAnalyticsSettings,
  getSiteSettings,
} from "@/services/settingsService";
import type { AdsenseSettings, AnalyticsSettings, SiteSettings } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

interface SiteSettingsValue {
  site: SiteSettings | null;
  analytics: AnalyticsSettings | null;
  adsense: AdsenseSettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SiteSettingsContext = createContext<SiteSettingsValue | undefined>(undefined);

/**
 * Loads the three settings singletons once per session.
 *
 * Every failure here is swallowed to null: analytics, ads and cosmetic
 * settings are strictly optional, and the video platform must keep working
 * when the settings tables are missing (migration not yet run), unreadable,
 * or the network is down.
 */
export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [site, setSite] = useState<SiteSettings | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSettings | null>(null);
  const [adsense, setAdsense] = useState<AdsenseSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setSite(null);
      setAnalytics(null);
      setAdsense(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [s, a, ad] = await Promise.all([
      getSiteSettings().catch(() => null),
      getAnalyticsSettings().catch(() => null),
      getAdsenseSettings().catch(() => null),
    ]);
    setSite(s);
    setAnalytics(a);
    setAdsense(ad);
    setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<SiteSettingsValue>(
    () => ({ site, analytics, adsense, loading, refresh: load }),
    [site, analytics, adsense, loading, load],
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used within a SiteSettingsProvider");
  return ctx;
}
