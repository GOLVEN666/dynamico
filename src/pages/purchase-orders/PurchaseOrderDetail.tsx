import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ban, CheckCheck, ClipboardList, PackageCheck, Send } from 'lucide-react';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import {
  poTotal,
  usePurchaseOrder,
  useReceivePurchaseOrder,
  useUpdatePoStatus,
} from '@/hooks/usePurchaseOrders';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { canEdit } = useCurrentWorkspace();

  const { data: po, isLoading, isError } = usePurchaseOrder(id);
  const { data: settings } = useSettings();
  const updateStatus = useUpdatePoStatus();
  const receivePo = useReceivePurchaseOrder();

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isLoading) return <LoadingSkeleton variant="detail" />;

  if (isError || !po) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Purchase order not found"
        description="It may have been deleted, or you may not have access."
        action={
          <Button variant="secondary" onClick={() => navigate('/purchase-orders')}>
            Back to purchase orders
          </Button>
        }
      />
    );
  }

  const currency = settings?.currency ?? 'USD';
  const total = poTotal(po);
  const items = po.items ?? [];
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleMarkOrdered = () => {
    updateStatus.mutate(
      { id: po.id, status: 'ordered' },
      { onSuccess: () => toast.success('Marked as ordered', `${po.po_number} sent to supplier.`) },
    );
  };

  const handleReceive = () => {
    receivePo.mutate(po.id, {
      onSuccess: () => {
        toast.success(
          'Purchase order received',
          `${formatNumber(totalUnits)} units stocked into ${po.warehouse?.name}.`,
        );
        setReceiveOpen(false);
      },
    });
  };

  const handleCancel = () => {
    updateStatus.mutate(
      { id: po.id, status: 'cancelled' },
      {
        onSuccess: () => {
          toast.success('Purchase order cancelled');
          setCancelOpen(false);
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        backTo={{ to: '/purchase-orders', label: 'Purchase orders' }}
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{po.po_number}</span>
            <StatusBadge kind="po" status={po.status} />
          </span>
        }
        description={`Created ${formatDate(po.created_at)}${po.supplier ? ` · ${po.supplier.name}` : ''}`}
        actions={
          canEdit && (
            <>
              {po.status === 'draft' && (
                <Button
                  icon={<Send className="h-4 w-4" />}
                  loading={updateStatus.isPending}
                  onClick={handleMarkOrdered}
                >
                  Mark as ordered
                </Button>
              )}
              {po.status === 'ordered' && (
                <Button
                  icon={<PackageCheck className="h-4 w-4" />}
                  onClick={() => setReceiveOpen(true)}
                >
                  Receive stock
                </Button>
              )}
              {(po.status === 'draft' || po.status === 'ordered') && (
                <Button
                  variant="secondary"
                  icon={<Ban className="h-4 w-4" />}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel PO
                </Button>
              )}
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Line items</CardTitle>
            <span className="text-[13px] text-gray-500">{formatNumber(totalUnits)} units</span>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                    <th className="pb-2.5">Product</th>
                    <th className="pb-2.5 text-right">Qty</th>
                    <th className="pb-2.5 text-right">Received</th>
                    <th className="pb-2.5 text-right">Unit cost</th>
                    <th className="pb-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3">
                        <p className="font-medium text-gray-900">{item.product?.name}</p>
                        <p className="font-mono text-xs text-gray-400">{item.product?.sku}</p>
                      </td>
                      <td className="py-3 text-right text-gray-700 tabular-nums">
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {item.received_quantity > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCheck className="h-3.5 w-3.5" />
                            {formatNumber(item.received_quantity)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-gray-700 tabular-nums">
                        {formatCurrency(item.unit_cost, currency)}
                      </td>
                      <td className="py-3 text-right font-medium text-gray-900 tabular-nums">
                        {formatCurrency(item.quantity * item.unit_cost, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="pt-3 text-right text-[13px] font-medium text-gray-500">
                      Order total
                    </td>
                    <td className="pt-3 text-right text-base font-semibold text-gray-900 tabular-nums">
                      {formatCurrency(total, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Supplier</dt>
                  <dd className="font-medium text-gray-900">{po.supplier?.name ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Deliver to</dt>
                  <dd className="font-medium text-gray-900">{po.warehouse?.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Expected</dt>
                  <dd className="font-medium text-gray-900">{formatDate(po.expected_date)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Ordered at</dt>
                  <dd className="font-medium text-gray-900">{formatDate(po.ordered_at)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Received at</dt>
                  <dd className="font-medium text-gray-900">{formatDate(po.received_at)}</dd>
                </div>
              </dl>
              {po.notes && (
                <p className="mt-4 rounded-lg bg-gray-50 p-3 text-[13px] leading-relaxed text-gray-600">
                  {po.notes}
                </p>
              )}
            </CardContent>
          </Card>

          {po.supplier?.email && (
            <Card>
              <CardHeader>
                <CardTitle>Supplier contact</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2.5 text-[13px]">
                  {po.supplier.contact_name && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Contact</dt>
                      <dd className="font-medium text-gray-900">{po.supplier.contact_name}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Email</dt>
                    <dd>
                      <a
                        href={`mailto:${po.supplier.email}`}
                        className="font-medium text-brand-600 hover:text-brand-700"
                      >
                        {po.supplier.email}
                      </a>
                    </dd>
                  </div>
                  {po.supplier.phone && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Phone</dt>
                      <dd className="font-medium text-gray-900">{po.supplier.phone}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        onConfirm={handleReceive}
        title="Receive purchase order?"
        description={`This records stock-in movements for all ${formatNumber(totalUnits)} outstanding units into ${po.warehouse?.name} and marks ${po.po_number} as received.`}
        confirmLabel="Receive stock"
        loading={receivePo.isPending}
      />
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel purchase order?"
        description={`${po.po_number} will be marked as cancelled. No stock will be received from it.`}
        confirmLabel="Cancel PO"
        destructive
        loading={updateStatus.isPending}
      />
    </>
  );
}
