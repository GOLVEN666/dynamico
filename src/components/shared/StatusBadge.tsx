import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import type { MovementType } from '@/types';

type Kind = 'product' | 'po' | 'alertStatus' | 'alertType' | 'role' | 'order' | 'source';

const MAPS: Record<Kind, Record<string, { label: string; variant: BadgeVariant }>> = {
  product: {
    active: { label: 'Active', variant: 'success' },
    draft: { label: 'Draft', variant: 'gray' },
    archived: { label: 'Archived', variant: 'gray' },
  },
  po: {
    draft: { label: 'Draft', variant: 'gray' },
    ordered: { label: 'Ordered', variant: 'info' },
    received: { label: 'Received', variant: 'success' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
  },
  alertStatus: {
    active: { label: 'Active', variant: 'danger' },
    resolved: { label: 'Resolved', variant: 'success' },
    dismissed: { label: 'Dismissed', variant: 'gray' },
  },
  alertType: {
    low_stock: { label: 'Low stock', variant: 'warning' },
    out_of_stock: { label: 'Out of stock', variant: 'danger' },
  },
  role: {
    owner: { label: 'Owner', variant: 'brand' },
    admin: { label: 'Admin', variant: 'info' },
    member: { label: 'Member', variant: 'gray' },
    viewer: { label: 'Viewer', variant: 'gray' },
  },
  order: {
    processed: { label: 'Processed', variant: 'success' },
    partial: { label: 'Partial', variant: 'warning' },
    failed: { label: 'Failed', variant: 'danger' },
    duplicate: { label: 'Duplicate', variant: 'gray' },
  },
  source: {
    shopify: { label: 'Shopify', variant: 'success' },
    woocommerce: { label: 'WooCommerce', variant: 'brand' },
    custom: { label: 'Custom', variant: 'gray' },
  },
};

interface StatusBadgeProps {
  kind: Kind;
  status: string;
}

export function StatusBadge({ kind, status }: StatusBadgeProps) {
  const entry = MAPS[kind][status] ?? { label: status, variant: 'gray' as const };
  return (
    <Badge variant={entry.variant} dot={kind === 'po' || kind === 'alertStatus'}>
      {entry.label}
    </Badge>
  );
}

const MOVEMENT_META: Record<
  MovementType,
  { label: string; variant: BadgeVariant; icon: typeof ArrowDownLeft }
> = {
  in: { label: 'Stock in', variant: 'success', icon: ArrowDownLeft },
  out: { label: 'Stock out', variant: 'danger', icon: ArrowUpRight },
  adjustment: { label: 'Adjustment', variant: 'info', icon: SlidersHorizontal },
  transfer_in: { label: 'Transfer in', variant: 'brand', icon: ArrowLeftRight },
  transfer_out: { label: 'Transfer out', variant: 'brand', icon: ArrowLeftRight },
};

export function MovementBadge({ type }: { type: MovementType }) {
  const meta = MOVEMENT_META[type];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}
