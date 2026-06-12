import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  Building2,
  ClipboardList,
  History,
  Package,
  Tag,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import type { ActivityLog } from '@/types';
import { timeAgo } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/shared/EmptyState';

const ENTITY_ICONS: Record<string, LucideIcon> = {
  products: Package,
  suppliers: Truck,
  warehouses: Warehouse,
  categories: Tag,
  purchase_orders: ClipboardList,
  stock_movements: ArrowLeftRight,
  workspace_members: Users,
  workspaces: Building2,
};

const ENTITY_LABELS: Record<string, string> = {
  products: 'product',
  suppliers: 'supplier',
  warehouses: 'warehouse',
  categories: 'category',
  purchase_orders: 'purchase order',
  workspace_members: 'team member',
  workspaces: 'workspace',
};

function describe(log: ActivityLog): string {
  const d = log.details;
  const subject = d.name ?? d.po_number ?? d.sku;
  const quoted = subject ? ` “${subject}”` : '';

  if (log.entity_type === 'stock_movements') {
    const qty = d.quantity ?? '?';
    switch (d.type) {
      case 'in':
        return `recorded stock in: +${qty}×${quoted}`;
      case 'out':
        return `recorded stock out: −${qty}×${quoted}`;
      case 'adjustment':
        return `adjusted stock by ${qty}${quoted}`;
      case 'transfer_in':
        return `transferred in ${qty}×${quoted}`;
      case 'transfer_out':
        return `transferred out ${qty}×${quoted}`;
      default:
        return `recorded a stock movement${quoted}`;
    }
  }

  const verb = log.action.endsWith('.created')
    ? 'created'
    : log.action.endsWith('.updated')
      ? 'updated'
      : log.action.endsWith('.deleted')
        ? 'removed'
        : 'changed';

  if (log.entity_type === 'workspace_members') {
    const role = d.role ? ` (${d.role})` : '';
    if (verb === 'created') return `added a team member${role}`;
    if (verb === 'removed') return 'removed a team member';
    return `changed a member's role${role}`;
  }

  const entity = ENTITY_LABELS[log.entity_type] ?? log.entity_type;
  return `${verb} ${entity}${quoted}`;
}

interface ActivityFeedProps {
  logs: ActivityLog[] | undefined;
  loading?: boolean;
  emptyText?: string;
}

export function ActivityFeed({ logs, loading, emptyText = 'No activity yet' }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <EmptyState
        icon={History}
        title={emptyText}
        description="Actions across your workspace will show up here."
        className="py-8"
      />
    );
  }

  return (
    <ol className="space-y-1">
      {logs.map((log) => {
        const Icon = ENTITY_ICONS[log.entity_type] ?? History;
        const actor = log.user?.full_name || log.user?.email || 'Someone';
        return (
          <li key={log.id} className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-50">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
              <Icon className="h-4 w-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-gray-600">
                <span className="font-medium text-gray-900">{actor}</span> {describe(log)}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">{timeAgo(log.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
