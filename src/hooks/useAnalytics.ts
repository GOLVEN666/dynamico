import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import type { CategoryStock, DashboardStats, MovementSeriesPoint, TopProduct } from '@/types';

export function useDashboardStats() {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.dashboardStats(workspace.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_workspace_id: workspace.id,
      });
      if (error) throw error;
      return data as DashboardStats;
    },
  });
}

export function useMovementSeries(days = 30) {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.movementSeries(workspace.id, days),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_movement_series', {
        p_workspace_id: workspace.id,
        p_days: days,
      });
      if (error) throw error;
      return data as MovementSeriesPoint[];
    },
  });
}

export function useStockByCategory() {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.stockByCategory(workspace.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_stock_by_category', {
        p_workspace_id: workspace.id,
      });
      if (error) throw error;
      return data as CategoryStock[];
    },
  });
}

export function useTopProducts(limit = 5) {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.topProducts(workspace.id, limit),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_products', {
        p_workspace_id: workspace.id,
        p_limit: limit,
      });
      if (error) throw error;
      return data as TopProduct[];
    },
  });
}
