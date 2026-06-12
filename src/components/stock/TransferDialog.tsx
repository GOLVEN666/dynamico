import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useProductOptions } from '@/hooks/useProducts';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useStockLevels, useTransferStock } from '@/hooks/useStock';
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
    from_warehouse_id: z.string().min(1, 'Select source'),
    to_warehouse_id: z.string().min(1, 'Select destination'),
    quantity: z.coerce.number().int('Whole numbers only').positive('Must be at least 1'),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (
      values.from_warehouse_id &&
      values.from_warehouse_id === values.to_warehouse_id
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_warehouse_id'],
        message: 'Destination must differ from source',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

interface TransferDialogProps {
  open: boolean;
  onClose: () => void;
  defaultProductId?: string;
}

export function TransferDialog({ open, onClose, defaultProductId }: TransferDialogProps) {
  const toast = useToast();
  const { data: products = [] } = useProductOptions();
  const { data: warehouses = [] } = useWarehouses();
  const transferStock = useTransferStock();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        product_id: defaultProductId ?? '',
        from_warehouse_id: '',
        to_warehouse_id: '',
        quantity: 1,
        notes: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultProductId]);

  const productId = watch('product_id');
  const fromId = watch('from_warehouse_id');
  const { data: levels } = useStockLevels(productId || undefined);
  const available = levels?.find((level) => level.warehouse_id === fromId)?.quantity ?? 0;

  const onSubmit = handleSubmit((values) => {
    transferStock.mutate(
      {
        product_id: values.product_id,
        from_warehouse_id: values.from_warehouse_id,
        to_warehouse_id: values.to_warehouse_id,
        quantity: values.quantity,
        notes: values.notes?.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success('Transfer complete', 'Stock moved between warehouses.');
          onClose();
        },
      },
    );
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Transfer stock"
      description="Moves units between warehouses as two linked ledger entries."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={transferStock.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} loading={transferStock.isPending}>
            Transfer
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
        <Field label="Product" htmlFor="t-product" required error={errors.product_id?.message}>
          <Select id="t-product" invalid={!!errors.product_id} {...register('product_id')}>
            <option value="">Select a product…</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Field
            label="From"
            htmlFor="t-from"
            required
            error={errors.from_warehouse_id?.message}
            hint={productId && fromId ? `Available: ${formatNumber(available)}` : undefined}
          >
            <Select id="t-from" invalid={!!errors.from_warehouse_id} {...register('from_warehouse_id')}>
              <option value="">Select…</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </Field>
          <ArrowRight className="mt-8 hidden h-4 w-4 text-gray-400 sm:block" />
          <Field label="To" htmlFor="t-to" required error={errors.to_warehouse_id?.message}>
            <Select id="t-to" invalid={!!errors.to_warehouse_id} {...register('to_warehouse_id')}>
              <option value="">Select…</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Quantity" htmlFor="t-quantity" required error={errors.quantity?.message}>
          <Input id="t-quantity" type="number" min="1" step="1" invalid={!!errors.quantity} {...register('quantity')} />
        </Field>

        <Field label="Notes" htmlFor="t-notes">
          <Textarea id="t-notes" rows={2} placeholder="Optional context…" {...register('notes')} />
        </Field>
      </form>
    </Dialog>
  );
}
