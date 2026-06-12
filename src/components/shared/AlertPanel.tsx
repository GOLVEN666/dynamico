import { Link } from 'react-router-dom';
import { Check, CheckCircle2, PackageX, TriangleAlert, X } from 'lucide-react';
import type { Alert } from '@/types';
import { cn, timeAgo } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

interface AlertPanelProps {
  alerts: Alert[] | undefined;
  loading?: boolean;
  onResolve?: (alert: Alert) => void;
  onDismiss?: (alert: Alert) => void;
}

/** Compact list of active stock alerts with resolve/dismiss actions. */
export function AlertPanel({ alerts, loading, onResolve, onDismiss }: AlertPanelProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>
        <p className="mt-3 text-[15px] font-semibold text-gray-900">All clear</p>
        <p className="mt-1 text-[13px] text-gray-500">No active stock alerts right now.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {alerts.map((alert) => {
        const isOut = alert.type === 'out_of_stock';
        const Icon = isOut ? PackageX : TriangleAlert;
        return (
          <li
            key={alert.id}
            className="group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-50"
          >
            <div
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                isOut ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500',
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <Link
                to={`/products/${alert.product_id}`}
                className="block text-[13px] leading-snug font-medium text-gray-900 hover:text-brand-700"
              >
                {alert.message}
              </Link>
              <p className="mt-0.5 text-xs text-gray-400">{timeAgo(alert.created_at)}</p>
            </div>
            {(onResolve || onDismiss) && (
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {onResolve && (
                  <button
                    type="button"
                    title="Mark resolved"
                    onClick={() => onResolve(alert)}
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                {onDismiss && (
                  <button
                    type="button"
                    title="Dismiss"
                    onClick={() => onDismiss(alert)}
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
