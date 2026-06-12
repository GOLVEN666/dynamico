import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Plus } from 'lucide-react';
import type { MovementType, StockMovement } from '@/types';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useStockMovements } from '@/hooks/useStock';
import { useProductOptions } from '@/hooks/useProducts';
import { useWarehouses } from '@/hooks/useWarehouses';
import { cn, formatDateTime, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Pagination, type Column } from '@/components/shared/DataTable';
import { FilterDropdown } from '@/components/shared/FilterDropdown';
import { EmptyState } from '@/components/shared/EmptyState';
import { MovementBadge } from '@/components/shared/StatusBadge';
import { MovementDialog } from '@/components/stock/MovementDialog';
import { TransferDialog } from '@/components/stock/TransferDialog';
import { Button } from '@/components/ui/Button';

const PAGE_SIZE = 25;

const TYPE_OPTIONS = [
  { value: 'in', label: 'Stock in' },
  { value: 'out', label: 'Stock out' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'transfer_in', label: 'Transfer in' },
  { value: 'transfer_out', label: 'Transfer out' },
];

export function StockMovements() {
  const { canEdit } = useCurrentWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  const [warehouseId, setWarehouseId] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [movementOpen, setMovementOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  // deep-linkable product filter (?product=<id>)
  const productId = searchParams.get('product') ?? '';

  const { data, isLoading } = useStockMovements({
    productId,
    warehouseId,
    type: type as MovementType | '',
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: products = [] } = useProductOptions();
  const { data: warehouses = [] } = useWarehouses();

  const total = data?.total ?? 0;
  const hasFilters = !!productId || !!warehouseId || !!type;

  const columns: Column<StockMovement>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (movement) => (
        <span className="whitespace-nowrap text-gray-600">
          {formatDateTime(movement.created_at)}
        </span>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (movement) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">{movement.product?.name}</p>
          <p className="truncate font-mono text-xs text-gray-400">{movement.product?.sku}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (movement) => <MovementBadge type={movement.type} />,
    },
    {
      key: 'quantity',
      header: 'Qty',
      className: 'text-right',
      render: (movement) => {
        const negative =
          movement.type === 'out' ||
          movement.type === 'transfer_out' ||
          (movement.type === 'adjustment' && movement.quantity < 0);
        return (
          <span
            className={cn(
              'font-medium tabular-nums',
              negative ? 'text-red-600' : 'text-emerald-600',
            )}
          >
            {negative ? '−' : '+'}
            {formatNumber(Math.abs(movement.quantity))}
          </span>
        );
      },
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      className: 'hidden sm:table-cell',
      render: (movement) => <span className="text-gray-600">{movement.warehouse?.name}</span>,
    },
    {
      key: 'reference',
      header: 'Reference',
      className: 'hidden md:table-cell',
      render: (movement) =>
        movement.reference ? (
          <span className="font-mono text-xs text-gray-600">{movement.reference}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'by',
      header: 'By',
      className: 'hidden lg:table-cell',
      render: (movement) => (
        <span className="text-gray-500">
          {movement.created_by_profile?.full_name ||
            movement.created_by_profile?.email ||
            'System'}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Stock Movements"
        description="The immutable ledger behind every stock level"
        actions={
          canEdit && (
            <>
              <Button
                variant="secondary"
                icon={<ArrowLeftRight className="h-4 w-4" />}
                onClick={() => setTransferOpen(true)}
              >
                Transfer stock
              </Button>
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setMovementOpen(true)}>
                Record movement
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterDropdown
          label="Product"
          value={productId}
          onChange={(value) => {
            setSearchParams(value ? { product: value } : {}, { replace: true });
            setPage(1);
          }}
          options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
        />
        <FilterDropdown
          label="Warehouse"
          value={warehouseId}
          onChange={(value) => {
            setWarehouseId(value);
            setPage(1);
          }}
          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        />
        <FilterDropdown
          label="Type"
          value={type}
          onChange={(value) => {
            setType(value);
            setPage(1);
          }}
          options={TYPE_OPTIONS}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.movements}
        loading={isLoading}
        rowKey={(movement) => movement.id}
        emptyState={
          <EmptyState
            icon={ArrowLeftRight}
            title={hasFilters ? 'No movements match' : 'No stock movements yet'}
            description={
              hasFilters
                ? 'Try adjusting your filters.'
                : 'Record your first movement to start the ledger.'
            }
            action={
              canEdit &&
              !hasFilters && (
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setMovementOpen(true)}>
                  Record movement
                </Button>
              )
            }
          />
        }
        footer={<Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
      />

      <MovementDialog open={movementOpen} onClose={() => setMovementOpen(false)} />
      <TransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} />
    </>
  );
}
