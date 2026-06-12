import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage } from '@/lib/utils';
import type { WorkspaceSettings } from '@/types';

export function useUpdateProfile() {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();

  return useMutation({
    mutationFn: async (values: { full_name: string }) => {
      const { error } = await supabase.from('profiles').update(values).eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => void refreshProfile(),
    onError: (error) => toast.error('Could not update profile', getErrorMessage(error)),
  });
}

export function useSettings() {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.settings(workspace.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('workspace_id', workspace.id)
        .single();
      if (error) throw error;
      return data as WorkspaceSettings;
    },
  });
}

export function useUpdateSettings() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (
      values: Partial<
        Pick<
          WorkspaceSettings,
          'currency' | 'timezone' | 'low_stock_alerts_enabled' | 'out_of_stock_alerts_enabled'
        >
      >,
    ) => {
      const { data, error } = await supabase
        .from('settings')
        .update(values)
        .eq('workspace_id', workspace.id)
        .select()
        .single();
      if (error) throw error;
      return data as WorkspaceSettings;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.settings(workspace.id) });
    },
    onError: (error) => toast.error('Could not save settings', getErrorMessage(error)),
  });
}

export function useUpdateWorkspace() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (values: { name: string }) => {
      const { error } = await supabase
        .from('workspaces')
        .update(values)
        .eq('id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
    onError: (error) => toast.error('Could not rename workspace', getErrorMessage(error)),
  });
}

export function useDeleteWorkspace() {
  const { workspace } = useCurrentWorkspace();
  const toast = useToast();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('workspaces').delete().eq('id', workspace.id);
      if (error) throw error;
    },
    onError: (error) => toast.error('Could not delete workspace', getErrorMessage(error)),
  });
}
