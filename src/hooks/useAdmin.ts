import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminStats, AdminWorkspaceRow } from '@/types';

/**
 * Platform console queries. RLS only returns cross-tenant rows for
 * profiles flagged is_super_admin; for everyone else these stay disabled.
 */
export function useAdminWorkspaces() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: qk.adminWorkspaces(),
    enabled: !!profile?.is_super_admin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .select(
          '*, owner:profiles!workspaces_created_by_fkey(id,full_name,email), ' +
            'members:workspace_members(count), products(count)',
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as AdminWorkspaceRow[];
    },
  });
}

export function useAdminStats() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: qk.adminStats(),
    enabled: !!profile?.is_super_admin,
    queryFn: async (): Promise<AdminStats> => {
      const [users, workspaces, products] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('workspaces').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
      ]);
      const firstError = users.error ?? workspaces.error ?? products.error;
      if (firstError) throw firstError;
      return {
        users: users.count ?? 0,
        workspaces: workspaces.count ?? 0,
        products: products.count ?? 0,
      };
    },
  });
}
