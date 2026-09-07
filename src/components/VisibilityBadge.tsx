import { Eye, Globe, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VideoVisibility } from "@/types";

const CONFIG: Record<
  VideoVisibility,
  { label: string; variant: "success" | "warning" | "destructive"; icon: typeof Globe }
> = {
  public: { label: "Public", variant: "success", icon: Globe },
  preview: { label: "Preview", variant: "warning", icon: Eye },
  private: { label: "Private", variant: "destructive", icon: Lock },
};

export default function VisibilityBadge({ visibility }: { visibility: VideoVisibility }) {
  const cfg = CONFIG[visibility] ?? CONFIG.public;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}
