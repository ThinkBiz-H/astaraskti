import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { testimonialsApi } from '@/api/endpoints/cms';
import { PageHeader, PageLoader, Badge, EmptyState } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { Plus, Pencil, Trash2, Power, Star } from 'lucide-react';

export default function TestimonialsPage() {
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-testimonials'], queryFn: () => testimonialsApi.list() });
  const { register, handleSubmit, reset } = useForm();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] });

  const createMutation = useMutation({
    mutationFn: testimonialsApi.create,
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Testimonial created'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => testimonialsApi.update(id, formData),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Testimonial updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const toggleMutation = useMutation({
    mutationFn: testimonialsApi.toggleStatus,
    onSuccess: () => { invalidate(); toast.success('Status toggled'); },
  });
  const deleteMutation = useMutation({
    mutationFn: testimonialsApi.remove,
    onSuccess: () => { invalidate(); toast.success('Testimonial deleted'); },
  });

  const startEdit = (t) => {
    setEditing(t || 'new');
    reset(t || { customerName: '', designation: '', content: '', rating: 5 });
    setImageFile(null);
  };

  const onSubmit = (vals) => {
    const formData = new FormData();
    Object.entries(vals).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') formData.append(k, v);
    });
    if (imageFile) formData.append('customerImage', imageFile);

    if (editing?._id) updateMutation.mutate({ id: editing._id, formData });
    else createMutation.mutate(formData);
  };

  const testimonials = data?.testimonials || [];

  return (
    <div>
      <PageHeader
        title="Testimonials"
        description="Customer reviews shown on the homepage's Testimonials section."
        action={<button onClick={() => startEdit(null)} className="btn-primary"><Plus size={16} /> Add Testimonial</button>}
      />

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <input {...register('customerName', { required: true })} placeholder="Customer Name" className="input-field" />
          <input {...register('designation')} placeholder="Designation (e.g. Verified Customer, Mumbai)" className="input-field" />
          <select {...register('rating')} className="input-field">
            {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''}</option>)}
          </select>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="input-field" />
          <textarea {...register('content', { required: true })} placeholder="Testimonial text" className="input-field sm:col-span-2" rows={3} />
          <input type="number" {...register('sortOrder')} placeholder="Sort Order" className="input-field" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('isActive')} defaultChecked /> Active</label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : testimonials.length === 0 ? <EmptyState title="No testimonials yet" /> : (
          <table className="w-full">
            <thead><tr className="table-head">
              <th className="px-4 py-3">Customer</th><th className="px-4 py-3">Rating</th><th className="px-4 py-3">Content</th>
              <th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {testimonials.map((t) => (
                <tr key={t._id} className="table-row">
                  <td className="px-4 py-3 font-medium">{t.customerName}<div className="text-xs font-normal text-night-900/50">{t.designation}</div></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-0.5">{Array.from({ length: t.rating }).map((_, i) => <Star key={i} size={13} className="fill-gold-400 text-gold-400" />)}</div></td>
                  <td className="max-w-sm truncate px-4 py-3 text-night-900/60">{t.content}</td>
                  <td className="px-4 py-3"><Badge tone={t.isActive ? 'success' : 'default'}>{t.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(t)} className="text-gold-600"><Pencil size={15} /></button>
                      <button onClick={() => toggleMutation.mutate(t._id)} className="text-blue-600"><Power size={15} /></button>
                      <button onClick={() => deleteMutation.mutate(t._id)} className="text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
