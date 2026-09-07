import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { analytics, isAnalyticsLoaded, loadAnalytics } from "@/lib/analytics";
import { isValidMeasurementId } from "@/services/settingsService";

/**
 * Mounts once inside the router. Loads GA4 only when an administrator has
 * enabled analytics AND saved a well-formed measurement ID, then reports a
 * page_view on each route change. Renders nothing.
 */
export default function AnalyticsLoader() {
  const { analytics: settings, site } = useSiteSettings();
  const location = useLocation();

  const enabled =
    !!settings?.enabled &&
    !!site?.enable_analytics &&
    !!settings.ga_measurement_id &&
    isValidMeasurementId(settings.ga_measurement_id);

  useEffect(() => {
    if (enabled && settings?.ga_measurement_id) {
      loadAnalytics(settings.ga_measurement_id.trim());
    }
  }, [enabled, settings?.ga_measurement_id]);

  useEffect(() => {
    if (!enabled || !isAnalyticsLoaded()) return;
    analytics.pageView(location.pathname + location.search, document.title);
  }, [enabled, location.pathname, location.search]);

  return null;
}
