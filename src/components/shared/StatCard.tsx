import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  /** Tailwind classes for the icon container, e.g. "bg-amber-50 text-amber-600". */
  tone?: string;
  sub?: ReactNode;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'bg-brand-50 text-brand-600',
  sub,
  loading = false,
}: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-gray-500">{label}</p>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone)}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
      )}
      {sub && !loading && <div className="mt-1.5 text-[13px] text-gray-500">{sub}</div>}
    </Card>
  );
}
