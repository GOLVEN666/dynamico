import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, MoreHorizontal, Pencil, Plus, Star, Trash2, Warehouse as WarehouseIcon } from 'lucide-react';
import type { Warehouse } from '@/types';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import {
  useCreateWarehouse,
  useDeleteWarehouse,
  useUpdateWarehouse,
  useWarehouseTotals,
  useWarehouses,
} from '@/hooks/useWarehouses';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';

const schema = z.object({
  name: z.string().min(2, 'Name is required').max(80),
  location: z.string().optional(),
  is_default: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function Warehouses() {
  const { canEdit } = useCurrentWorkspace();
  const toast = useToast();
  const { data: warehouses, isLoading } = useWarehouses();
  const { data: totals = {} } = useWarehouseTotals();
  const { data: settings } = useSettings();
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const deleteWarehouse = useDeleteWarehouse();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);

  const currency = settings?.currency ?? 'USD';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', location: '', is_default: warehouses?.length === 0 });
    setFormOpen(true);
  };

  const openEdit = (warehouse: Warehouse) => {
    setEditing(warehouse);
    reset({
      name: warehouse.name,
      location: warehouse.location ?? '',
      is_default: warehouse.is_default,
    });
    setFormOpen(true);
  };

  const onSubmit = handleSubmit((values) => {
    const payload = {
      name: values.name,
      location: values.location?.trim() || null,
      is_default: values.is_default,
    };
    if (editing) {
      updateWarehouse.mutate(
        { id: editing.id, values: payload },
        {
          onSuccess: () => {
            toast.success('Warehouse updated');
            setFormOpen(false);
          },
        },
      );
    } else {
      createWarehouse.mutate(payload, {
        onSuccess: (warehouse) => {
          toast.success('Warehouse created', `“${warehouse.name}” is ready for stock.`);
          setFormOpen(false);
        },
      });
    }
  });

  const handleDelete = () => {
    if (!deleting) return;
    deleteWarehouse.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Warehouse deleted');
        setDeleting(null);
      },
    });
  };

  const saving = createWarehouse.isPending || updateWarehouse.isPending;
  const deletingUnits = deleting ? (totals[deleting.id]?.units ?? 0) : 0;

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Physical locations where your stock lives"
        actions={
          canEdit && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Add warehouse
            </Button>
          )
        }
      />

      {isLoading ? (
        <LoadingSkeleton variant="cards" />
      ) : !warehouses || warehouses.length === 0 ? (
        <Card>
          <EmptyState
            icon={WarehouseIcon}
            title="No warehouses yet"
            description="Create your first warehouse to start tracking stock per location."
            action={
              canEdit && (
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Add warehouse
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {warehouses.map((warehouse) => {
            const stats = totals[warehouse.id] ?? { units: 0, value: 0, skus: 0 };
            return (
              <Card key={warehouse.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                      <WarehouseIcon className="h-5 w-5 text-brand-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <span className="truncate">{warehouse.name}</span>
                        {warehouse.is_default && <Badge variant="brand">Default</Badge>}
                      </p>
                      {warehouse.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{warehouse.location}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {canEdit && (
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
                      <DropdownItem icon={<Pencil />} onClick={() => openEdit(warehouse)}>
                        Edit
                      </DropdownItem>
                      {!warehouse.is_default && (
                        <DropdownItem
                          icon={<Star />}
                          onClick={() =>
                            updateWarehouse.mutate(
                              {
                                id: warehouse.id,
                                values: {
                                  name: warehouse.name,
                                  location: warehouse.location,
                                  is_default: true,
                                },
                              },
                              { onSuccess: () => toast.success('Default warehouse updated') },
                            )
                          }
                        >
                          Make default
                        </DropdownItem>
                      )}
                      <DropdownSeparator />
                      <DropdownItem icon={<Trash2 />} destructive onClick={() => setDeleting(warehouse)}>
                        Delete
                      </DropdownItem>
                    </Dropdown>
                  )}
                </div>

                <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4">
                  <div>
                    <dt className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">Units</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold text-gray-900 tabular-nums">
                      {formatNumber(stats.units)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">SKUs</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold text-gray-900 tabular-nums">
                      {formatNumber(stats.skus)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">Value</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold text-gray-900 tabular-nums">
                      {formatCurrency(stats.value, currency)}
                    </dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit warehouse' : 'Add warehouse'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void onSubmit()} loading={saving}>
              {editing ? 'Save changes' : 'Create warehouse'}
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="w-name" required error={errors.name?.message}>
            <Input id="w-name" placeholder="East Coast Fulfillment" invalid={!!errors.name} {...register('name')} />
          </Field>
          <Field label="Location" htmlFor="w-location" hint="City, address or 3PL name">
            <Input id="w-location" placeholder="Newark, NJ" {...register('location')} />
          </Field>
          <label className="flex items-center gap-2.5 text-[13px] font-medium text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              {...register('is_default')}
            />
            Use as default warehouse
          </label>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete warehouse?"
        description={
          deletingUnits > 0
            ? `“${deleting?.name}” still holds ${formatNumber(deletingUnits)} units. Deleting it removes its stock levels and movement history. Transfer stock out first if you want to keep it.`
            : `This permanently deletes “${deleting?.name}”. This cannot be undone.`
        }
        confirmLabel="Delete warehouse"
        destructive
        loading={deleteWarehouse.isPending}
      />
    </>
  );
}
