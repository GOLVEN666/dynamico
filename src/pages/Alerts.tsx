import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, X } from 'lucide-react';
import type { Alert, AlertStatus, AlertType } from '@/types';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { useAlerts, useUpdateAlertStatus } from '@/hooks/useAlerts';
import { formatDateTime, timeAgo } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterDropdown } from '@/components/shared/FilterDropdown';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';

const STATUS_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

const TYPE_OPTIONS = [
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
];

export function Alerts() {
  const { canEdit } = useCurrentWorkspace();
  const toast = useToast();
  const [status, setStatus] = useState<AlertStatus>('active');
  const [type, setType] = useState('');

  const { data: alerts, isLoading } = useAlerts({ status, type: type as AlertType | '' });
  const updateAlert = useUpdateAlertStatus();

  const handleUpdate = (alert: Alert, next: 'resolved' | 'dismissed') => {
    updateAlert.mutate(
      { id: alert.id, status: next },
      {
        onSuccess: () =>
          toast.success(next === 'resolved' ? 'Alert resolved' : 'Alert dismissed'),
      },
    );
  };

  const columns: Column<Alert>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (alert) => <StatusBadge kind="alertType" status={alert.type} />,
    },
    {
      key: 'message',
      header: 'Alert',
      render: (alert) => (
        <Link
          to={`/products/${alert.product_id}`}
          className="font-medium text-gray-900 hover:text-brand-700"
        >
          {alert.message}
        </Link>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      className: 'hidden md:table-cell',
      render: (alert) => <span className="text-gray-600">{alert.warehouse?.name}</span>,
    },
    {
      key: 'raised',
      header: 'Raised',
      className: 'hidden sm:table-cell',
      render: (alert) => (
        <span className="text-gray-500" title={formatDateTime(alert.created_at)}>
          {timeAgo(alert.created_at)}
        </span>
      ),
    },
    ...(status !== 'active'
      ? ([
          {
            key: 'closed',
            header: status === 'resolved' ? 'Resolved' : 'Dismissed',
            className: 'hidden sm:table-cell',
            render: (alert) => (
              <span className="text-gray-500">
                {alert.resolved_at ? timeAgo(alert.resolved_at) : '—'}
              </span>
            ),
          },
        ] as Column<Alert>[])
      : []),
    ...(status === 'active' && canEdit
      ? ([
          {
            key: 'actions',
            header: '',
            className: 'w-24 text-right',
            render: (alert) => (
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  title="Mark resolved"
                  onClick={() => handleUpdate(alert, 'resolved')}
                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Dismiss"
                  onClick={() => handleUpdate(alert, 'dismissed')}
                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ),
          },
        ] as Column<Alert>[])
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Automatic low-stock and out-of-stock notifications per warehouse"
      />

      <Tabs
        tabs={STATUS_TABS}
        value={status}
        onChange={(value) => setStatus(value as AlertStatus)}
        className="mb-4"
      />

      <div className="mb-4">
        <FilterDropdown label="Type" value={type} onChange={setType} options={TYPE_OPTIONS} />
      </div>

      <DataTable
        columns={columns}
        data={alerts}
        loading={isLoading}
        rowKey={(alert) => alert.id}
        emptyState={
          <EmptyState
            icon={Bell}
            title={status === 'active' ? 'No active alerts' : `No ${status} alerts`}
            description={
              status === 'active'
                ? 'Alerts appear automatically when stock falls to a product’s minimum or hits zero.'
                : 'Nothing here yet.'
            }
            action={
              status === 'active' && (
                <Link to="/products">
                  <Button variant="secondary">Review products</Button>
                </Link>
              )
            }
          />
        }
      />
    </>
  );
}
