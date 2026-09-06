import { LayoutDashboard, User, UploadCloud, Video } from "lucide-react";
import DashboardLayout, { type DashboardNavItem } from "./DashboardLayout";

const navItems: DashboardNavItem[] = [
  { label: "Dashboard", to: "/manager", icon: LayoutDashboard, end: true },
  { label: "Videos", to: "/manager/videos", icon: Video },
  { label: "Upload Video", to: "/manager/videos/upload", icon: UploadCloud },
  { label: "Profile", to: "/manager/profile", icon: User },
];

export default function ManagerLayout() {
  return <DashboardLayout navItems={navItems} roleLabel="Manager" />;
}
