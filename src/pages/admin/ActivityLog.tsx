import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import {
  ACTIVITY_LABELS,
  listActivity,
  type ActivityAction,
} from "@/services/activityService";
import type { AdminActivityLogWithAdmin } from "@/types";
import { formatRelativeDate } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 25;

export default function AdminActivityLog() {
  const [rows, setRows] = useState<AdminActivityLogWithAdmin[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => setPage(1), [action]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    listActivity({ page, pageSize: PAGE_SIZE, action })
      .then((res) => {
        if (!mounted) return;
        setRows(res.data);
        setCount(res.count);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Please check your connection and try again.";
        console.error("[StreamVault] Failed to load activity log:", message);
        setError(message);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [page, action, reloadKey]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-muted-foreground">
          Every administrative action, newest first. Append-only.
        </p>
      </div>

      <Select value={action} onValueChange={setAction}>
        <SelectTrigger className="sm:w-72">
          <SelectValue placeholder="All actions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All actions</SelectItem>
          {(Object.keys(ACTIVITY_LABELS) as ActivityAction[]).map((key) => (
            <SelectItem key={key} value={key}>
              {ACTIVITY_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((n) => n + 1)} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No activity recorded yet"
          description="Administrative actions will appear here as they happen."
        />
      ) : (
        <>
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {ACTIVITY_LABELS[row.action as ActivityAction] ?? row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.admin?.full_name || row.admin?.email || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.target_type ? (
                        <span className="font-mono text-xs">
                          {row.target_type}
                          {row.target_id ? `:${row.target_id.slice(0, 8)}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="line-clamp-1 font-mono text-xs text-muted-foreground">
                        {Object.keys(row.details ?? {}).length
                          ? JSON.stringify(row.details)
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatRelativeDate(row.created_at)}
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
