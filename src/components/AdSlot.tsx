import { useEffect, useRef, useState } from "react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { isValidPublisherId } from "@/services/settingsService";

export type AdPlacement =
  | "video_list"
  | "between_cards"
  | "video_details"
  | "below_player";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const SCRIPT_ID = "streamvault-adsense";

function ensureScript(publisherId: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(SCRIPT_ID)) return;
  try {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
    // Ad blockers and network failures are expected; never break the page.
    script.onerror = () =>
      console.warn("[StreamVault] AdSense script did not load; continuing without ads.");
    document.head.appendChild(script);
  } catch (err) {
    console.warn("[StreamVault] Could not initialise AdSense:", err);
  }
}

/**
 * Renders a Google AdSense unit, but only when an administrator has
 * enabled ads, saved a valid publisher ID, saved a slot ID for this
 * placement, and enabled this specific placement.
 *
 * When anything is missing the component renders nothing at all — the
 * video platform is fully functional with ads switched off.
 *
 * Placements are deliberately limited to areas that sit outside the
 * player and navigation, so ads never overlay controls or obstruct
 * playback, per Google's policies. Nothing here induces clicks or
 * manufactures impressions.
 */
export default function AdSlot({
  placement,
  className,
}: {
  placement: AdPlacement;
  className?: string;
}) {
  const { adsense, site } = useSiteSettings();
  const insRef = useRef<HTMLModElement>(null);
  const [pushed, setPushed] = useState(false);

  const slotId =
    placement === "video_list"
      ? adsense?.ad_slot_video_list
      : placement === "between_cards"
        ? adsense?.ad_slot_between_cards
        : placement === "video_details"
          ? adsense?.ad_slot_video_details
          : adsense?.ad_slot_below_player;

  const placementEnabled =
    placement === "video_list"
      ? adsense?.show_on_video_list
      : placement === "between_cards"
        ? adsense?.show_between_cards
        : placement === "video_details"
          ? adsense?.show_on_video_details
          : adsense?.show_below_player;

  const publisherId = adsense?.publisher_id?.trim() ?? "";
  const active =
    !!site?.enable_adsense &&
    !!adsense?.enabled &&
    !!placementEnabled &&
    !!slotId &&
    isValidPublisherId(publisherId);

  useEffect(() => {
    if (!active) return;
    ensureScript(publisherId);
    if (pushed || !insRef.current) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      setPushed(true);
    } catch (err) {
      console.warn("[StreamVault] AdSense slot could not be filled:", err);
    }
  }, [active, publisherId, pushed]);

  if (!active) return null;

  return (
    <div className={className} aria-label="Advertisement">
      <ins
        ref={insRef}
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={publisherId}
        data-ad-slot={slotId as string}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
