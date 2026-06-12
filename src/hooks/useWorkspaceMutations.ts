import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage, randomSuffix, slugify } from '@/lib/utils';
import type { Workspace } from '@/types';

interface CreateWorkspaceInput {
  name: string;
  warehouseName: string;
  currency: string;
}

/**
 * Onboarding flow: create_workspace RPC (workspace + owner membership +
 * settings, atomically) followed by the default warehouse and currency.
 */
export function useCreateWorkspace() {
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ name, warehouseName, currency }: CreateWorkspaceInput) => {
      const slug = `${slugify(name) || 'workspace'}-${randomSuffix()}`;
      const { data, error } = await supabase.rpc('create_workspace', {
        p_name: name,
        p_slug: slug,
      });
      if (error) throw error;
      const workspace = data as Workspace;

      const { error: warehouseError } = await supabase.from('warehouses').insert({
        workspace_id: workspace.id,
        name: warehouseName,
        is_default: true,
      });
      if (warehouseError) throw warehouseError;

      if (currency !== 'USD') {
        const { error: settingsError } = await supabase
          .from('settings')
          .update({ currency })
          .eq('workspace_id', workspace.id);
        if (settingsError) throw settingsError;
      }

      return workspace;
    },
    onError: (error) => toast.error('Could not create workspace', getErrorMessage(error)),
  });
}
