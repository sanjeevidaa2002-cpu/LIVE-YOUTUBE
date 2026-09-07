import { useEffect, useState, type FormEvent } from "react";
import { DollarSign, Info, Loader2 } from "lucide-react";
import {
  getAdsenseSettings,
  isValidPublisherId,
  updateAdsenseSettings,
} from "@/services/settingsService";
import { logActivity } from "@/services/activityService";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorState from "@/components/ErrorState";

interface SlotField {
  key: "ad_slot_video_list" | "ad_slot_between_cards" | "ad_slot_video_details" | "ad_slot_below_player";
  toggle: "show_on_video_list" | "show_between_cards" | "show_on_video_details" | "show_below_player";
  label: string;
  help: string;
}

const SLOTS: SlotField[] = [
  {
    key: "ad_slot_video_list",
    toggle: "show_on_video_list",
    label: "Before video list",
    help: "Above the grid on the Browse page.",
  },
  {
    key: "ad_slot_between_cards",
    toggle: "show_between_cards",
    label: "Between video cards",
    help: "Inserted once partway down the video grid.",
  },
  {
    key: "ad_slot_video_details",
    toggle: "show_on_video_details",
    label: "Video details page",
    help: "In the sidebar beside related videos.",
  },
  {
    key: "ad_slot_below_player",
    toggle: "show_below_player",
    label: "Below video player",
    help: "Under the player, never overlapping controls.",
  },
];

export default function AdminAdSense() {
  const { toast } = useToast();
  const { refresh } = useSiteSettings();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);

  const [publisherId, setPublisherId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getAdsenseSettings()
      .then((s) => {
        if (!mounted || !s) return;
        setPublisherId(s.publisher_id ?? "");
        setEnabled(s.enabled);
        setSlots({
          ad_slot_video_list: s.ad_slot_video_list ?? "",
          ad_slot_between_cards: s.ad_slot_between_cards ?? "",
          ad_slot_video_details: s.ad_slot_video_details ?? "",
          ad_slot_below_player: s.ad_slot_below_player ?? "",
        });
        setToggles({
          show_on_video_list: s.show_on_video_list,
          show_between_cards: s.show_between_cards,
          show_on_video_details: s.show_on_video_details,
          show_below_player: s.show_below_player,
        });
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Please check your connection and try again.";
        console.error("[StreamVault] Failed to load AdSense settings:", message);
        setError(message);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setIdError(null);

    const trimmed = publisherId.trim();
    if (trimmed && !isValidPublisherId(trimmed)) {
      setIdError("Publisher ID must look like ca-pub-0000000000000000.");
      return;
    }
    if (enabled && !trimmed) {
      setIdError("Add a publisher ID before enabling ads.");
      return;
    }

    setSaving(true);
    try {
      await updateAdsenseSettings({
        publisher_id: trimmed || null,
        enabled,
        ad_slot_video_list: slots.ad_slot_video_list?.trim() || null,
        ad_slot_between_cards: slots.ad_slot_between_cards?.trim() || null,
        ad_slot_video_details: slots.ad_slot_video_details?.trim() || null,
        ad_slot_below_player: slots.ad_slot_below_player?.trim() || null,
        show_on_video_list: !!toggles.show_on_video_list,
        show_between_cards: !!toggles.show_between_cards,
        show_on_video_details: !!toggles.show_on_video_details,
        show_below_player: !!toggles.show_below_player,
      });
      await logActivity("adsense.updated", {
        targetType: "settings",
        details: { enabled, configured: !!trimmed },
      });
      await refresh();
      toast({
        title: "AdSense settings saved",
        description: enabled ? "Ads will render where slots are configured." : "Ads are disabled.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not save AdSense settings",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  const configured = isValidPublisherId(publisherId.trim());

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Google AdSense</h1>
        <p className="text-muted-foreground">
          Optional monetisation. The site works exactly the same with ads off.
        </p>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((n) => n + 1)} />
      ) : loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" /> Account
              </CardTitle>
              <CardDescription>
                {configured
                  ? "Publisher ID looks valid."
                  : "AdSense is not configured. No ad script will be loaded."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pub-id">AdSense Publisher ID</Label>
                <Input
                  id="pub-id"
                  value={publisherId}
                  onChange={(e) => setPublisherId(e.target.value)}
                  placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                  className="font-mono"
                  disabled={saving}
                />
                {idError && <p className="text-sm text-destructive">{idError}</p>}
              </div>

              <div className="flex items-center gap-2">
                <Switch id="ads-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
                <Label htmlFor="ads-enabled" className="cursor-pointer font-normal">
                  Enable ads across the site
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ad placements</CardTitle>
              <CardDescription>
                Each placement needs its own slot ID and must be switched on individually.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {SLOTS.map((slot) => (
                <div key={slot.key} className="space-y-2 rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Label htmlFor={slot.key}>{slot.label}</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">{slot.help}</p>
                    </div>
                    <Switch
                      checked={!!toggles[slot.toggle]}
                      onCheckedChange={(v) => setToggles((t) => ({ ...t, [slot.toggle]: v }))}
                      disabled={saving}
                      aria-label={`Enable ${slot.label}`}
                    />
                  </div>
                  <Input
                    id={slot.key}
                    value={slots[slot.key] ?? ""}
                    onChange={(e) => setSlots((sl) => ({ ...sl, [slot.key]: e.target.value }))}
                    placeholder="Ad slot ID"
                    className="font-mono"
                    disabled={saving}
                  />
                </div>
              ))}

              <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Ads never render inside player controls or over navigation, so playback and
                  browsing are never obstructed. Do not encourage clicks or generate impressions
                  artificially — doing so violates Google&apos;s AdSense policies and risks your
                  account.
                </p>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save AdSense Settings
          </Button>
        </form>
      )}
    </div>
  );
}
