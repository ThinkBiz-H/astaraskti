import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { brandsApi } from '@/api/endpoints/catalog';
import { PageHeader, PageLoader, Badge, EmptyState, ConfirmDialog } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function BrandsPage() {
  const [editing, setEditing] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-brands'], queryFn: brandsApi.list });
  const { register, handleSubmit, reset } = useForm();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-brands'] });

  const createMutation = useMutation({
    mutationFn: brandsApi.create,
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Brand created'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => brandsApi.update(id, formData),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Brand updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: brandsApi.remove,
    onSuccess: () => { invalidate(); setPendingDelete(null); toast.success('Brand deleted'); },
    onError: (err) => { toast.error(getErrorMessage(err)); setPendingDelete(null); },
  });

  const startEdit = (brand) => {
    setEditing(brand || 'new');
    reset(brand || { name: '', status: 'active' });
    setLogoFile(null);
  };

  const onSubmit = (vals) => {
    const formData = new FormData();
    Object.entries(vals).forEach(([k, v]) => { if (v !== undefined && v !== null) formData.append(k, v); });
    if (logoFile) formData.append('logo', logoFile);

    if (editing?._id) updateMutation.mutate({ id: editing._id, formData });
    else createMutation.mutate(formData);
  };

  const brands = data?.brands || [];

  return (
    <div>
      <PageHeader
        title="Brands"
        description="Manage the brands available on the product form"
        action={<button onClick={() => startEdit(null)} className="btn-primary"><Plus size={16} /> Add Brand</button>}
      />

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <input {...register('name', { required: true })} placeholder="Brand Name" className="input-field" />
          <select {...register('status')} className="input-field">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0])} className="input-field sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : brands.length === 0 ? <EmptyState title="No brands yet" description="Add a brand so it appears on the product form." /> : (
          <table className="w-full">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b._id} className="table-row">
                  <td className="flex items-center gap-3 px-4 py-3 font-medium">
                    {b.logo?.url && <img src={b.logo.url} className="h-8 w-8 rounded object-cover" />}
                    {b.name}
                  </td>
                  <td className="px-4 py-3"><Badge tone={b.status === 'active' ? 'success' : 'default'}>{b.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(b)} className="text-gold-600"><Pencil size={15} /></button>
                      <button onClick={() => setPendingDelete(b)} className="text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete brand?"
        description={pendingDelete ? `"${pendingDelete.name}" will be removed. Products already using it keep their reference but the brand filter will no longer show it.` : ''}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(pendingDelete._id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
