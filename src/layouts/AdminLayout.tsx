import {
  BarChart3,
  DollarSign,
  FolderTree,
  LayoutDashboard,
  ScrollText,
  Settings,
  Shield,
  UploadCloud,
  User,
  Users,
  Video,
} from "lucide-react";
import DashboardLayout, { type DashboardNavItem } from "./DashboardLayout";

const navItems: DashboardNavItem[] = [
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Managers", to: "/admin/managers", icon: Shield },
  { label: "Videos", to: "/admin/videos", icon: Video, end: true },
  { label: "Upload Video", to: "/admin/videos/upload", icon: UploadCloud },
  { label: "Categories", to: "/admin/categories", icon: FolderTree },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Google AdSense", to: "/admin/adsense", icon: DollarSign },
  { label: "Settings", to: "/admin/settings", icon: Settings },
  { label: "Activity Log", to: "/admin/activity", icon: ScrollText },
  { label: "Admin Profile", to: "/admin/profile", icon: User },
];

export default function AdminLayout() {
  return <DashboardLayout navItems={navItems} roleLabel="Super Admin" />;
}
