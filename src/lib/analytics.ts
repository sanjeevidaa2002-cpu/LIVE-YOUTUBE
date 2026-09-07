/**
 * Google Analytics 4 loader and event helpers.
 *
 * The tag is injected only when an administrator has both enabled
 * analytics and saved a valid measurement ID. Nothing is loaded, and no
 * request leaves the browser, otherwise — the site works identically with
 * analytics switched off.
 *
 * Never pass passwords, tokens, email addresses or other personal data to
 * these helpers; the event payloads below are limited to IDs and titles.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const SCRIPT_ID = "streamvault-ga4";
let loadedMeasurementId: string | null = null;

export function isAnalyticsLoaded(): boolean {
  return loadedMeasurementId !== null;
}

export function loadAnalytics(measurementId: string): void {
  if (typeof document === "undefined") return;
  if (loadedMeasurementId === measurementId) return;
  if (document.getElementById(SCRIPT_ID)) return;

  try {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    // A blocked or failed tag must never break the app.
    script.onerror = () => {
      console.warn("[StreamVault] Google Analytics failed to load; continuing without it.");
      loadedMeasurementId = null;
    };
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { send_page_view: false });

    loadedMeasurementId = measurementId;
  } catch (err) {
    console.warn("[StreamVault] Could not initialise Google Analytics:", err);
  }
}

function track(event: string, params: Record<string, unknown> = {}): void {
  if (!loadedMeasurementId || typeof window.gtag !== "function") return;
  try {
    window.gtag("event", event, params);
  } catch (err) {
    console.warn("[StreamVault] Analytics event failed:", err);
  }
}

export const analytics = {
  pageView: (path: string, title?: string) =>
    track("page_view", { page_path: path, page_title: title }),
  videoPlay: (videoId: string, title: string) =>
    track("video_play", { video_id: videoId, video_title: title }),
  videoProgress: (videoId: string, percent: number) =>
    track("video_progress", { video_id: videoId, percent }),
  videoComplete: (videoId: string) => track("video_complete", { video_id: videoId }),
  search: (term: string) => track("search", { search_term: term }),
  login: () => track("login", { method: "password" }),
  signup: () => track("sign_up", { method: "password" }),
};
