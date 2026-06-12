import { useState } from 'react';
import { useActivityLogs } from '@/hooks/useActivity';
import { PageHeader } from '@/components/shared/PageHeader';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { FilterDropdown } from '@/components/shared/FilterDropdown';
import { Pagination } from '@/components/shared/DataTable';
import { Card } from '@/components/ui/Card';

const PAGE_SIZE = 25;

const ENTITY_OPTIONS = [
  { value: 'products', label: 'Products' },
  { value: 'stock_movements', label: 'Stock movements' },
  { value: 'purchase_orders', label: 'Purchase orders' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'warehouses', label: 'Warehouses' },
  { value: 'categories', label: 'Categories' },
  { value: 'workspace_members', label: 'Team' },
];

export function Activity() {
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useActivityLogs({ entityType, page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader
        title="Activity"
        description="A full audit trail of everything that happens in this workspace"
      />

      <div className="mb-4">
        <FilterDropdown
          label="Type"
          value={entityType}
          onChange={(value) => {
            setEntityType(value);
            setPage(1);
          }}
          options={ENTITY_OPTIONS}
        />
      </div>

      <Card>
        <div className="p-3">
          <ActivityFeed
            logs={data?.logs}
            loading={isLoading}
            emptyText={entityType ? 'No matching activity' : 'No activity yet'}
          />
        </div>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data?.total ?? 0}
          onPageChange={setPage}
        />
      </Card>
    </>
  );
}
