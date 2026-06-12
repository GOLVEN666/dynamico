import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invalidateStock, qk } from '@/lib/queryClient';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage } from '@/lib/utils';
import type { PoStatus, PurchaseOrder } from '@/types';

const LIST_SELECT =
  '*, supplier:suppliers(id,name), warehouse:warehouses(id,name), items:purchase_order_items(quantity,unit_cost)';
const DETAIL_SELECT =
  '*, supplier:suppliers(*), warehouse:warehouses(id,name), items:purchase_order_items(*, product:products(id,name,sku))';

export function poTotal(po: PurchaseOrder): number {
  return po.items?.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0) ?? 0;
}

export interface PoFilters {
  status?: PoStatus | '';
  search?: string;
  page?: number;
  pageSize?: number;
}

export function usePurchaseOrders(filters: PoFilters = {}) {
  const { workspace } = useCurrentWorkspace();
  const { status = '', search = '', page = 1, pageSize = 25 } = filters;

  return useQuery({
    queryKey: qk.purchaseOrders(workspace.id, { status, search, page, pageSize }),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(LIST_SELECT, { count: 'exact' })
        .eq('workspace_id', workspace.id);

      if (status) query = query.eq('status', status);
      const s = search.replace(/[%,()]/g, ' ').trim();
      if (s) query = query.ilike('po_number', `%${s}%`);

      const from = (page - 1) * pageSize;
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      return { orders: data as unknown as PurchaseOrder[], total: count ?? 0 };
    },
  });
}

export function usePurchaseOrder(id: string | undefined) {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.purchaseOrder(workspace.id, id ?? 'none'),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(DETAIL_SELECT)
        .eq('workspace_id', workspace.id)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as PurchaseOrder;
    },
  });
}

export interface CreatePoInput {
  supplier_id: string | null;
  warehouse_id: string;
  expected_date?: string | null;
  notes?: string | null;
  /** 'draft' to keep editing, 'ordered' to submit immediately. */
  status: Extract<PoStatus, 'draft' | 'ordered'>;
  items: { product_id: string; quantity: number; unit_cost: number }[];
}

export function useCreatePurchaseOrder() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ items, ...po }: CreatePoInput) => {
      const { data: order, error } = await supabase
        .from('purchase_orders')
        .insert({
          ...po,
          workspace_id: workspace.id,
          ordered_at: po.status === 'ordered' ? new Date().toISOString() : null,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(
        items.map((item) => ({
          ...item,
          workspace_id: workspace.id,
          purchase_order_id: order.id,
        })),
      );
      if (itemsError) {
        // best-effort rollback so a header without lines doesn't linger
        await supabase.from('purchase_orders').delete().eq('id', order.id);
        throw itemsError;
      }

      return order as PurchaseOrder;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders', workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ['analytics', workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not create purchase order', getErrorMessage(error)),
  });
}

export function useUpdatePoStatus() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Extract<PoStatus, 'ordered' | 'cancelled'> }) => {
      const patch: Record<string, unknown> = { status };
      if (status === 'ordered') patch.ordered_at = new Date().toISOString();
      const { error } = await supabase
        .from('purchase_orders')
        .update(patch)
        .eq('id', id)
        .eq('workspace_id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders', workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ['analytics', workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not update purchase order', getErrorMessage(error)),
  });
}

/** Calls the receive_purchase_order RPC: stocks in every outstanding line, closes the PO. */
export function useReceivePurchaseOrder() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('receive_purchase_order', {
        p_purchase_order_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateStock(queryClient, workspace.id);
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders', workspace.id] });
    },
    onError: (error) => toast.error('Could not receive purchase order', getErrorMessage(error)),
  });
}
