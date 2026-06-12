import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TriangleAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import {
  useDeleteWorkspace,
  useSettings,
  useUpdateProfile,
  useUpdateSettings,
  useUpdateWorkspace,
} from '@/hooks/useSettings';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK'];
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Vilnius',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

const profileSchema = z.object({ full_name: z.string().min(2, 'Enter your name') });
const workspaceSchema = z.object({ name: z.string().min(2, 'Workspace name is required').max(80) });
const preferencesSchema = z.object({
  currency: z.string(),
  timezone: z.string(),
  low_stock_alerts_enabled: z.boolean(),
  out_of_stock_alerts_enabled: z.boolean(),
});

function ToggleRow({
  label,
  description,
  registration,
}: {
  label: string;
  description: string;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        <span className="mt-0.5 block text-[13px] text-gray-500">{description}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" {...registration} />
        <span className="h-5 w-9 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand-600 after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-card after:transition-transform peer-checked:after:translate-x-4" />
      </span>
    </label>
  );
}

export function Settings() {
  const { profile, user } = useAuth();
  const { workspace, role, canManage } = useCurrentWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateProfile = useUpdateProfile();
  const updateWorkspace = useUpdateWorkspace();
  const updateSettings = useUpdateSettings();
  const deleteWorkspace = useDeleteWorkspace();

  const [deleteOpen, setDeleteOpen] = useState(false);

  // --- profile form
  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { full_name: profile?.full_name ?? '' },
  });

  // --- workspace form
  const workspaceForm = useForm<z.infer<typeof workspaceSchema>>({
    resolver: zodResolver(workspaceSchema),
    values: { name: workspace.name },
  });

  // --- preferences form (reset when settings load)
  const preferencesForm = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      currency: 'USD',
      timezone: 'UTC',
      low_stock_alerts_enabled: true,
      out_of_stock_alerts_enabled: true,
    },
  });

  useEffect(() => {
    if (settings) {
      preferencesForm.reset({
        currency: settings.currency,
        timezone: settings.timezone,
        low_stock_alerts_enabled: settings.low_stock_alerts_enabled,
        out_of_stock_alerts_enabled: settings.out_of_stock_alerts_enabled,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const handleDeleteWorkspace = () => {
    deleteWorkspace.mutate(undefined, {
      onSuccess: () => {
        toast.success('Workspace deleted');
        localStorage.removeItem('dynamico.workspace');
        queryClient.clear();
        navigate('/dashboard');
      },
    });
  };

  return (
    <>
      <PageHeader title="Settings" description="Your account and workspace configuration" />

      <div className="max-w-2xl space-y-5">
        {/* account */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>How you appear to your teammates.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) =>
                void profileForm.handleSubmit((values) =>
                  updateProfile.mutate(values, {
                    onSuccess: () => toast.success('Profile updated'),
                  }),
                )(e)
              }
              className="space-y-4"
              noValidate
            >
              <Field
                label="Full name"
                htmlFor="pf-name"
                error={profileForm.formState.errors.full_name?.message}
              >
                <Input id="pf-name" {...profileForm.register('full_name')} />
              </Field>
              <Field label="Email" htmlFor="pf-email" hint="Email changes are not supported yet.">
                <Input id="pf-email" value={user?.email ?? ''} disabled />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={updateProfile.isPending}>
                  Save profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* workspace */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>
                {canManage
                  ? 'Rename your workspace.'
                  : `Only owners and admins can change these settings (your role: ${role}).`}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) =>
                void workspaceForm.handleSubmit((values) =>
                  updateWorkspace.mutate(values, {
                    onSuccess: () => toast.success('Workspace renamed'),
                  }),
                )(e)
              }
              className="space-y-4"
              noValidate
            >
              <Field
                label="Workspace name"
                htmlFor="ws-name"
                error={workspaceForm.formState.errors.name?.message}
              >
                <Input id="ws-name" disabled={!canManage} {...workspaceForm.register('name')} />
              </Field>
              <Field label="Slug" htmlFor="ws-slug">
                <Input id="ws-slug" value={workspace.slug} disabled className="font-mono" />
              </Field>
              {canManage && (
                <div className="flex justify-end">
                  <Button type="submit" loading={updateWorkspace.isPending}>
                    Save workspace
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* preferences */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Preferences & alerts</CardTitle>
              <CardDescription>Currency, timezone and automatic stock alerts.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <form
                onSubmit={(e) =>
                  void preferencesForm.handleSubmit((values) =>
                    updateSettings.mutate(values, {
                      onSuccess: () => toast.success('Preferences saved'),
                    }),
                  )(e)
                }
                className="space-y-4"
                noValidate
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Currency" htmlFor="pref-currency">
                    <Select
                      id="pref-currency"
                      disabled={!canManage}
                      {...preferencesForm.register('currency')}
                    >
                      {CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Timezone" htmlFor="pref-timezone">
                    <Select
                      id="pref-timezone"
                      disabled={!canManage}
                      {...preferencesForm.register('timezone')}
                    >
                      {TIMEZONES.map((timezone) => (
                        <option key={timezone} value={timezone}>
                          {timezone}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <ToggleRow
                    label="Low stock alerts"
                    description="Raise an alert when stock falls to a product's minimum level."
                    registration={preferencesForm.register('low_stock_alerts_enabled')}
                  />
                  <ToggleRow
                    label="Out of stock alerts"
                    description="Raise an alert when a product hits zero in any warehouse."
                    registration={preferencesForm.register('out_of_stock_alerts_enabled')}
                  />
                </div>

                {canManage && (
                  <div className="flex justify-end">
                    <Button type="submit" loading={updateSettings.isPending}>
                      Save preferences
                    </Button>
                  </div>
                )}
              </form>
            )}
          </CardContent>
        </Card>

        {/* danger zone */}
        {role === 'owner' && (
          <Card className="border-red-200">
            <CardHeader>
              <div>
                <CardTitle className="text-red-700">Danger zone</CardTitle>
                <CardDescription>
                  Deleting a workspace removes all products, stock history, purchase orders and
                  memberships. This cannot be undone.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="danger"
                icon={<TriangleAlert className="h-4 w-4" />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete workspace
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteWorkspace}
        title={`Delete “${workspace.name}”?`}
        description="All data in this workspace — products, warehouses, stock history, purchase orders, alerts and team memberships — will be permanently deleted."
        confirmLabel="Delete everything"
        destructive
        loading={deleteWorkspace.isPending}
      />
    </>
  );
}
