import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invalidateStock, qk } from '@/lib/queryClient';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage } from '@/lib/utils';
import type { MovementType, StockLevel, StockMovement } from '@/types';

const MOVEMENT_SELECT =
  '*, product:products(id,name,sku), warehouse:warehouses(id,name), ' +
  'created_by_profile:profiles!stock_movements_created_by_fkey(id,full_name,email)';

export interface MovementFilters {
  productId?: string;
  warehouseId?: string;
  type?: MovementType | '';
  page?: number;
  pageSize?: number;
}

export function useStockMovements(filters: MovementFilters = {}) {
  const { workspace } = useCurrentWorkspace();
  const { productId = '', warehouseId = '', type = '', page = 1, pageSize = 25 } = filters;

  return useQuery({
    queryKey: qk.movements(workspace.id, { productId, warehouseId, type, page, pageSize }),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      let query = supabase
        .from('stock_movements')
        .select(MOVEMENT_SELECT, { count: 'exact' })
        .eq('workspace_id', workspace.id);

      if (productId) query = query.eq('product_id', productId);
      if (warehouseId) query = query.eq('warehouse_id', warehouseId);
      if (type) query = query.eq('type', type);

      const from = (page - 1) * pageSize;
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      return { movements: data as unknown as StockMovement[], total: count ?? 0 };
    },
  });
}

/** Stock levels for a product across warehouses (e.g. transfer modal). */
export function useStockLevels(productId: string | undefined) {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.stockLevels(workspace.id, { productId }),
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_levels')
        .select('*, warehouse:warehouses(id,name)')
        .eq('workspace_id', workspace.id)
        .eq('product_id', productId!);
      if (error) throw error;
      return data as unknown as StockLevel[];
    },
  });
}

export interface CreateMovementInput {
  product_id: string;
  warehouse_id: string;
  type: Extract<MovementType, 'in' | 'out' | 'adjustment'>;
  /** Positive for in/out; signed delta for adjustments. */
  quantity: number;
  reference?: string | null;
  notes?: string | null;
}

export function useCreateMovement() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: CreateMovementInput) => {
      const { data, error } = await supabase
        .from('stock_movements')
        .insert({ ...input, workspace_id: workspace.id })
        .select()
        .single();
      if (error) throw error;
      return data as StockMovement;
    },
    onSuccess: () => invalidateStock(queryClient, workspace.id),
    onError: (error) => toast.error('Movement failed', getErrorMessage(error)),
  });
}

export interface TransferInput {
  product_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  quantity: number;
  notes?: string | null;
}

export function useTransferStock() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: TransferInput) => {
      const { error } = await supabase.rpc('transfer_stock', {
        p_product_id: input.product_id,
        p_from_warehouse_id: input.from_warehouse_id,
        p_to_warehouse_id: input.to_warehouse_id,
        p_quantity: input.quantity,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateStock(queryClient, workspace.id),
    onError: (error) => toast.error('Transfer failed', getErrorMessage(error)),
  });
}
