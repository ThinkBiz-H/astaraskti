import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { announcementsApi } from '@/api/endpoints/cms';
import { PageHeader, PageLoader, Badge, EmptyState } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { Plus, Pencil, Trash2, Power } from 'lucide-react';

const emptyDefaults = {
  text: '', buttonText: '', buttonLink: '', backgroundColor: '#1F2937', textColor: '#FFFFFF',
  scrollSpeed: 40, repeat: true, startDate: '', endDate: '', sortOrder: 0, isActive: true,
};

export default function AnnouncementsPage() {
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-announcements'], queryFn: announcementsApi.list });
  const { register, handleSubmit, reset } = useForm({ defaultValues: emptyDefaults });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });

  const createMutation = useMutation({
    mutationFn: announcementsApi.create,
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Announcement created'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => announcementsApi.update(id, payload),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Announcement updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const toggleMutation = useMutation({
    mutationFn: announcementsApi.toggleStatus,
    onSuccess: () => { invalidate(); toast.success('Status toggled'); },
  });
  const deleteMutation = useMutation({
    mutationFn: announcementsApi.remove,
    onSuccess: () => { invalidate(); toast.success('Announcement deleted'); },
  });

  const startEdit = (a) => {
    setEditing(a || 'new');
    reset(a ? {
      ...a,
      startDate: a.startDate ? a.startDate.slice(0, 10) : '',
      endDate: a.endDate ? a.endDate.slice(0, 10) : '',
    } : emptyDefaults);
  };

  const onSubmit = (vals) => {
    const payload = {
      ...vals,
      startDate: vals.startDate || null,
      endDate: vals.endDate || null,
    };
    if (editing?._id) updateMutation.mutate({ id: editing._id, payload });
    else createMutation.mutate(payload);
  };

  const announcements = data?.announcements || [];

  return (
    <div>
      <PageHeader
        title="Announcement Bar"
        description="Sticky scrolling banner shown above the header on every storefront page. Multiple active announcements rotate in sortOrder."
        action={<button onClick={() => startEdit(null)} className="btn-primary"><Plus size={16} /> Add Announcement</button>}
      />

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <input {...register('text', { required: true })} placeholder="Announcement Text" className="input-field sm:col-span-2" />
          <input {...register('buttonText')} placeholder="Button Text (optional)" className="input-field" />
          <input {...register('buttonLink')} placeholder="Button URL (optional)" className="input-field" />
          <div className="flex items-center gap-3">
            <label className="text-xs text-night-900/50">Background</label>
            <input type="color" {...register('backgroundColor')} className="input-field h-9 w-14 p-1" />
            <label className="text-xs text-night-900/50">Text</label>
            <input type="color" {...register('textColor')} className="input-field h-9 w-14 p-1" />
          </div>
          <input type="number" min="5" {...register('scrollSpeed')} placeholder="Scroll Speed (seconds per loop)" className="input-field" />
          <div className="grid grid-cols-2 gap-4">
            <input type="date" {...register('startDate')} className="input-field" />
            <input type="date" {...register('endDate')} className="input-field" />
          </div>
          <input type="number" {...register('sortOrder')} placeholder="Sort Order" className="input-field" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('repeat')} /> Repeat (marquee loop)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('isActive')} /> Active</label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : announcements.length === 0 ? <EmptyState title="No announcements yet" /> : (
          <table className="w-full">
            <thead><tr className="table-head">
              <th className="px-4 py-3">Text</th><th className="px-4 py-3">Schedule</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {announcements.map((a) => (
                <tr key={a._id} className="table-row">
                  <td className="max-w-sm truncate px-4 py-3 font-medium">{a.text}</td>
                  <td className="px-4 py-3 text-xs text-night-900/50">
                    {a.startDate || a.endDate
                      ? `${a.startDate ? new Date(a.startDate).toLocaleDateString() : 'Always'} → ${a.endDate ? new Date(a.endDate).toLocaleDateString() : 'Always'}`
                      : 'Always live'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleMutation.mutate(a._id)}>
                      <Badge tone={a.isActive ? 'success' : 'default'}>{a.isActive ? 'Active' : 'Inactive'}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(a)} className="text-gold-600"><Pencil size={15} /></button>
                      <button onClick={() => toggleMutation.mutate(a._id)} className="text-blue-600"><Power size={15} /></button>
                      <button onClick={() => deleteMutation.mutate(a._id)} className="text-red-600"><Trash2 size={15} /></button>
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
