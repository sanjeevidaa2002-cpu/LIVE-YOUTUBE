import { Link, Outlet } from "react-router-dom";
import { PlayCircle } from "lucide-react";

export default function AuthLayout() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <PlayCircle className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold tracking-tight">StreamVault</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 shadow-xl animate-slide-up">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
