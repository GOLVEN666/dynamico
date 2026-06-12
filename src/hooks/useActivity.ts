import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import type { ActivityLog } from '@/types';

const LOG_SELECT = '*, user:profiles(id,full_name,email,avatar_url)';

export interface ActivityFilters {
  entityType?: string;
  page?: number;
  pageSize?: number;
}

export function useActivityLogs(filters: ActivityFilters = {}) {
  const { workspace } = useCurrentWorkspace();
  const { entityType = '', page = 1, pageSize = 25 } = filters;

  return useQuery({
    queryKey: qk.activity(workspace.id, { entityType, page, pageSize }),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select(LOG_SELECT, { count: 'exact' })
        .eq('workspace_id', workspace.id);
      if (entityType) query = query.eq('entity_type', entityType);

      const from = (page - 1) * pageSize;
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      return { logs: data as unknown as ActivityLog[], total: count ?? 0 };
    },
  });
}

/** Most recent activity for the dashboard feed. */
export function useRecentActivity(limit = 8) {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.activity(workspace.id, { recent: limit }),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(LOG_SELECT)
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as ActivityLog[];
    },
  });
}
