import { Badge } from '@/components/ui/Badge';

interface StockBadgeProps {
  quantity: number;
  minimum?: number;
}

/** Health badge derived from quantity vs. the product's minimum level. */
export function StockBadge({ quantity, minimum = 0 }: StockBadgeProps) {
  if (quantity <= 0) {
    return (
      <Badge variant="danger" dot>
        Out of stock
      </Badge>
    );
  }
  if (minimum > 0 && quantity <= minimum) {
    return (
      <Badge variant="warning" dot>
        Low stock
      </Badge>
    );
  }
  return (
    <Badge variant="success" dot>
      In stock
    </Badge>
  );
}
