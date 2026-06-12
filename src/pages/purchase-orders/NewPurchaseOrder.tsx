import { useNavigate } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useCreatePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { useProductOptions } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';

const schema = z.object({
  supplier_id: z.string().optional(),
  warehouse_id: z.string().min(1, 'Select a destination warehouse'),
  expected_date: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1, 'Select a product'),
        quantity: z.coerce.number().int('Whole numbers only').positive('At least 1'),
        unit_cost: z.coerce.number().min(0, '0 or more'),
      }),
    )
    .min(1, 'Add at least one line item'),
});

type FormValues = z.infer<typeof schema>;

export function NewPurchaseOrder() {
  const navigate = useNavigate();
  const toast = useToast();
  const createPo = useCreatePurchaseOrder();
  const { data: products = [] } = useProductOptions();
  const { data: suppliers = [] } = useSuppliers();
  const { data: warehouses = [] } = useWarehouses();
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? 'USD';

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplier_id: '',
      warehouse_id: '',
      expected_date: '',
      notes: '',
      items: [{ product_id: '', quantity: 1, unit_cost: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0),
    0,
  );

  const submit = (status: 'draft' | 'ordered') =>
    handleSubmit((values) => {
      createPo.mutate(
        {
          supplier_id: values.supplier_id || null,
          warehouse_id: values.warehouse_id,
          expected_date: values.expected_date || null,
          notes: values.notes?.trim() || null,
          status,
          items: values.items,
        },
        {
          onSuccess: (po) => {
            toast.success(
              status === 'draft' ? 'Draft saved' : 'Purchase order created',
              `${po.po_number} ${status === 'ordered' ? 'has been marked as ordered.' : 'is saved as a draft.'}`,
            );
            navigate(`/purchase-orders/${po.id}`);
          },
        },
      );
    })();

  /** Auto-fill unit cost from the product's cost price. */
  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product && (!items[index]?.unit_cost || Number(items[index]?.unit_cost) === 0)) {
      setValue(`items.${index}.unit_cost`, product.cost_price);
    }
  };

  return (
    <>
      <PageHeader
        title="New purchase order"
        backTo={{ to: '/purchase-orders', label: 'Purchase orders' }}
        description="The PO number is assigned automatically when saved."
      />

      <form noValidate>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Line items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-[1fr_96px_120px_36px] sm:items-start"
                  >
                    <Field
                      label={index === 0 ? 'Product' : ''}
                      htmlFor={`item-product-${index}`}
                      error={errors.items?.[index]?.product_id?.message}
                      className={index > 0 ? '[&>label]:hidden sm:[&>label]:block sm:[&>label]:invisible' : ''}
                    >
                      <Select
                        id={`item-product-${index}`}
                        invalid={!!errors.items?.[index]?.product_id}
                        {...register(`items.${index}.product_id`, {
                          onChange: (e) => handleProductChange(index, e.target.value),
                        })}
                      >
                        <option value="">Select a product…</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label={index === 0 ? 'Qty' : ''}
                      htmlFor={`item-qty-${index}`}
                      error={errors.items?.[index]?.quantity?.message}
                      className={index > 0 ? '[&>label]:hidden sm:[&>label]:block sm:[&>label]:invisible' : ''}
                    >
                      <Input
                        id={`item-qty-${index}`}
                        type="number"
                        min="1"
                        invalid={!!errors.items?.[index]?.quantity}
                        {...register(`items.${index}.quantity`)}
                      />
                    </Field>
                    <Field
                      label={index === 0 ? 'Unit cost' : ''}
                      htmlFor={`item-cost-${index}`}
                      error={errors.items?.[index]?.unit_cost?.message}
                      className={index > 0 ? '[&>label]:hidden sm:[&>label]:block sm:[&>label]:invisible' : ''}
                    >
                      <Input
                        id={`item-cost-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        invalid={!!errors.items?.[index]?.unit_cost}
                        {...register(`items.${index}.unit_cost`)}
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="mt-0 justify-self-end rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 sm:mt-7"
                      title="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {errors.items?.root?.message && (
                  <p className="text-xs text-red-600">{errors.items.root.message}</p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => append({ product_id: '', quantity: 1, unit_cost: 0 })}
                  >
                    Add line
                  </Button>
                  <p className="text-sm text-gray-500">
                    Subtotal{' '}
                    <span className="ml-1 text-base font-semibold text-gray-900 tabular-nums">
                      {formatCurrency(subtotal, currency)}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Order details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Supplier" htmlFor="po-supplier">
                  <Select id="po-supplier" {...register('supplier_id')}>
                    <option value="">No supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Deliver to"
                  htmlFor="po-warehouse"
                  required
                  error={errors.warehouse_id?.message}
                >
                  <Select
                    id="po-warehouse"
                    invalid={!!errors.warehouse_id}
                    {...register('warehouse_id')}
                  >
                    <option value="">Select warehouse…</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Expected delivery" htmlFor="po-expected">
                  <Input id="po-expected" type="date" {...register('expected_date')} />
                </Field>
                <Field label="Notes" htmlFor="po-notes">
                  <Textarea id="po-notes" rows={3} placeholder="Shipping terms, references…" {...register('notes')} />
                </Field>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              <Button size="lg" loading={createPo.isPending} onClick={() => void submit('ordered')}>
                Create & mark ordered
              </Button>
              <Button
                variant="secondary"
                size="lg"
                disabled={createPo.isPending}
                onClick={() => void submit('draft')}
              >
                Save as draft
              </Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
