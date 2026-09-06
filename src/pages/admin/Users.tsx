import { useEffect, useState } from "react";
import { Users as UsersIcon } from "lucide-react";
import { listUsers, setUserActive } from "@/services/userService";
import type { Profile } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatRelativeDate } from "@/lib/utils";
import SearchBar from "@/components/SearchBar";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 15;

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => setPage(1), [debouncedSearch]);

  async function load() {
    setLoading(true);
    try {
      const res = await listUsers({ page, pageSize: PAGE_SIZE, search: debouncedSearch });
      setUsers(res.data);
      setCount(res.count);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to load users" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  async function toggleActive(u: Profile) {
    if (u.id === currentUser?.id) {
      toast({ variant: "destructive", title: "You cannot deactivate your own account." });
      return;
    }
    if (u.role === "admin") {
      toast({ variant: "destructive", title: "Super Admin accounts cannot be deactivated here." });
      return;
    }
    setUpdatingId(u.id);
    try {
      await setUserActive(u.id, !u.is_active);
      setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, is_active: !p.is_active } : p)));
      toast({ title: !u.is_active ? "User activated" : "User deactivated" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">View and manage all platform users.</p>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email..." className="max-w-sm" />

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users found" />
      ) : (
        <>
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeDate(u.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={u.is_active}
                        disabled={updatingId === u.id || u.id === currentUser?.id || u.role === "admin"}
                        onCheckedChange={() => toggleActive(u)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
