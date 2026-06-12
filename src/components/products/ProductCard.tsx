import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import type { Product } from '@/types';
import { totalStock } from '@/hooks/useProducts';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { StockBadge } from '@/components/shared/StockBadge';

interface ProductCardProps {
  product: Product;
  currency: string;
}

export function ProductCard({ product, currency }: ProductCardProps) {
  const image = product.images?.[0]?.url;
  const stock = totalStock(product);

  return (
    <Link to={`/products/${product.id}`} className="group block">
      <Card className="overflow-hidden transition-shadow group-hover:shadow-card-hover">
        <div className="flex h-36 items-center justify-center bg-gray-50">
          {image ? (
            <img src={image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <Package className="h-8 w-8 text-gray-300" />
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-brand-700">
                {product.name}
              </p>
              <p className="mt-0.5 truncate font-mono text-xs text-gray-400">{product.sku}</p>
            </div>
            {product.category && (
              <span
                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: product.category.color }}
                title={product.category.name}
              />
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(product.selling_price, currency)}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-gray-500">{formatNumber(stock)} units</span>
              <StockBadge quantity={stock} minimum={product.minimum_stock} />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
