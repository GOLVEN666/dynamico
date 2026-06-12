import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import type { PoStatus, PurchaseOrder } from '@/types';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { poTotal, usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Pagination, type Column } from '@/components/shared/DataTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';

const PAGE_SIZE = 25;

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function PurchaseOrders() {
  const navigate = useNavigate();
  const { canEdit } = useCurrentWorkspace();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = usePurchaseOrders({
    status: status as PoStatus | '',
    search,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? 'USD';

  const total = data?.total ?? 0;
  const hasFilters = !!status || !!search;

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'number',
      header: 'PO number',
      render: (po) => <span className="font-mono text-[13px] font-medium text-gray-900">{po.po_number}</span>,
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (po) => <span className="text-gray-700">{po.supplier?.name ?? '—'}</span>,
    },
    {
      key: 'warehouse',
      header: 'Deliver to',
      className: 'hidden md:table-cell',
      render: (po) => <span className="text-gray-600">{po.warehouse?.name}</span>,
    },
    {
      key: 'items',
      header: 'Items',
      className: 'hidden sm:table-cell',
      render: (po) => <span className="text-gray-600 tabular-nums">{po.items?.length ?? 0}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      className: 'text-right',
      render: (po) => (
        <span className="font-medium text-gray-900 tabular-nums">
          {formatCurrency(poTotal(po), currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (po) => <StatusBadge kind="po" status={po.status} />,
    },
    {
      key: 'expected',
      header: 'Expected',
      className: 'hidden lg:table-cell',
      render: (po) => <span className="text-gray-500">{formatDate(po.expected_date)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        description="Incoming inventory from your suppliers"
        actions={
          canEdit && (
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => navigate('/purchase-orders/new')}
            >
              New purchase order
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

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by PO number…"
          className="w-full sm:w-72"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.orders}
        loading={isLoading}
        rowKey={(po) => po.id}
        onRowClick={(po) => navigate(`/purchase-orders/${po.id}`)}
        emptyState={
          <EmptyState
            icon={ClipboardList}
            title={hasFilters ? 'No purchase orders match' : 'No purchase orders yet'}
            description={
              hasFilters
                ? 'Try adjusting your filters.'
                : 'Create a purchase order to restock from a supplier — receiving it updates stock automatically.'
            }
            action={
              canEdit &&
              !hasFilters && (
                <Button
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => navigate('/purchase-orders/new')}
                >
                  New purchase order
                </Button>
              )
            }
          />
        }
        footer={<Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
      />
    </>
  );
}
