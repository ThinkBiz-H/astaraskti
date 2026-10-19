import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { homeSectionsApi } from '@/api/endpoints/cms';
import { PageHeader, PageLoader, Badge, EmptyState } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown } from 'lucide-react';

// Every type here has a matching, real data source wired into the
// storefront's dynamic HomeSection renderer (frontend/src/components/home) —
// no type is added here without a live backend query behind it.
const SECTION_TYPES = [
  { value: 'hero', label: 'Hero Banner' },
  { value: 'banner', label: 'Promo / Offer Banner' },
  { value: 'featured_categories', label: 'Featured Categories' },
  { value: 'featured_products', label: 'Featured Products' },
  { value: 'new_arrivals', label: 'New Arrivals' },
  { value: 'trending_products', label: 'Trending Products' },
  { value: 'best_sellers', label: 'Best Sellers' },
  { value: 'brands', label: 'Brand Logos' },
  { value: 'testimonials', label: 'Testimonials' },
  { value: 'instagram', label: 'Instagram Feed' },
  { value: 'blog_preview', label: 'Blog Preview' },
  { value: 'faq_preview', label: 'FAQ Preview' },
  { value: 'newsletter', label: 'Newsletter Signup' },
];

const emptyDefaults = {
  type: 'hero', isActive: true, sortOrder: 0, title: '', subtitle: '',
  backgroundColor: '', textColor: '', 'button.label': '', 'button.link': '', 'config.limit': '',
};

export default function BannersPage() {
  const [editing, setEditing] = useState(null); // null | 'new' | section object
  const [imageFile, setImageFile] = useState(null);
  const [mobileImageFile, setMobileImageFile] = useState(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-home-sections'], queryFn: homeSectionsApi.list });
  const { register, handleSubmit, reset } = useForm({ defaultValues: emptyDefaults });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-home-sections'] });

  const createMutation = useMutation({
    mutationFn: homeSectionsApi.create,
    onSuccess: () => { invalidate(); closeForm(); toast.success('Section created'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => homeSectionsApi.update(id, formData),
    onSuccess: () => { invalidate(); closeForm(); toast.success('Section updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: homeSectionsApi.remove,
    onSuccess: () => { invalidate(); toast.success('Section deleted'); },
  });
  const reorderMutation = useMutation({
    mutationFn: homeSectionsApi.reorder,
    onSuccess: () => { invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const sections = data?.sections || [];

  const closeForm = () => { setEditing(null); setImageFile(null); setMobileImageFile(null); reset(emptyDefaults); };

  const startEdit = (section) => {
    setEditing(section || 'new');
    setImageFile(null);
    setMobileImageFile(null);
    reset(section ? {
      type: section.type, isActive: section.isActive, sortOrder: section.sortOrder,
      title: section.title, subtitle: section.subtitle,
      backgroundColor: section.backgroundColor || '', textColor: section.textColor || '',
      'button.label': section.button?.label || '', 'button.link': section.button?.link || '',
      'config.limit': section.config?.limit || '',
    } : emptyDefaults);
  };

  const onSubmit = (vals) => {
    const formData = new FormData();
    formData.append('type', vals.type);
    formData.append('isActive', vals.isActive ? 'true' : 'false');
    formData.append('sortOrder', vals.sortOrder || 0);
    if (vals.title) formData.append('title', vals.title);
    if (vals.subtitle) formData.append('subtitle', vals.subtitle);
    if (vals.backgroundColor) formData.append('backgroundColor', vals.backgroundColor);
    if (vals.textColor) formData.append('textColor', vals.textColor);
    formData.append('button', JSON.stringify({ label: vals['button.label'] || '', link: vals['button.link'] || '' }));
    if (vals['config.limit']) formData.append('config', JSON.stringify({ limit: Number(vals['config.limit']) }));
    if (imageFile) formData.append('image', imageFile);
    if (mobileImageFile) formData.append('mobileImage', mobileImageFile);

    if (editing?._id) updateMutation.mutate({ id: editing._id, formData });
    else createMutation.mutate(formData);
  };

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderMutation.mutate(reordered.map((s) => s._id));
  };

  return (
    <div>
      <PageHeader
        title="Homepage Builder"
        description="Sections rendered on the storefront homepage, in this order — each type pulls live data (products, categories, brands, blog, FAQs)."
        action={<button onClick={() => startEdit(null)} className="btn-primary"><Plus size={16} /> Add Section</button>}
      />

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <select {...register('type')} className="input-field">
            {SECTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="number" {...register('sortOrder')} placeholder="Sort Order" className="input-field" />
          <input {...register('title')} placeholder="Title" className="input-field" />
          <input {...register('subtitle')} placeholder="Subtitle" className="input-field" />
          <input {...register('button.label')} placeholder="Button Text" className="input-field" />
          <input {...register('button.link')} placeholder="Button URL" className="input-field" />
          <input type="number" min="1" {...register('config.limit')} placeholder="Items to show (products/blogs/faqs — optional)" className="input-field" />
          <div className="flex items-center gap-3">
            <label className="text-xs text-night-900/50">Background</label>
            <input type="color" {...register('backgroundColor')} className="h-9 w-14 input-field p-1" />
            <label className="text-xs text-night-900/50">Text</label>
            <input type="color" {...register('textColor')} className="h-9 w-14 input-field p-1" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-night-900/50">Image (desktop)</label>
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-night-900/50">Image (mobile — optional)</label>
            <input type="file" accept="image/*" onChange={(e) => setMobileImageFile(e.target.files[0])} className="input-field" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...register('isActive')} /> Active</label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary">Save Section</button>
            <button type="button" onClick={closeForm} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : sections.length === 0 ? <EmptyState title="No sections yet" description="Add a section to start building the homepage." /> : (
          <table className="w-full">
            <thead><tr className="table-head"><th className="px-4 py-3">Order</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody>
              {sections.map((s, i) => (
                <tr key={s._id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="disabled:opacity-30"><ArrowDown size={14} /></button>
                      <span className="ml-1 text-xs text-night-900/40">{s.sortOrder}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium capitalize">{s.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">{s.title || '—'}</td>
                  <td className="px-4 py-3"><Badge tone={s.isActive ? 'success' : 'default'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(s)} className="text-gold-600"><Pencil size={15} /></button>
                      <button onClick={() => deleteMutation.mutate(s._id)} className="text-red-600"><Trash2 size={15} /></button>
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
