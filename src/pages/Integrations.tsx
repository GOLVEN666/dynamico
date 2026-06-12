import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Copy,
  Eye,
  EyeOff,
  Inbox,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Trash2,
  Webhook,
} from 'lucide-react';
import type { ExternalOrder, WebhookEndpoint } from '@/types';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import {
  useCreateEndpoint,
  useDeleteEndpoint,
  useExternalOrders,
  useUpdateEndpoint,
  useWebhookEndpoints,
} from '@/hooks/useIntegrations';
import { useWarehouses } from '@/hooks/useWarehouses';
import { formatDateTime, timeAgo } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Pagination, type Column } from '@/components/shared/DataTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';

const PAGE_SIZE = 25;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const schema = z.object({
  name: z.string().min(2, 'Give this connection a name').max(80),
  source: z.enum(['shopify', 'woocommerce', 'custom']),
  warehouse_id: z.string().min(1, 'Select the warehouse orders ship from'),
});

type FormValues = z.infer<typeof schema>;

const SOURCE_HELP: Record<FormValues['source'], string> = {
  shopify: 'Shopify Admin → Settings → Notifications → Webhooks → “Order creation” → paste the URL.',
  woocommerce: 'WooCommerce → Settings → Advanced → Webhooks → topic “Order created” → paste the URL.',
  custom: 'POST JSON to the URL: { "external_id": "...", "order_number": "...", "items": [{ "sku": "...", "qty": 1 }] }',
};

function webhookUrl(token: string) {
  return `${SUPABASE_URL}/functions/v1/order-webhook?token=${token}`;
}

export function Integrations() {
  const { canManage } = useCurrentWorkspace();
  const toast = useToast();

  const { data: endpoints, isLoading } = useWebhookEndpoints();
  const { data: warehouses = [] } = useWarehouses();
  const createEndpoint = useCreateEndpoint();
  const updateEndpoint = useUpdateEndpoint();
  const deleteEndpoint = useDeleteEndpoint();

  const [page, setPage] = useState(1);
  const { data: orderData, isLoading: ordersLoading } = useExternalOrders({ page, pageSize: PAGE_SIZE });

  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<WebhookEndpoint | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', source: 'shopify', warehouse_id: '' },
  });
  const source = watch('source');

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const onSubmit = handleSubmit((values) => {
    createEndpoint.mutate(values, {
      onSuccess: (endpoint) => {
        toast.success('Endpoint created', `Point ${endpoint.source} at the webhook URL to go live.`);
        reset({ name: '', source: 'shopify', warehouse_id: '' });
        setFormOpen(false);
      },
    });
  });

  const orderColumns: Column<ExternalOrder>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (order) => (
        <span className="font-mono text-[13px] font-medium text-gray-900">{order.order_number}</span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (order) => <StatusBadge kind="source" status={order.source} />,
    },
    {
      key: 'endpoint',
      header: 'Endpoint',
      className: 'hidden md:table-cell',
      render: (order) => <span className="text-gray-600">{order.endpoint?.name ?? '—'}</span>,
    },
    {
      key: 'items',
      header: 'Items',
      render: (order) => (
        <span className="text-gray-700 tabular-nums">
          {order.items_matched}/{order.items_total}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => <StatusBadge kind="order" status={order.status} />,
    },
    {
      key: 'error',
      header: 'Notes',
      className: 'hidden lg:table-cell',
      render: (order) =>
        order.error ? (
          <span className="block max-w-64 truncate text-xs text-red-600" title={order.error}>
            {order.error}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'received',
      header: 'Received',
      render: (order) => (
        <span className="text-gray-500" title={formatDateTime(order.created_at)}>
          {timeAgo(order.created_at)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect Shopify, WooCommerce or your own system — incoming orders deduct stock automatically"
        actions={
          canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
              New endpoint
            </Button>
          )
        }
      />

      {/* endpoints */}
      {isLoading ? (
        <LoadingSkeleton variant="cards" />
      ) : !endpoints || endpoints.length === 0 ? (
        <Card>
          <EmptyState
            icon={Webhook}
            title="No endpoints yet"
            description="Create an endpoint to get a webhook URL for your store. Orders that hit it are matched by SKU and recorded as stock-out movements."
            action={
              canManage && (
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
                  New endpoint
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {endpoints.map((endpoint) => {
            const url = webhookUrl(endpoint.token);
            const revealed = revealedToken === endpoint.id;
            return (
              <Card key={endpoint.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                      <Webhook className="h-5 w-5 text-brand-600" />
                    </div>
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                        {endpoint.name}
                        {!endpoint.is_active && <Badge variant="warning">Paused</Badge>}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge kind="source" status={endpoint.source} />
                        <span className="text-xs text-gray-400">
                          → {endpoint.warehouse?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <Dropdown
                      trigger={
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      }
                    >
                      <DropdownItem
                        icon={endpoint.is_active ? <Pause /> : <Play />}
                        onClick={() =>
                          updateEndpoint.mutate(
                            { id: endpoint.id, values: { is_active: !endpoint.is_active } },
                            {
                              onSuccess: () =>
                                toast.success(endpoint.is_active ? 'Endpoint paused' : 'Endpoint resumed'),
                            },
                          )
                        }
                      >
                        {endpoint.is_active ? 'Pause' : 'Resume'}
                      </DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem icon={<Trash2 />} destructive onClick={() => setDeleting(endpoint)}>
                        Delete
                      </DropdownItem>
                    </Dropdown>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-mono text-xs text-gray-600">
                      {url}
                    </code>
                    <button
                      type="button"
                      title="Copy webhook URL"
                      onClick={() => void copy(url, 'Webhook URL')}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-mono text-xs text-gray-600">
                      {revealed ? endpoint.token : '•'.repeat(24)}
                    </code>
                    <button
                      type="button"
                      title={revealed ? 'Hide token' : 'Reveal token'}
                      onClick={() => setRevealedToken(revealed ? null : endpoint.id)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      title="Copy token"
                      onClick={() => void copy(endpoint.token, 'Token')}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-gray-500">{SOURCE_HELP[endpoint.source]}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {endpoint.last_received_at
                    ? `Last order ${timeAgo(endpoint.last_received_at)}`
                    : 'No orders received yet'}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {/* received orders */}
      <div className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold text-gray-900">Received orders</h2>
        <DataTable
          columns={orderColumns}
          data={orderData?.orders}
          loading={ordersLoading}
          rowKey={(order) => order.id}
          emptyState={
            <EmptyState
              icon={Inbox}
              title="No orders yet"
              description="Orders pushed by your store appear here with their stock impact."
            />
          }
          footer={
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={orderData?.total ?? 0}
              onPageChange={setPage}
            />
          }
        />
      </div>

      {/* create dialog */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New webhook endpoint"
        description="A unique token is generated for the URL — treat it like a password."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={createEndpoint.isPending}>
              Cancel
            </Button>
            <Button onClick={() => void onSubmit()} loading={createEndpoint.isPending}>
              Create endpoint
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="ep-name" required error={errors.name?.message}>
            <Input id="ep-name" placeholder="Main Shopify store" invalid={!!errors.name} {...register('name')} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Platform" htmlFor="ep-source">
              <Select id="ep-source" {...register('source')}>
                <option value="shopify">Shopify</option>
                <option value="woocommerce">WooCommerce</option>
                <option value="custom">Custom system</option>
              </Select>
            </Field>
            <Field
              label="Deduct stock from"
              htmlFor="ep-warehouse"
              required
              error={errors.warehouse_id?.message}
            >
              <Select id="ep-warehouse" invalid={!!errors.warehouse_id} {...register('warehouse_id')}>
                <option value="">Select warehouse…</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-500">
            {SOURCE_HELP[source]}
          </p>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          deleteEndpoint.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Endpoint deleted');
              setDeleting(null);
            },
          })
        }
        title="Delete endpoint?"
        description={`“${deleting?.name}” will stop accepting orders immediately. Order history is kept.`}
        confirmLabel="Delete endpoint"
        destructive
        loading={deleteEndpoint.isPending}
      />
    </>
  );
}
