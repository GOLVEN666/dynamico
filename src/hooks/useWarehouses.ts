import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage } from '@/lib/utils';
import type { Warehouse } from '@/types';

export interface WarehouseFormValues {
  name: string;
  location?: string | null;
  is_default?: boolean;
}

export function useWarehouses() {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.warehouses(workspace.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at');
      if (error) throw error;
      return data as Warehouse[];
    },
  });
}

export interface WarehouseTotals {
  units: number;
  value: number;
  skus: number;
}

/** Per-warehouse stock totals, aggregated client-side from stock_levels. */
export function useWarehouseTotals() {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.stockLevels(workspace.id, 'warehouse-totals'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_levels')
        .select('warehouse_id, quantity, product:products(cost_price)')
        .eq('workspace_id', workspace.id);
      if (error) throw error;

      const totals: Record<string, WarehouseTotals> = {};
      for (const row of data as unknown as {
        warehouse_id: string;
        quantity: number;
        product: { cost_price: number } | null;
      }[]) {
        const entry = (totals[row.warehouse_id] ??= { units: 0, value: 0, skus: 0 });
        entry.units += row.quantity;
        entry.value += row.quantity * (row.product?.cost_price ?? 0);
        if (row.quantity > 0) entry.skus += 1;
      }
      return totals;
    },
  });
}

export function useCreateWarehouse() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (values: WarehouseFormValues) => {
      if (values.is_default) {
        await supabase
          .from('warehouses')
          .update({ is_default: false })
          .eq('workspace_id', workspace.id)
          .eq('is_default', true);
      }
      const { data, error } = await supabase
        .from('warehouses')
        .insert({ ...values, workspace_id: workspace.id })
        .select()
        .single();
      if (error) throw error;
      return data as Warehouse;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.warehouses(workspace.id) });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not create warehouse', getErrorMessage(error)),
  });
}

export function useUpdateWarehouse() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: WarehouseFormValues }) => {
      if (values.is_default) {
        await supabase
          .from('warehouses')
          .update({ is_default: false })
          .eq('workspace_id', workspace.id)
          .eq('is_default', true)
          .neq('id', id);
      }
      const { data, error } = await supabase
        .from('warehouses')
        .update(values)
        .eq('id', id)
        .eq('workspace_id', workspace.id)
        .select()
        .single();
      if (error) throw error;
      return data as Warehouse;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.warehouses(workspace.id) });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not update warehouse', getErrorMessage(error)),
  });
}

export function useDeleteWarehouse() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.warehouses(workspace.id) });
      void queryClient.invalidateQueries({ queryKey: ['stock-levels', workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not delete warehouse', getErrorMessage(error)),
  });
}
