import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/contexts/ToastContext';
import { useProductOptions } from '@/hooks/useProducts';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCreateMovement, useStockLevels } from '@/hooks/useStock';
import { formatNumber } from '@/lib/utils';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';

const schema = z
  .object({
    product_id: z.string().min(1, 'Select a product'),
    warehouse_id: z.string().min(1, 'Select a warehouse'),
    type: z.enum(['in', 'out', 'adjustment']),
    quantity: z.coerce.number().int('Whole numbers only'),
    reference: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.quantity === 0) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Quantity cannot be zero' });
    }
    if (values.type !== 'adjustment' && values.quantity < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'Use a positive quantity (adjustments may be negative)',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const TYPE_HELP: Record<FormValues['type'], string> = {
  in: 'Adds units to the selected warehouse (e.g. returns, found stock).',
  out: 'Removes units from the selected warehouse (e.g. orders, damage).',
  adjustment: 'Signed correction after a stock count — negative values subtract.',
};

interface MovementDialogProps {
  open: boolean;
  onClose: () => void;
  defaultProductId?: string;
}

export function MovementDialog({ open, onClose, defaultProductId }: MovementDialogProps) {
  const toast = useToast();
  const { data: products = [] } = useProductOptions();
  const { data: warehouses = [] } = useWarehouses();
  const createMovement = useCreateMovement();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'in', quantity: 1 },
  });

  useEffect(() => {
    if (open) {
      reset({
        product_id: defaultProductId ?? '',
        warehouse_id: warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? '',
        type: 'in',
        quantity: 1,
        reference: '',
        notes: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultProductId]);

  const productId = watch('product_id');
  const warehouseId = watch('warehouse_id');
  const type = watch('type');

  const { data: levels } = useStockLevels(productId || undefined);
  const currentLevel = levels?.find((level) => level.warehouse_id === warehouseId);

  const onSubmit = handleSubmit((values) => {
    createMovement.mutate(
      {
        product_id: values.product_id,
        warehouse_id: values.warehouse_id,
        type: values.type,
        quantity: values.quantity,
        reference: values.reference?.trim() || null,
        notes: values.notes?.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success('Movement recorded', 'Stock levels have been updated.');
          onClose();
        },
      },
    );
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record stock movement"
      description="Movements are immutable ledger entries — stock levels update automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={createMovement.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} loading={createMovement.isPending}>
            Record movement
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
        <Field label="Product" htmlFor="m-product" required error={errors.product_id?.message}>
          <Select id="m-product" invalid={!!errors.product_id} {...register('product_id')}>
            <option value="">Select a product…</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Warehouse"
            htmlFor="m-warehouse"
            required
            error={errors.warehouse_id?.message}
            hint={
              currentLevel !== undefined && productId && warehouseId
                ? `Current stock: ${formatNumber(currentLevel?.quantity ?? 0)}`
                : productId && warehouseId
                  ? 'Current stock: 0'
                  : undefined
            }
          >
            <Select id="m-warehouse" invalid={!!errors.warehouse_id} {...register('warehouse_id')}>
              <option value="">Select…</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Type" htmlFor="m-type" hint={TYPE_HELP[type]}>
            <Select id="m-type" {...register('type')}>
              <option value="in">Stock in</option>
              <option value="out">Stock out</option>
              <option value="adjustment">Adjustment</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Quantity" htmlFor="m-quantity" required error={errors.quantity?.message}>
            <Input
              id="m-quantity"
              type="number"
              step="1"
              invalid={!!errors.quantity}
              {...register('quantity')}
            />
          </Field>
          <Field label="Reference" htmlFor="m-reference" hint="Order #, PO #, etc.">
            <Input id="m-reference" placeholder="Optional" {...register('reference')} />
          </Field>
        </div>

        <Field label="Notes" htmlFor="m-notes">
          <Textarea id="m-notes" rows={2} placeholder="Optional context…" {...register('notes')} />
        </Field>
      </form>
    </Dialog>
  );
}
