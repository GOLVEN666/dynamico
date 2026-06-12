import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Package, Plus } from 'lucide-react';
import type { Product, ProductStatus } from '@/types';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { totalStock, useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSettings } from '@/hooks/useSettings';
import { cn, formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Pagination, type Column } from '@/components/shared/DataTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { FilterDropdown } from '@/components/shared/FilterDropdown';
import { EmptyState } from '@/components/shared/EmptyState';
import { StockBadge } from '@/components/shared/StockBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ProductCard } from '@/components/products/ProductCard';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';

const PAGE_SIZE = 25;

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

export function Products() {
  const navigate = useNavigate();
  const { canEdit } = useCurrentWorkspace();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'table' | 'grid'>('table');

  const { data, isLoading } = useProducts({
    search,
    status: status as ProductStatus | '',
    categoryId,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: categories = [] } = useCategories();
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? 'USD';

  const hasFilters = !!search || !!status || !!categoryId;
  const products = data?.products;
  const total = data?.total ?? 0;

  const columns: Column<Product>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (product) => {
        const image = product.images?.[0]?.url;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {image ? (
                <img src={image} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package className="h-4 w-4 text-gray-300" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">{product.name}</p>
              <p className="truncate font-mono text-xs text-gray-400">{product.sku}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'category',
      header: 'Category',
      className: 'hidden md:table-cell',
      render: (product) =>
        product.category ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-600">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: product.category.color }}
            />
            {product.category.name}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (product) => {
        const stock = totalStock(product);
        return (
          <div className="flex items-center gap-2.5">
            <span className="font-medium text-gray-900 tabular-nums">{formatNumber(stock)}</span>
            <StockBadge quantity={stock} minimum={product.minimum_stock} />
          </div>
        );
      },
    },
    {
      key: 'price',
      header: 'Price',
      className: 'hidden sm:table-cell',
      render: (product) => (
        <span className="text-gray-700 tabular-nums">
          {formatCurrency(product.selling_price, currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'hidden sm:table-cell',
      render: (product) => <StatusBadge kind="product" status={product.status} />,
    },
    {
      key: 'created',
      header: 'Created',
      className: 'hidden lg:table-cell',
      render: (product) => <span className="text-gray-500">{formatDate(product.created_at)}</span>,
    },
  ];

  const emptyState = hasFilters ? (
    <EmptyState
      icon={Package}
      title="No products match"
      description="Try adjusting your search or filters."
      action={
        <Button
          variant="secondary"
          onClick={() => {
            setSearch('');
            setStatus('');
            setCategoryId('');
            setPage(1);
          }}
        >
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Package}
      title="No products yet"
      description="Add your first product to start tracking inventory across warehouses."
      action={
        canEdit && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/products/new')}>
            Add product
          </Button>
        )
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Products"
        description={`${formatNumber(total)} products in your catalog`}
        actions={
          canEdit && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/products/new')}>
              Add product
            </Button>
          )
        }
      />

      <Tabs
        tabs={STATUS_TABS}
        value={status}
        onChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        className="mb-4"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by name, SKU or barcode…"
          className="w-full sm:w-72"
        />
        <FilterDropdown
          label="Category"
          value={categoryId}
          onChange={(value) => {
            setCategoryId(value);
            setPage(1);
          }}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <div className="ml-auto flex rounded-lg border border-gray-300 bg-white p-0.5 shadow-card">
          {(
            [
              { mode: 'table', icon: List },
              { mode: 'grid', icon: LayoutGrid },
            ] as const
          ).map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                view === mode ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600',
              )}
              title={mode === 'table' ? 'Table view' : 'Grid view'}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {view === 'table' ? (
        <DataTable
          columns={columns}
          data={products}
          loading={isLoading}
          rowKey={(product) => product.id}
          onRowClick={(product) => navigate(`/products/${product.id}`)}
          emptyState={emptyState}
          footer={
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          }
        />
      ) : isLoading ? (
        <LoadingSkeleton variant="cards" />
      ) : !products || products.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-card">{emptyState}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} currency={currency} />
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-gray-200 bg-white shadow-card">
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </div>
        </>
      )}
    </>
  );
}
