import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { listUsers, updateUserRole } from "@/services/userService";
import type { Profile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatRelativeDate } from "@/lib/utils";
import SearchBar from "@/components/SearchBar";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 15;

export default function AdminManagers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<{ user: Profile; makeManager: boolean } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => setPage(1), [debouncedSearch]);

  async function load() {
    setLoading(true);
    try {
      // Only user/manager accounts can be toggled — Super Admins are never listed here.
      const res = await listUsers({ page, pageSize: PAGE_SIZE, search: debouncedSearch });
      setUsers(res.data.filter((u) => u.role !== "admin"));
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

  async function handleConfirm() {
    if (!target) return;
    setProcessing(true);
    try {
      await updateUserRole(target.user.id, target.makeManager ? "manager" : "user");
      toast({
        title: target.makeManager ? "Manager role granted" : "Manager role removed",
        description: `${target.user.full_name || target.user.email} is now a ${
          target.makeManager ? "manager" : "regular user"
        }.`,
      });
      setTarget(null);
      load();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Managers</h1>
        <p className="text-muted-foreground">
          Assign or remove the Manager role. Managers can upload and manage their own videos.
        </p>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email..." className="max-w-sm" />

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : users.length === 0 ? (
        <EmptyState icon={Shield} title="No users found" />
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "manager" ? "default" : "outline"} className="capitalize">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeDate(u.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.role === "manager" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTarget({ user: u, makeManager: false })}
                        >
                          Remove Manager
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setTarget({ user: u, makeManager: true })}>
                          Make Manager
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target?.makeManager ? "Grant Manager role" : "Remove Manager role"}
        description={
          target?.makeManager
            ? `${target.user.full_name || target.user.email} will be able to upload and manage their own videos.`
            : `${target?.user.full_name || target?.user.email} will lose access to the Manager Dashboard and upload permissions.`
        }
        confirmLabel={target?.makeManager ? "Make Manager" : "Remove Manager"}
        destructive={!target?.makeManager}
        loading={processing}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
