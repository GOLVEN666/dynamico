import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import type { MemberRole, Workspace } from '@/types';

export interface WorkspaceWithRole extends Workspace {
  role: MemberRole;
}

interface WorkspaceContextValue {
  workspaces: WorkspaceWithRole[];
  workspace: WorkspaceWithRole | null;
  role: MemberRole | null;
  /** member, admin or owner — can operate on inventory data */
  canEdit: boolean;
  /** admin or owner — can manage team, settings, workspace */
  canManage: boolean;
  loading: boolean;
  switchWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const STORAGE_KEY = 'dynamico.workspace';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: qk.workspaces(user?.id ?? 'anonymous'),
    enabled: !!user,
    queryFn: async (): Promise<WorkspaceWithRole[]> => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('role, workspace:workspaces(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as unknown as { role: MemberRole; workspace: Workspace }[])
        .filter((row) => row.workspace)
        .map((row) => ({ ...row.workspace, role: row.role }));
    },
  });

  // Keep the selection valid: fall back to the first workspace.
  const workspace = useMemo(() => {
    if (workspaces.length === 0) return null;
    return workspaces.find((w) => w.id === currentId) ?? workspaces[0]!;
  }, [workspaces, currentId]);

  useEffect(() => {
    if (workspace && workspace.id !== currentId) {
      setCurrentId(workspace.id);
      localStorage.setItem(STORAGE_KEY, workspace.id);
    }
  }, [workspace, currentId]);

  const switchWorkspace = useCallback((id: string) => {
    setCurrentId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  }, [queryClient]);

  const role = workspace?.role ?? null;

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      workspace,
      role,
      canEdit: role === 'owner' || role === 'admin' || role === 'member',
      canManage: role === 'owner' || role === 'admin',
      loading: isLoading,
      switchWorkspace,
      refresh,
    }),
    [workspaces, workspace, role, isLoading, switchWorkspace, refresh],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

/**
 * For pages inside the workspace shell, where routing guarantees a
 * workspace exists. Throws if rendered outside that guarantee.
 */
export function useCurrentWorkspace() {
  const { workspace, ...rest } = useWorkspace();
  if (!workspace) throw new Error('No active workspace');
  return { workspace, ...rest };
}
