import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage } from '@/lib/utils';
import type { MemberRole, WorkspaceMember } from '@/types';

export function useTeamMembers() {
  const { workspace } = useCurrentWorkspace();

  return useQuery({
    queryKey: qk.team(workspace.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('*, profile:profiles(*)')
        .eq('workspace_id', workspace.id)
        .order('created_at');
      if (error) throw error;
      return data as unknown as WorkspaceMember[];
    },
  });
}

export function useAddMember() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: MemberRole }) => {
      const { data, error } = await supabase.rpc('add_member_by_email', {
        p_workspace_id: workspace.id,
        p_email: email,
        p_role: role,
      });
      if (error) throw error;
      return data as WorkspaceMember;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.team(workspace.id) });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not add member', getErrorMessage(error)),
  });
}

export function useUpdateMemberRole() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Exclude<MemberRole, 'owner'> }) => {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role })
        .eq('id', id)
        .eq('workspace_id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.team(workspace.id) });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not change role', getErrorMessage(error)),
  });
}

export function useRemoveMember() {
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.team(workspace.id) });
      void queryClient.invalidateQueries({ queryKey: ['activity', workspace.id] });
    },
    onError: (error) => toast.error('Could not remove member', getErrorMessage(error)),
  });
}
