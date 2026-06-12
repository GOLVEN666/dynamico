import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

interface ChartCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  loading?: boolean;
  className?: string;
  /** Height of the chart area. */
  contentClassName?: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  description,
  action,
  loading = false,
  className,
  contentClassName,
  children,
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <div className={cn('p-5', contentClassName)}>
        {loading ? <Skeleton className="h-64 w-full" /> : children}
      </div>
    </Card>
  );
}
