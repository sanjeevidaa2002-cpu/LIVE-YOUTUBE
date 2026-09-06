import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, Menu, PlayCircle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DashboardNavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

interface DashboardLayoutProps {
  navItems: DashboardNavItem[];
  roleLabel: string;
  children?: ReactNode;
}

export default function DashboardLayout({ navItems, roleLabel }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const initials = (profile?.full_name || profile?.email || "U").charAt(0).toUpperCase();

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <PlayCircle className="h-7 w-7 text-primary" />
        <div>
          <p className="text-sm font-bold leading-none">StreamVault</p>
          <Badge variant="secondary" className="mt-1 text-[10px]">
            {roleLabel}
          </Badge>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <div className="mb-3 flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile?.full_name || "User"}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border md:block">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-card animate-slide-up">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-3 text-muted-foreground"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border px-4 md:hidden">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <PlayCircle className="h-6 w-6 text-primary" />
            <span className="font-bold">StreamVault</span>
          </Link>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
