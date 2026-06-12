import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ImagePlus, Plus, X } from 'lucide-react';
import type { Product, ProductStatus } from '@/types';
import type { ProductFormValues } from '@/hooks/useProducts';
import { useCategories, useCreateCategory } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useWarehouses } from '@/hooks/useWarehouses';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const schema = z.object({
  name: z.string().min(2, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required').max(60),
  barcode: z.string().optional(),
  description: z.string().optional(),
  category_id: z.string().optional(),
  supplier_id: z.string().optional(),
  cost_price: z.coerce.number().min(0, 'Must be 0 or more'),
  selling_price: z.coerce.number().min(0, 'Must be 0 or more'),
  minimum_stock: z.coerce.number().int('Whole numbers only').min(0, 'Must be 0 or more'),
  status: z.enum(['draft', 'active', 'archived']),
});

type FormValues = z.infer<typeof schema>;

const CATEGORY_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

export interface ProductFormSubmit {
  values: ProductFormValues;
  initialStock: { warehouse_id: string; quantity: number }[];
  imageFile: File | null;
}

interface ProductFormProps {
  /** Edit mode when provided. */
  product?: Product;
  submitting: boolean;
  onSubmit: (data: ProductFormSubmit) => void;
}

export function ProductForm({ product, submitting, onSubmit }: ProductFormProps) {
  const navigate = useNavigate();
  const isEdit = !!product;

  const { data: categories = [] } = useCategories();
  const { data: suppliers = [] } = useSuppliers();
  const { data: warehouses = [] } = useWarehouses();
  const createCategory = useCreateCategory();

  const [initialStock, setInitialStock] = useState<Record<string, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const existingImage = product?.images?.[0]?.url ?? null;
  const imagePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : existingImage),
    [imageFile, existingImage],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode ?? '',
          description: product.description ?? '',
          category_id: product.category_id ?? '',
          supplier_id: product.supplier_id ?? '',
          cost_price: product.cost_price,
          selling_price: product.selling_price,
          minimum_stock: product.minimum_stock,
          status: product.status,
        }
      : {
          name: '',
          sku: '',
          barcode: '',
          description: '',
          category_id: '',
          supplier_id: '',
          cost_price: 0,
          selling_price: 0,
          minimum_stock: 0,
          status: 'active' as ProductStatus,
        },
  });

  const costPrice = watch('cost_price');
  const sellingPrice = watch('selling_price');
  const margin =
    Number(sellingPrice) > 0
      ? Math.round(((Number(sellingPrice) - Number(costPrice)) / Number(sellingPrice)) * 100)
      : null;

  const submit = handleSubmit((values) => {
    onSubmit({
      values: {
        ...values,
        barcode: values.barcode?.trim() || null,
        description: values.description?.trim() || null,
        category_id: values.category_id || null,
        supplier_id: values.supplier_id || null,
      },
      initialStock: Object.entries(initialStock)
        .map(([warehouse_id, qty]) => ({ warehouse_id, quantity: Number(qty) || 0 }))
        .filter((row) => row.quantity > 0),
      imageFile,
    });
  });

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]!;
    createCategory.mutate(
      { name, color },
      {
        onSuccess: (category) => {
          setValue('category_id', category.id);
          setNewCategoryName('');
          setShowCategoryForm(false);
        },
      },
    );
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Name" htmlFor="p-name" required error={errors.name?.message}>
                <Input
                  id="p-name"
                  placeholder="Organic Cotton T-Shirt"
                  invalid={!!errors.name}
                  {...register('name')}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="SKU" htmlFor="p-sku" required error={errors.sku?.message}>
                  <Input
                    id="p-sku"
                    placeholder="TSHIRT-BLK-M"
                    invalid={!!errors.sku}
                    {...register('sku')}
                  />
                </Field>
                <Field label="Barcode" htmlFor="p-barcode" hint="EAN, UPC or custom">
                  <Input id="p-barcode" placeholder="0123456789012" {...register('barcode')} />
                </Field>
              </div>
              <Field label="Description" htmlFor="p-description">
                <Textarea
                  id="p-description"
                  rows={3}
                  placeholder="Optional internal notes about this product…"
                  {...register('description')}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Cost price" htmlFor="p-cost" error={errors.cost_price?.message}>
                  <Input
                    id="p-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    invalid={!!errors.cost_price}
                    {...register('cost_price')}
                  />
                </Field>
                <Field
                  label="Selling price"
                  htmlFor="p-price"
                  error={errors.selling_price?.message}
                  hint={margin !== null ? `Margin: ${margin}%` : undefined}
                >
                  <Input
                    id="p-price"
                    type="number"
                    step="0.01"
                    min="0"
                    invalid={!!errors.selling_price}
                    {...register('selling_price')}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          {!isEdit && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Initial stock</CardTitle>
                  <p className="mt-0.5 text-[13px] text-gray-500">
                    Opening quantities are recorded as stock-in movements.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {warehouses.length === 0 ? (
                  <p className="text-[13px] text-gray-500">
                    No warehouses yet — create one first to set opening stock.
                  </p>
                ) : (
                  warehouses.map((warehouse) => (
                    <div key={warehouse.id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-gray-700">
                          {warehouse.name}
                        </p>
                        {warehouse.location && (
                          <p className="truncate text-xs text-gray-400">{warehouse.location}</p>
                        )}
                      </div>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-28"
                        value={initialStock[warehouse.id] ?? ''}
                        onChange={(e) =>
                          setInitialStock((prev) => ({ ...prev, [warehouse.id]: e.target.value }))
                        }
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* side column */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select {...register('status')}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Category" htmlFor="p-category">
                <div className="space-y-2">
                  <Select id="p-category" {...register('category_id')}>
                    <option value="">No category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                  {showCategoryForm ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCategory();
                          }
                        }}
                      />
                      <Button
                        size="md"
                        variant="secondary"
                        loading={createCategory.isPending}
                        onClick={handleAddCategory}
                      >
                        Add
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCategoryForm(true)}
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New category
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Supplier" htmlFor="p-supplier">
                <Select id="p-supplier" {...register('supplier_id')}>
                  <option value="">No supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reorder point</CardTitle>
            </CardHeader>
            <CardContent>
              <Field
                label="Minimum stock"
                htmlFor="p-min"
                error={errors.minimum_stock?.message}
                hint="Alerts trigger when total per warehouse falls to this level."
              >
                <Input
                  id="p-min"
                  type="number"
                  min="0"
                  invalid={!!errors.minimum_stock}
                  {...register('minimum_stock')}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Image</CardTitle>
            </CardHeader>
            <CardContent>
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="h-40 w-full rounded-lg border border-gray-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageFile(null)}
                    className="absolute top-2 right-2 rounded-full bg-gray-900/60 p-1 text-white hover:bg-gray-900/80"
                    title="Remove selection"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-gray-400 transition-colors hover:border-brand-300 hover:text-brand-500">
                  <ImagePlus className="h-6 w-6" />
                  <span className="mt-2 text-[13px] font-medium">Upload image</span>
                  <span className="text-xs">PNG, JPG up to 5 MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
              {imageFile && (
                <p className="mt-2 truncate text-xs text-gray-500">{imageFile.name}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-5">
        <Button variant="secondary" onClick={() => navigate(-1)} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {isEdit ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}
