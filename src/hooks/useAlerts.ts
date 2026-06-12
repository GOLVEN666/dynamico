import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage } from '@/lib/utils';
import type { Alert, AlertStatus, AlertType } from '@/types';

const ALERT_SELECT = '*, product:products(id,name,sku), warehouse:warehouses(id,name)';

export interface AlertFilters {
  status?: AlertStatus | '';
  type?: AlertType | '';
  limit?: number;
}

export function useAlerts(filters: AlertFilters = {}) {
  const { workspace } = useCurrentWorkspace();
  const { status = 'active', type = '', limit = 100 } = filters;

  return useQuery({
    queryKey: qk.alerts(workspace.id, { status, type, limit }),
    queryFn: async () => {
      let query = supabase
        .from('alerts')
        .select(ALERT_SELECT)
        .eq('workspace_id', workspace.id);
      if (status) query = query.eq('status', status);
      if (type) query = query.eq('type', type);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data as unknown as Alert[];
    },
  });
}

/** Lightweight head-count of active alerts for the topbar bell. */
export function useActiveAlertCount() {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.alerts(workspace.id, 'active-count'),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)
        .eq('status', 'active');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useUpdateAlertStatus() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: Extract<AlertStatus, 'resolved' | 'dismissed'>;
    }) => {
      const { error } = await supabase
        .from('alerts')
        .update({ status, resolved_at: new Date().toISOString() })
        .eq('id', id)
        .eq('workspace_id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts', workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ['analytics', workspace.id] });
    },
    onError: (error) => toast.error('Could not update alert', getErrorMessage(error)),
  });
}
