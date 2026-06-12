import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage } from '@/lib/utils';
import type { Supplier } from '@/types';

export interface SupplierFormValues {
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export function useSuppliers(search = '') {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.suppliers(workspace.id, { search }),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      let query = supabase
        .from('suppliers')
        .select('*')
        .eq('workspace_id', workspace.id);
      const s = search.replace(/[%,()]/g, ' ').trim();
      if (s) query = query.or(`name.ilike.%${s}%,contact_name.ilike.%${s}%,email.ilike.%${s}%`);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useCreateSupplier() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (values: SupplierFormValues) => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({ ...values, workspace_id: workspace.id })
        .select()
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['suppliers', workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not create supplier', getErrorMessage(error)),
  });
}

export function useUpdateSupplier() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SupplierFormValues }) => {
      const { data, error } = await supabase
        .from('suppliers')
        .update(values)
        .eq('id', id)
        .eq('workspace_id', workspace.id)
        .select()
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['suppliers', workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not update supplier', getErrorMessage(error)),
  });
}

export function useDeleteSupplier() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['suppliers', workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not delete supplier', getErrorMessage(error)),
  });
}
