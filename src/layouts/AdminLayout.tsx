import {
  BarChart3,
  FolderTree,
  LayoutDashboard,
  Settings,
  Shield,
  UploadCloud,
  Users,
  Video,
} from "lucide-react";
import DashboardLayout, { type DashboardNavItem } from "./DashboardLayout";

const navItems: DashboardNavItem[] = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Videos", to: "/admin/videos", icon: Video },
  { label: "Upload Video", to: "/admin/videos/upload", icon: UploadCloud },
  { label: "Categories", to: "/admin/categories", icon: FolderTree },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Managers", to: "/admin/managers", icon: Shield },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

export default function AdminLayout() {
  return <DashboardLayout navItems={navItems} roleLabel="Super Admin" />;
}
