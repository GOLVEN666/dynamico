import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage } from '@/lib/utils';
import type { Category } from '@/types';

export function useCategories() {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.categories(workspace.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
  });
}

export function useCreateCategory() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ workspace_id: workspace.id, name, color })
        .select()
        .single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.categories(workspace.id) });
    },
    onError: (error) => toast.error('Could not create category', getErrorMessage(error)),
  });
}

export function useDeleteCategory() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.categories(workspace.id) });
      void queryClient.invalidateQueries({ queryKey: ['products', workspace.id] });
    },
    onError: (error) => toast.error('Could not delete category', getErrorMessage(error)),
  });
}
