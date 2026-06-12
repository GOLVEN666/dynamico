import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { StockMovement } from '@/types';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { useArchiveProduct, useDeleteProduct, useProduct } from '@/hooks/useProducts';
import { useStockMovements } from '@/hooks/useStock';
import { useSettings } from '@/hooks/useSettings';
import { cn, formatCurrency, formatDateTime, formatNumber, timeAgo } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { StockBadge } from '@/components/shared/StockBadge';
import { StatusBadge, MovementBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { MovementDialog } from '@/components/stock/MovementDialog';
import { TransferDialog } from '@/components/stock/TransferDialog';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { Badge } from '@/components/ui/Badge';

function signedQuantity(movement: StockMovement) {
  const negative =
    movement.type === 'out' ||
    movement.type === 'transfer_out' ||
    (movement.type === 'adjustment' && movement.quantity < 0);
  const value = Math.abs(movement.quantity);
  return (
    <span className={cn('font-medium tabular-nums', negative ? 'text-red-600' : 'text-emerald-600')}>
      {negative ? '−' : '+'}
      {formatNumber(value)}
    </span>
  );
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { canEdit } = useCurrentWorkspace();

  const { data: product, isLoading, isError } = useProduct(id);
  const { data: movementData } = useStockMovements({ productId: id, pageSize: 8 });
  const { data: settings } = useSettings();
  const archiveProduct = useArchiveProduct();
  const deleteProduct = useDeleteProduct();

  const [movementOpen, setMovementOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <LoadingSkeleton variant="detail" />;

  if (isError || !product) {
    return (
      <EmptyState
        icon={Package}
        title="Product not found"
        description="It may have been deleted, or you may not have access."
        action={
          <Button variant="secondary" onClick={() => navigate('/products')}>
            Back to products
          </Button>
        }
      />
    );
  }

  const currency = settings?.currency ?? 'USD';
  const levels = product.stock_levels ?? [];
  const total = levels.reduce((sum, level) => sum + level.quantity, 0);
  const stockValue = total * product.cost_price;
  const retailValue = total * product.selling_price;
  const image = product.images?.[0]?.url;
  const isArchived = product.status === 'archived';

  const handleArchiveToggle = () => {
    archiveProduct.mutate(
      { id: product.id, archive: !isArchived },
      {
        onSuccess: () =>
          toast.success(isArchived ? 'Product restored' : 'Product archived'),
      },
    );
  };

  const handleDelete = () => {
    deleteProduct.mutate(product.id, {
      onSuccess: () => {
        toast.success('Product deleted', `“${product.name}” and its history were removed.`);
        navigate('/products');
      },
    });
  };

  return (
    <>
      <PageHeader
        backTo={{ to: '/products', label: 'Products' }}
        title={
          <span className="flex items-center gap-3">
            {product.name}
            <StatusBadge kind="product" status={product.status} />
          </span>
        }
        description={`SKU ${product.sku}${product.barcode ? ` · Barcode ${product.barcode}` : ''}`}
        actions={
          canEdit && (
            <>
              <Button
                variant="secondary"
                icon={<ArrowLeftRight className="h-4 w-4" />}
                onClick={() => setTransferOpen(true)}
              >
                Transfer
              </Button>
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setMovementOpen(true)}>
                Record movement
              </Button>
              <Dropdown
                trigger={
                  <Button variant="secondary" icon={<MoreHorizontal className="h-4 w-4" />} />
                }
              >
                <DropdownItem
                  icon={<Pencil />}
                  onClick={() => navigate(`/products/${product.id}/edit`)}
                >
                  Edit product
                </DropdownItem>
                <DropdownItem
                  icon={isArchived ? <ArchiveRestore /> : <Archive />}
                  onClick={handleArchiveToggle}
                >
                  {isArchived ? 'Restore' : 'Archive'}
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem icon={<Trash2 />} destructive onClick={() => setDeleteOpen(true)}>
                  Delete permanently
                </DropdownItem>
              </Dropdown>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* stock by warehouse */}
          <Card>
            <CardHeader>
              <CardTitle>Stock by warehouse</CardTitle>
              <span className="text-[13px] text-gray-500">
                {formatNumber(total)} units total
              </span>
            </CardHeader>
            <CardContent className="pt-4">
              {levels.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-gray-500">
                  No stock recorded yet — use “Record movement” to add opening stock.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {levels.map((level) => (
                    <div key={level.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {level.warehouse?.name ?? 'Warehouse'}
                        </p>
                        <p className="text-xs text-gray-400">Updated {timeAgo(level.updated_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">
                          {formatNumber(level.quantity)}
                        </span>
                        <StockBadge quantity={level.quantity} minimum={product.minimum_stock} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* recent movements */}
          <Card>
            <CardHeader>
              <CardTitle>Recent movements</CardTitle>
              <Link
                to={`/stock-movements?product=${product.id}`}
                className="text-[13px] font-medium text-brand-600 hover:text-brand-700"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="pt-4">
              {!movementData || movementData.movements.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-gray-500">No movements yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {movementData.movements.map((movement) => (
                    <div key={movement.id} className="flex items-center gap-3 py-2.5">
                      <MovementBadge type={movement.type} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-gray-500">
                        {movement.warehouse?.name}
                        {movement.reference ? ` · ${movement.reference}` : ''}
                      </span>
                      {signedQuantity(movement)}
                      <span className="w-32 text-right text-xs text-gray-400">
                        {formatDateTime(movement.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* side column */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {image && (
                <img
                  src={image}
                  alt={product.name}
                  className="h-44 w-full rounded-lg border border-gray-200 object-cover"
                />
              )}
              {product.description && (
                <p className="text-[13px] leading-relaxed text-gray-600">{product.description}</p>
              )}
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Category</dt>
                  <dd>
                    {product.category ? (
                      <Badge>
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: product.category.color }}
                        />
                        {product.category.name}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Supplier</dt>
                  <dd className="font-medium text-gray-900">
                    {product.supplier?.name ?? <span className="font-normal text-gray-400">—</span>}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Cost price</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">
                    {formatCurrency(product.cost_price, currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Selling price</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">
                    {formatCurrency(product.selling_price, currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Minimum stock</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">
                    {formatNumber(product.minimum_stock)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory value</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Units on hand</dt>
                  <dd className="font-semibold text-gray-900 tabular-nums">{formatNumber(total)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Stock value (cost)</dt>
                  <dd className="font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(stockValue, currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Retail value</dt>
                  <dd className="font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(retailValue, currency)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <MovementDialog
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        defaultProductId={product.id}
      />
      <TransferDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        defaultProductId={product.id}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete product?"
        description={`This permanently deletes “${product.name}”, its images, stock levels and movement history. This cannot be undone — consider archiving instead.`}
        confirmLabel="Delete product"
        destructive
        loading={deleteProduct.isPending}
      />
    </>
  );
}
