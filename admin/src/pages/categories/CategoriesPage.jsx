import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { categoriesApi } from '@/api/endpoints/catalog';
import { PageHeader, PageLoader, Badge, EmptyState } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function CategoriesPage() {
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-categories'], queryFn: () => categoriesApi.list() });
  const { register, handleSubmit, reset } = useForm();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] });

  const createMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Category created'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => categoriesApi.update(id, formData),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Category updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: categoriesApi.remove,
    onSuccess: () => { invalidate(); toast.success('Category deleted'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const startEdit = (cat) => {
    setEditing(cat || 'new');
    reset(cat || { name: '', description: '', status: 'active', sortOrder: 0, parent: '' });
    setImageFile(null);
  };

  const onSubmit = (vals) => {
    const formData = new FormData();
    Object.entries(vals).forEach(([k, v]) => { if (v !== undefined && v !== null) formData.append(k, v); });
    if (imageFile) formData.append('image', imageFile);

    if (editing?._id) updateMutation.mutate({ id: editing._id, formData });
    else createMutation.mutate(formData);
  };

  const categories = data?.categories || [];

  return (
    <div>
      <PageHeader title="Categories" action={<button onClick={() => startEdit(null)} className="btn-primary"><Plus size={16} /> Add Category</button>} />

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <input {...register('name', { required: true })} placeholder="Category Name" className="input-field" />
          <select {...register('parent')} className="input-field">
            <option value="">Top Level</option>
            {categories.filter((c) => c._id !== editing?._id).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <textarea {...register('description')} placeholder="Description" className="input-field sm:col-span-2" rows={2} />
          <input type="number" {...register('sortOrder')} placeholder="Sort Order" className="input-field" />
          <select {...register('status')} className="input-field">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="input-field sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : categories.length === 0 ? <EmptyState title="No categories yet" /> : (
          <table className="w-full">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Sort</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c._id} className="table-row">
                  <td className="flex items-center gap-3 px-4 py-3 font-medium">
                    {c.image?.url && <img src={c.image.url} className="h-8 w-8 rounded object-cover" />}
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-night-900/50">{categories.find((p) => p._id === c.parent)?.name || '—'}</td>
                  <td className="px-4 py-3">{c.sortOrder}</td>
                  <td className="px-4 py-3"><Badge tone={c.status === 'active' ? 'success' : 'default'}>{c.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(c)} className="text-gold-600"><Pencil size={15} /></button>
                      <button onClick={() => deleteMutation.mutate(c._id)} className="text-red-600"><Trash2 size={15} /></button>
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
