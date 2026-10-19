import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { instagramFeedApi } from '@/api/endpoints/cms';
import { PageHeader, PageLoader, EmptyState } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { Plus, Trash2 } from 'lucide-react';

export default function InstagramFeedPage() {
  const [showForm, setShowForm] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-instagram-feed'], queryFn: () => instagramFeedApi.list() });
  const { register, handleSubmit, reset } = useForm({ defaultValues: { link: '', caption: '', sortOrder: 0 } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-instagram-feed'] });

  const createMutation = useMutation({
    mutationFn: instagramFeedApi.create,
    onSuccess: () => { invalidate(); setShowForm(false); reset(); setImageFile(null); toast.success('Item added'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: instagramFeedApi.remove,
    onSuccess: () => { invalidate(); toast.success('Item deleted'); },
  });

  const onSubmit = (vals) => {
    if (!imageFile) return toast.error('An image is required');
    const formData = new FormData();
    Object.entries(vals).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') formData.append(k, v); });
    formData.append('image', imageFile);
    createMutation.mutate(formData);
  };

  const items = data?.items || [];

  return (
    <div>
      <PageHeader
        title="Instagram Feed"
        description="Images shown in the homepage's Instagram Feed section."
        action={<button onClick={() => setShowForm((v) => !v)} className="btn-primary"><Plus size={16} /> Add Image</button>}
      />

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="input-field sm:col-span-2" />
          <input {...register('link')} placeholder="Instagram post/profile URL" className="input-field" />
          <input type="number" {...register('sortOrder')} placeholder="Sort Order" className="input-field" />
          <input {...register('caption')} placeholder="Caption (optional)" className="input-field sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? <PageLoader /> : items.length === 0 ? <EmptyState title="No images yet" /> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <div key={item._id} className="group relative aspect-square overflow-hidden rounded-sm bg-night-900/5">
              <img src={item.image.url} alt={item.caption || 'Instagram'} className="h-full w-full object-cover" />
              <button
                onClick={() => deleteMutation.mutate(item._id)}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-red-600 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
