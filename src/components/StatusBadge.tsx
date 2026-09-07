import { Badge } from "@/components/ui/badge";
import type { VideoStatus } from "@/types";

const CONFIG: Record<
  VideoStatus,
  { label: string; variant: "success" | "warning" | "secondary" | "outline" }
> = {
  published: { label: "Published", variant: "success" },
  draft: { label: "Draft", variant: "warning" },
  unpublished: { label: "Unpublished", variant: "secondary" },
  archived: { label: "Archived", variant: "outline" },
};

export default function StatusBadge({ status }: { status: VideoStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.draft;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
