import { supabase } from '@/lib/supabase';

const BUCKET = 'product-images';

/**
 * Upload a product image under the workspace's folder
 * (RLS on storage.objects gates by the first path segment).
 * Returns the public URL.
 */
export async function uploadProductImage(workspaceId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Best-effort removal of a previously uploaded image by its public URL. */
export async function deleteProductImage(url: string): Promise<void> {
  const marker = `/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(url.slice(index + marker.length));
  await supabase.storage.from(BUCKET).remove([path]);
}
