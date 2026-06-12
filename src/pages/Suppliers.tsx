import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, MoreHorizontal, Pencil, Phone, Plus, Trash2, Truck } from 'lucide-react';
import type { Supplier } from '@/types';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
} from '@/hooks/useSuppliers';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Field } from '@/components/ui/Field';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { Avatar } from '@/components/ui/Avatar';

const schema = z.object({
  name: z.string().min(2, 'Supplier name is required').max(120),
  contact_name: z.string().optional(),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function Suppliers() {
  const { canEdit } = useCurrentWorkspace();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const { data: suppliers, isLoading } = useSuppliers(search);
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', contact_name: '', email: '', phone: '', address: '', notes: '' });
    setFormOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    reset({
      name: supplier.name,
      contact_name: supplier.contact_name ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
      notes: supplier.notes ?? '',
    });
    setFormOpen(true);
  };

  const onSubmit = handleSubmit((values) => {
    const payload = {
      name: values.name,
      contact_name: values.contact_name?.trim() || null,
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      address: values.address?.trim() || null,
      notes: values.notes?.trim() || null,
    };
    if (editing) {
      updateSupplier.mutate(
        { id: editing.id, values: payload },
        {
          onSuccess: () => {
            toast.success('Supplier updated');
            setFormOpen(false);
          },
        },
      );
    } else {
      createSupplier.mutate(payload, {
        onSuccess: (supplier) => {
          toast.success('Supplier created', `“${supplier.name}” has been added.`);
          setFormOpen(false);
        },
      });
    }
  });

  const handleDelete = () => {
    if (!deleting) return;
    deleteSupplier.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Supplier deleted');
        setDeleting(null);
      },
    });
  };

  const saving = createSupplier.isPending || updateSupplier.isPending;

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier',
      render: (supplier) => (
        <div className="flex items-center gap-3">
          <Avatar name={supplier.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900">{supplier.name}</p>
            {supplier.contact_name && (
              <p className="truncate text-xs text-gray-400">{supplier.contact_name}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      className: 'hidden md:table-cell',
      render: (supplier) =>
        supplier.email ? (
          <a
            href={`mailto:${supplier.email}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-gray-600 hover:text-brand-600"
          >
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            {supplier.email}
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'phone',
      header: 'Phone',
      className: 'hidden lg:table-cell',
      render: (supplier) =>
        supplier.phone ? (
          <span className="inline-flex items-center gap-1.5 text-gray-600">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            {supplier.phone}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'address',
      header: 'Address',
      className: 'hidden xl:table-cell',
      render: (supplier) => (
        <span className="block max-w-56 truncate text-gray-500">{supplier.address ?? '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12 text-right',
      render: (supplier) =>
        canEdit && (
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              trigger={
                <button
                  type="button"
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              }
            >
              <DropdownItem icon={<Pencil />} onClick={() => openEdit(supplier)}>
                Edit
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={<Trash2 />} destructive onClick={() => setDeleting(supplier)}>
                Delete
              </DropdownItem>
            </Dropdown>
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Vendors you purchase inventory from"
        actions={
          canEdit && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Add supplier
            </Button>
          )
        }
      />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search suppliers…"
          className="w-full sm:w-72"
        />
      </div>

      <DataTable
        columns={columns}
        data={suppliers}
        loading={isLoading}
        rowKey={(supplier) => supplier.id}
        onRowClick={canEdit ? openEdit : undefined}
        emptyState={
          <EmptyState
            icon={Truck}
            title={search ? 'No suppliers match' : 'No suppliers yet'}
            description={
              search
                ? 'Try a different search term.'
                : 'Add the vendors you buy from to link them to products and purchase orders.'
            }
            action={
              canEdit &&
              !search && (
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Add supplier
                </Button>
              )
            }
          />
        }
      />

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit supplier' : 'Add supplier'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void onSubmit()} loading={saving}>
              {editing ? 'Save changes' : 'Create supplier'}
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="s-name" required error={errors.name?.message}>
            <Input id="s-name" placeholder="Acme Textiles Co." invalid={!!errors.name} {...register('name')} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contact person" htmlFor="s-contact">
              <Input id="s-contact" placeholder="Jane Cooper" {...register('contact_name')} />
            </Field>
            <Field label="Email" htmlFor="s-email" error={errors.email?.message}>
              <Input
                id="s-email"
                type="email"
                placeholder="orders@acme.com"
                invalid={!!errors.email}
                {...register('email')}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="s-phone">
              <Input id="s-phone" placeholder="+1 555 000 1234" {...register('phone')} />
            </Field>
            <Field label="Address" htmlFor="s-address">
              <Input id="s-address" placeholder="120 Market St, …" {...register('address')} />
            </Field>
          </div>
          <Field label="Notes" htmlFor="s-notes">
            <Textarea id="s-notes" rows={2} placeholder="Payment terms, lead times…" {...register('notes')} />
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete supplier?"
        description={`“${deleting?.name}” will be removed. Products linked to it will keep working but lose the supplier reference.`}
        confirmLabel="Delete supplier"
        destructive
        loading={deleteSupplier.isPending}
      />
    </>
  );
}
