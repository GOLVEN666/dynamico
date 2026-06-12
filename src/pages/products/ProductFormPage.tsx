import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { useCreateProduct, useProduct, useUpdateProduct } from '@/hooks/useProducts';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ProductForm, type ProductFormSubmit } from '@/components/products/ProductForm';

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const { data: product, isLoading } = useProduct(id);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const handleSubmit = ({ values, initialStock, imageFile }: ProductFormSubmit) => {
    if (isEdit) {
      updateProduct.mutate(
        { id: id!, values, imageFile },
        {
          onSuccess: () => {
            toast.success('Product updated', `“${values.name}” has been saved.`);
            navigate(`/products/${id}`);
          },
        },
      );
    } else {
      createProduct.mutate(
        { values, initialStock, imageFile },
        {
          onSuccess: (created) => {
            toast.success('Product created', `“${created.name}” is now in your catalog.`);
            navigate(`/products/${created.id}`);
          },
        },
      );
    }
  };

  if (isEdit && isLoading) {
    return <LoadingSkeleton variant="detail" />;
  }

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit ${product?.name ?? 'product'}` : 'Add product'}
        backTo={{
          to: isEdit ? `/products/${id}` : '/products',
          label: isEdit ? 'Back to product' : 'Back to products',
        }}
      />
      <ProductForm
        product={isEdit ? product : undefined}
        submitting={createProduct.isPending || updateProduct.isPending}
        onSubmit={handleSubmit}
      />
    </>
  );
}
