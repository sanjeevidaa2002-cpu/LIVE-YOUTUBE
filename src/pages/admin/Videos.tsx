import { Link } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoManagementTable from "@/components/VideoManagementTable";

export default function AdminVideos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Videos</h1>
          <p className="text-muted-foreground">Manage every video across the platform.</p>
        </div>
        <Button asChild>
          <Link to="/admin/videos/upload">
            <UploadCloud className="h-4 w-4" />
            Upload Video
          </Link>
        </Button>
      </div>
      <VideoManagementTable basePath="/admin/videos" showUploaderColumn />
    </div>
  );
}
