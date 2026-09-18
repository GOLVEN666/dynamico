import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { useCreateWorkspace } from '@/hooks/useWorkspaceMutations';
import { slugify } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Card } from '@/components/ui/Card';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

const schema = z.object({
  name: z.string().min(2, 'Give your workspace a name').max(80),
  warehouseName: z.string().min(2, 'Name your first warehouse').max(80),
  currency: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function Onboarding() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const { workspaces, loading, switchWorkspace, refresh } = useWorkspace();
  const createWorkspace = useCreateWorkspace();

  // "?new=1" allows creating an additional workspace from the switcher
  const isAdditional = params.get('new') === '1';

  useEffect(() => {
    if (!loading && workspaces.length > 0 && !isAdditional) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, workspaces.length, isAdditional, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', warehouseName: 'Main Warehouse', currency: 'USD' },
  });

  const name = watch('name');

  const onSubmit = handleSubmit((values) => {
    createWorkspace.mutate(values, {
      onSuccess: async (workspace) => {
        await refresh();
        switchWorkspace(workspace.id);
        toast.success('Workspace ready', `“${workspace.name}” is set up. Welcome aboard!`);
        navigate('/dashboard');
      },
    });
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="flex items-center gap-2.5">
        <img src="/logo-full.svg" alt="Dynamico logo" className="h-[13px] w-auto" />
      </div>

      <Card className="mt-8 w-full max-w-md p-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
          {isAdditional ? 'Create a new workspace' : 'Set up your workspace'}
        </h1>
        <p className="mt-1.5 text-[13px] text-gray-500">
          A workspace holds your products, warehouses and team. You can invite teammates later.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4" noValidate>
          <Field
            label="Workspace name"
            htmlFor="ws-name"
            required
            error={errors.name?.message}
            hint={name ? `URL slug: ${slugify(name)}` : undefined}
          >
            <Input
              id="ws-name"
              placeholder="Acme Goods"
              invalid={!!errors.name}
              {...register('name')}
            />
          </Field>

          <Field
            label="First warehouse"
            htmlFor="ws-warehouse"
            required
            error={errors.warehouseName?.message}
            hint="Where your stock lives — you can add more later."
          >
            <Input id="ws-warehouse" invalid={!!errors.warehouseName} {...register('warehouseName')} />
          </Field>

          <Field label="Currency" htmlFor="ws-currency">
            <Select id="ws-currency" {...register('currency')}>
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </Field>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={createWorkspace.isPending}
          >
            {isAdditional ? 'Create workspace' : 'Launch workspace'}
          </Button>
        </form>
      </Card>

      {isAdditional && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 text-[13px] font-medium text-gray-500 hover:text-gray-900"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
