import { Skeleton } from "@/components/ui/skeleton";

export default function VideoCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="space-y-2 px-0.5">
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
