import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

/** Page-level loading placeholders, matched to common layouts. */
export function LoadingSkeleton({ variant = 'table' }: { variant?: 'stats' | 'table' | 'cards' | 'detail' }) {
  if (variant === 'stats') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-7 w-20" />
          </Card>
        ))}
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-2 h-4 w-24" />
            <Skeleton className="mt-5 h-4 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-4 h-4 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-3.5">
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-gray-100 px-5 py-4 last:border-0">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </Card>
  );
}
