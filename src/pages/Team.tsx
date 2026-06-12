import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogOut, Trash2, UserPlus, Users } from 'lucide-react';
import type { MemberRole, WorkspaceMember } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import {
  useAddMember,
  useRemoveMember,
  useTeamMembers,
  useUpdateMemberRole,
} from '@/hooks/useTeam';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';

const ASSIGNABLE_ROLES: { value: Exclude<MemberRole, 'owner'>; label: string; hint: string }[] = [
  { value: 'admin', label: 'Admin', hint: 'Manage team, settings and all inventory' },
  { value: 'member', label: 'Member', hint: 'Operate inventory, no workspace management' },
  { value: 'viewer', label: 'Viewer', hint: 'Read-only access' },
];

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  role: z.enum(['admin', 'member', 'viewer']),
});

type FormValues = z.infer<typeof schema>;

export function Team() {
  const { user } = useAuth();
  const { workspace, canManage, switchWorkspace, refresh, workspaces } = useCurrentWorkspace();
  const toast = useToast();
  const navigate = useNavigate();

  const { data: members, isLoading } = useTeamMembers();
  const addMember = useAddMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'member' },
  });

  const onInvite = handleSubmit((values) => {
    addMember.mutate(values, {
      onSuccess: () => {
        toast.success('Member added', `${values.email} now has access to ${workspace.name}.`);
        reset({ email: '', role: 'member' });
        setInviteOpen(false);
      },
    });
  });

  const isSelf = (member: WorkspaceMember) => member.user_id === user?.id;

  const handleRemove = () => {
    if (!removing) return;
    const leaving = isSelf(removing);
    removeMember.mutate(removing.id, {
      onSuccess: async () => {
        setRemoving(null);
        if (leaving) {
          toast.success('You left the workspace');
          localStorage.removeItem('dynamico.workspace');
          await refresh();
          const next = workspaces.find((ws) => ws.id !== workspace.id);
          if (next) switchWorkspace(next.id);
          navigate('/dashboard');
        } else {
          toast.success('Member removed');
        }
      },
    });
  };

  const columns: Column<WorkspaceMember>[] = [
    {
      key: 'member',
      header: 'Member',
      render: (member) => (
        <div className="flex items-center gap-3">
          <Avatar
            name={member.profile?.full_name || member.profile?.email || '?'}
            src={member.profile?.avatar_url}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900">
              {member.profile?.full_name || member.profile?.email}
              {isSelf(member) && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
            </p>
            <p className="truncate text-xs text-gray-400">{member.profile?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (member) => {
        const canChange = canManage && member.role !== 'owner' && !isSelf(member);
        if (!canChange) return <StatusBadge kind="role" status={member.role} />;
        return (
          <Select
            value={member.role}
            className="h-8 w-32"
            onChange={(e) =>
              updateRole.mutate(
                { id: member.id, role: e.target.value as Exclude<MemberRole, 'owner'> },
                { onSuccess: () => toast.success('Role updated') },
              )
            }
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </Select>
        );
      },
    },
    {
      key: 'joined',
      header: 'Joined',
      className: 'hidden sm:table-cell',
      render: (member) => <span className="text-gray-500">{formatDate(member.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (member) => {
        if (member.role === 'owner') return null;
        if (isSelf(member)) {
          return (
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="h-3.5 w-3.5" />}
              onClick={() => setRemoving(member)}
            >
              Leave
            </Button>
          );
        }
        if (!canManage) return null;
        return (
          <button
            type="button"
            title="Remove member"
            onClick={() => setRemoving(member)}
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Team"
        description={`People with access to ${workspace.name}`}
        actions={
          canManage && (
            <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
              Add member
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={members}
        loading={isLoading}
        rowKey={(member) => member.id}
        emptyState={
          <EmptyState icon={Users} title="No members" description="This should not happen — every workspace has an owner." />
        }
      />

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Add a team member"
        description="They must already have a Dynamico account with this email."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)} disabled={addMember.isPending}>
              Cancel
            </Button>
            <Button onClick={() => void onInvite()} loading={addMember.isPending}>
              Add member
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void onInvite(e)} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="invite-email" required error={errors.email?.message}>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@company.com"
              invalid={!!errors.email}
              {...register('email')}
            />
          </Field>
          <Field
            label="Role"
            htmlFor="invite-role"
            hint={ASSIGNABLE_ROLES.map((r) => `${r.label}: ${r.hint.toLowerCase()}`).join(' · ')}
          >
            <Select id="invite-role" {...register('role')}>
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={handleRemove}
        title={removing && isSelf(removing) ? 'Leave workspace?' : 'Remove member?'}
        description={
          removing && isSelf(removing)
            ? `You will lose access to ${workspace.name}. An owner or admin can add you back later.`
            : `${removing?.profile?.full_name || removing?.profile?.email} will immediately lose access to ${workspace.name}.`
        }
        confirmLabel={removing && isSelf(removing) ? 'Leave workspace' : 'Remove member'}
        destructive
        loading={removeMember.isPending}
      />
    </>
  );
}
