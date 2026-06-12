import { Building2, Package, ShieldCheck, ShieldOff, Users } from 'lucide-react';
import type { AdminWorkspaceRow } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminStats, useAdminWorkspaces } from '@/hooks/useAdmin';
import { formatDate, formatNumber, getInitials } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/Badge';

export function Admin() {
  const { profile } = useAuth();
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: workspaces, isLoading } = useAdminWorkspaces();

  if (!profile?.is_super_admin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon={ShieldOff}
          title="Restricted area"
          description="The platform console is only available to Dynamico administrators."
        />
      </div>
    );
  }

  const columns: Column<AdminWorkspaceRow>[] = [
    {
      key: 'workspace',
      header: 'Workspace',
      render: (workspace) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
            {getInitials(workspace.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900">{workspace.name}</p>
            <p className="truncate font-mono text-xs text-gray-400">{workspace.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (workspace) =>
        workspace.owner ? (
          <div className="min-w-0">
            <p className="truncate text-gray-900">{workspace.owner.full_name || '—'}</p>
            <p className="truncate text-xs text-gray-400">{workspace.owner.email}</p>
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'members',
      header: 'Members',
      className: 'hidden sm:table-cell',
      render: (workspace) => (
        <Badge variant="gray">{workspace.members?.[0]?.count ?? 0}</Badge>
      ),
    },
    {
      key: 'products',
      header: 'Products',
      className: 'hidden sm:table-cell',
      render: (workspace) => (
        <span className="text-gray-700 tabular-nums">
          {formatNumber(workspace.products?.[0]?.count ?? 0)}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      className: 'hidden md:table-cell',
      render: (workspace) => (
        <span className="text-gray-500">{formatDate(workspace.created_at)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Platform console
            <Badge variant="brand">
              <ShieldCheck className="h-3 w-3" />
              Super admin
            </Badge>
          </span>
        }
        description="Every brand account on Dynamico — read-only platform overview"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Accounts"
          value={formatNumber(stats?.users ?? 0)}
          icon={Users}
          loading={statsLoading}
        />
        <StatCard
          label="Workspaces"
          value={formatNumber(stats?.workspaces ?? 0)}
          icon={Building2}
          tone="bg-sky-50 text-sky-600"
          loading={statsLoading}
        />
        <StatCard
          label="Products tracked"
          value={formatNumber(stats?.products ?? 0)}
          icon={Package}
          tone="bg-emerald-50 text-emerald-600"
          loading={statsLoading}
        />
      </div>

      <div className="mt-5">
        <DataTable
          columns={columns}
          data={workspaces}
          loading={isLoading}
          rowKey={(workspace) => workspace.id}
          emptyState={
            <EmptyState
              icon={Building2}
              title="No workspaces yet"
              description="Brand workspaces appear here as users sign up."
            />
          }
        />
      </div>
    </>
  );
}
