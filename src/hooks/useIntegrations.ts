import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage } from '@/lib/utils';
import type { ExternalOrder, WebhookEndpoint, WebhookSource } from '@/types';

export function useWebhookEndpoints() {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.webhookEndpoints(workspace.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_endpoints')
        .select('*, warehouse:warehouses(id,name)')
        .eq('workspace_id', workspace.id)
        .order('created_at');
      if (error) throw error;
      return data as unknown as WebhookEndpoint[];
    },
  });
}

export interface EndpointFormValues {
  name: string;
  source: WebhookSource;
  warehouse_id: string;
}

export function useCreateEndpoint() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (values: EndpointFormValues) => {
      const { data, error } = await supabase
        .from('webhook_endpoints')
        .insert({ ...values, workspace_id: workspace.id })
        .select('*, warehouse:warehouses(id,name)')
        .single();
      if (error) throw error;
      return data as unknown as WebhookEndpoint;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.webhookEndpoints(workspace.id) });
    },
    onError: (error) => toast.error('Could not create endpoint', getErrorMessage(error)),
  });
}

export function useUpdateEndpoint() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<EndpointFormValues> & { is_active?: boolean } }) => {
      const { error } = await supabase
        .from('webhook_endpoints')
        .update(values)
        .eq('id', id)
        .eq('workspace_id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.webhookEndpoints(workspace.id) });
    },
    onError: (error) => toast.error('Could not update endpoint', getErrorMessage(error)),
  });
}

export function useDeleteEndpoint() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhook_endpoints')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.webhookEndpoints(workspace.id) });
    },
    onError: (error) => toast.error('Could not delete endpoint', getErrorMessage(error)),
  });
}

export function useExternalOrders(params: { page?: number; pageSize?: number } = {}) {
  const { workspace } = useCurrentWorkspace();
  const { page = 1, pageSize = 25 } = params;

  return useQuery({
    queryKey: qk.externalOrders(workspace.id, { page, pageSize }),
    placeholderData: (previous) => previous,
    refetchInterval: 60_000, // orders arrive from outside the app
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const { data, error, count } = await supabase
        .from('external_orders')
        .select('*, endpoint:webhook_endpoints(id,name)', { count: 'exact' })
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      return { orders: data as unknown as ExternalOrder[], total: count ?? 0 };
    },
  });
}
