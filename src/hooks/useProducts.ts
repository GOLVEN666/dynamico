import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invalidateStock, qk } from '@/lib/queryClient';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage } from '@/lib/utils';
import { deleteProductImage, uploadProductImage } from '@/lib/storage';
import type { Product, ProductStatus } from '@/types';

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  status?: ProductStatus | '';
  page?: number;
  pageSize?: number;
}

export interface ProductFormValues {
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  category_id?: string | null;
  supplier_id?: string | null;
  cost_price: number;
  selling_price: number;
  minimum_stock: number;
  status: ProductStatus;
}

const LIST_SELECT =
  '*, category:categories(id,name,color), images:product_images(*), stock_levels(quantity)';
const DETAIL_SELECT =
  '*, category:categories(*), supplier:suppliers(*), images:product_images(*), stock_levels(*, warehouse:warehouses(id,name))';

/** PostgREST or() filters treat commas/parens as syntax — strip them. */
function sanitizeSearch(value: string) {
  return value.replace(/[%,()]/g, ' ').trim();
}

export function totalStock(product: Product): number {
  return product.stock_levels?.reduce((sum, level) => sum + level.quantity, 0) ?? 0;
}

export function useProducts(filters: ProductFilters = {}) {
  const { workspace } = useCurrentWorkspace();
  const { search = '', categoryId = '', status = '', page = 1, pageSize = 25 } = filters;

  return useQuery({
    queryKey: qk.products(workspace.id, { search, categoryId, status, page, pageSize }),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(LIST_SELECT, { count: 'exact' })
        .eq('workspace_id', workspace.id);

      if (status) query = query.eq('status', status);
      if (categoryId) query = query.eq('category_id', categoryId);
      const s = sanitizeSearch(search);
      if (s) query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.ilike.%${s}%`);

      const from = (page - 1) * pageSize;
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      return { products: data as unknown as Product[], total: count ?? 0 };
    },
  });
}

/** Lightweight id/name/sku list for select dropdowns. */
export function useProductOptions() {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.products(workspace.id, 'options'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, cost_price')
        .eq('workspace_id', workspace.id)
        .neq('status', 'archived')
        .order('name')
        .limit(500);
      if (error) throw error;
      return data as Pick<Product, 'id' | 'name' | 'sku' | 'cost_price'>[];
    },
  });
}

export function useProduct(id: string | undefined) {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.product(workspace.id, id ?? 'none'),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(DETAIL_SELECT)
        .eq('workspace_id', workspace.id)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as Product;
    },
  });
}

interface CreateProductInput {
  values: ProductFormValues;
  /** Optional opening stock per warehouse — becomes 'in' ledger entries. */
  initialStock?: { warehouse_id: string; quantity: number }[];
  imageFile?: File | null;
}

export function useCreateProduct() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ values, initialStock = [], imageFile }: CreateProductInput) => {
      const { data: product, error } = await supabase
        .from('products')
        .insert({ ...values, workspace_id: workspace.id })
        .select()
        .single();
      if (error) throw error;

      if (imageFile) {
        const url = await uploadProductImage(workspace.id, imageFile);
        const { error: imageError } = await supabase.from('product_images').insert({
          workspace_id: workspace.id,
          product_id: product.id,
          url,
          is_primary: true,
        });
        if (imageError) throw imageError;
      }

      const movements = initialStock
        .filter((row) => row.quantity > 0)
        .map((row) => ({
          workspace_id: workspace.id,
          product_id: product.id,
          warehouse_id: row.warehouse_id,
          type: 'in' as const,
          quantity: row.quantity,
          reference: 'INITIAL',
          notes: 'Initial stock',
        }));
      if (movements.length > 0) {
        const { error: movementError } = await supabase.from('stock_movements').insert(movements);
        if (movementError) throw movementError;
      }

      return product as Product;
    },
    onSuccess: () => invalidateStock(queryClient, workspace.id),
    onError: (error) => toast.error('Could not create product', getErrorMessage(error)),
  });
}

interface UpdateProductInput {
  id: string;
  values: Partial<ProductFormValues>;
  imageFile?: File | null;
}

export function useUpdateProduct() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, values, imageFile }: UpdateProductInput) => {
      const { data: product, error } = await supabase
        .from('products')
        .update(values)
        .eq('id', id)
        .eq('workspace_id', workspace.id)
        .select()
        .single();
      if (error) throw error;

      if (imageFile) {
        // single primary image model: replace whatever exists
        const { data: existing } = await supabase
          .from('product_images')
          .select('id, url')
          .eq('product_id', id);
        if (existing && existing.length > 0) {
          await supabase.from('product_images').delete().eq('product_id', id);
          await Promise.allSettled(existing.map((img) => deleteProductImage(img.url)));
        }
        const url = await uploadProductImage(workspace.id, imageFile);
        const { error: imageError } = await supabase.from('product_images').insert({
          workspace_id: workspace.id,
          product_id: id,
          url,
          is_primary: true,
        });
        if (imageError) throw imageError;
      }

      return product as Product;
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['products', workspace.id] });
      void queryClient.invalidateQueries({ queryKey: qk.product(workspace.id, id) });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not update product', getErrorMessage(error)),
  });
}

export function useArchiveProduct() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ status: archive ? 'archived' : 'active' })
        .eq('id', id)
        .eq('workspace_id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products', workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not update product', getErrorMessage(error)),
  });
}

export function useDeleteProduct() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: images } = await supabase
        .from('product_images')
        .select('url')
        .eq('product_id', id);

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspace.id);
      if (error) throw error;

      if (images) {
        await Promise.allSettled(images.map((img) => deleteProductImage(img.url)));
      }
    },
    onSuccess: () => invalidateStock(queryClient, workspace.id),
    onError: (error) => toast.error('Could not delete product', getErrorMessage(error)),
  });
}
