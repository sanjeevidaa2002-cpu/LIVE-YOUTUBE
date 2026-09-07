import { useEffect, useState } from "react";
import { Loader2, ShieldPlus, ShieldMinus, Users as UsersIcon } from "lucide-react";
import {
  countActiveAdmins,
  listUsers,
  setUserActive,
  updateUserRole,
  type UserStatusFilter,
} from "@/services/userService";
import { logActivity } from "@/services/activityService";
import type { Profile, UserRole } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatRelativeDate } from "@/lib/utils";
import SearchBar from "@/components/SearchBar";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import Pagination from "@/components/Pagination";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [viewing, setViewing] = useState<Profile | null>(null);
  const [roleTarget, setRoleTarget] = useState<{ user: Profile; nextRole: UserRole } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => setPage(1), [debouncedSearch, roleFilter, statusFilter, pageSize]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    listUsers({
      page,
      pageSize,
      search: debouncedSearch,
      role: roleFilter,
      status: statusFilter,
    })
      .then((res) => {
        if (!mounted) return;
        setUsers(res.data);
        setCount(res.count);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Please check your connection and try again.";
        console.error("[StreamVault] Failed to load users:", message);
        setError(message);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [page, pageSize, debouncedSearch, roleFilter, statusFilter, reloadKey]);

  const refresh = () => setReloadKey((n) => n + 1);

  async function toggleActive(u: Profile) {
    if (u.id === currentUser?.id) {
      toast({ variant: "destructive", title: "You cannot deactivate your own account." });
      return;
    }
    setUpdatingId(u.id);
    try {
      // Guard the last Super Admin before attempting the write. The database
      // enforces this too (prevent_last_admin_removal trigger); this check
      // simply gives a clearer message than the raised exception.
      if (u.role === "admin" && u.is_active) {
        const admins = await countActiveAdmins();
        if (admins <= 1) {
          toast({
            variant: "destructive",
            title: "Cannot deactivate the last Super Admin",
            description: "Promote another administrator first.",
          });
          return;
        }
      }

      await setUserActive(u.id, !u.is_active);
      setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, is_active: !p.is_active } : p)));
      await logActivity(u.is_active ? "user.deactivated" : "user.activated", {
        targetType: "user",
        targetId: u.id,
        details: { email: u.email },
      });
      toast({ title: u.is_active ? "User deactivated" : "User activated" });
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

  async function confirmRoleChange() {
    if (!roleTarget) return;
    const { user: u, nextRole } = roleTarget;
    setProcessing(true);
    try {
      if (u.role === "admin" && nextRole !== "admin") {
        const admins = await countActiveAdmins();
        if (admins <= 1) {
          toast({
            variant: "destructive",
            title: "Cannot demote the last Super Admin",
            description: "Promote another administrator first.",
          });
          return;
        }
      }

      await updateUserRole(u.id, nextRole);
      await logActivity("user.role_changed", {
        targetType: "user",
        targetId: u.id,
        details: { email: u.email, from: u.role, to: nextRole },
      });
      toast({
        title: "Role updated",
        description: `${u.full_name || u.email} is now a ${nextRole}.`,
      });
      setRoleTarget(null);
      refresh();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Role change failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          Every registered account. Only administrators can change roles.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name or email..."
          className="lg:max-w-sm"
        />
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole | "all")}>
          <SelectTrigger className="lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="manager">Managers</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as UserStatusFilter)}>
          <SelectTrigger className="lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="lg:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users found" description="Try a different filter." />
      ) : (
        <>
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const initial = (u.full_name || u.email || "U").charAt(0).toUpperCase();
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.full_name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.role === "admin" ? "default" : u.role === "manager" ? "warning" : "outline"
                          }
                          className="capitalize"
                        >
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.is_active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatRelativeDate(u.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {u.last_active_at ? formatRelativeDate(u.last_active_at) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setViewing(u)}>
                            View
                          </Button>
                          {u.role !== "admin" &&
                            (u.role === "manager" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRoleTarget({ user: u, nextRole: "user" })}
                              >
                                <ShieldMinus className="h-4 w-4" />
                                Remove Manager
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => setRoleTarget({ user: u, nextRole: "manager" })}
                              >
                                <ShieldPlus className="h-4 w-4" />
                                Make Manager
                              </Button>
                            ))}
                          <Switch
                            checked={u.is_active}
                            disabled={updatingId === u.id || isSelf}
                            onCheckedChange={() => toggleActive(u)}
                            aria-label={u.is_active ? "Deactivate user" : "Activate user"}
                          />
                          {updatingId === u.id && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={pageSize} count={count} onPageChange={setPage} />
        </>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <dl className="space-y-3 text-sm">
              {[
                ["Name", viewing.full_name || "—"],
                ["Email", viewing.email || "—"],
                ["Role", viewing.role],
                ["Status", viewing.is_active ? "Active" : "Inactive"],
                ["Joined", new Date(viewing.created_at).toLocaleString()],
                [
                  "Last activity",
                  viewing.last_active_at
                    ? new Date(viewing.last_active_at).toLocaleString()
                    : "Never recorded",
                ],
                ["User ID", viewing.id],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-all text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!roleTarget}
        onOpenChange={(o) => !o && setRoleTarget(null)}
        title={roleTarget?.nextRole === "manager" ? "Grant Manager role" : "Remove Manager role"}
        description={
          roleTarget?.nextRole === "manager"
            ? `${roleTarget.user.full_name || roleTarget.user.email} will be able to upload and manage their own videos.`
            : `${roleTarget?.user.full_name || roleTarget?.user.email} will lose access to the Manager Dashboard and upload permissions.`
        }
        confirmLabel={roleTarget?.nextRole === "manager" ? "Make Manager" : "Remove Manager"}
        destructive={roleTarget?.nextRole !== "manager"}
        loading={processing}
        onConfirm={confirmRoleChange}
      />
    </div>
  );
}
