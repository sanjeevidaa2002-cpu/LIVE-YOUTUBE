import { Link } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import VideoManagementTable from "@/components/VideoManagementTable";

export default function ManagerVideos() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Videos</h1>
          <p className="text-muted-foreground">Manage the videos you've uploaded.</p>
        </div>
        <Button asChild>
          <Link to="/manager/videos/upload">
            <UploadCloud className="h-4 w-4" />
            Upload Video
          </Link>
        </Button>
      </div>
      {user && <VideoManagementTable basePath="/manager/videos" uploaderId={user.id} />}
    </div>
  );
}
