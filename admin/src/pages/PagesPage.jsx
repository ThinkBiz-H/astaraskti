import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { pagesApi } from '@/api/endpoints/cms';
import { PageHeader, PageLoader, Badge, EmptyState } from '@/components/common/Elements';
import RichTextEditor from '@/components/common/RichTextEditor';
import { getErrorMessage } from '@/api/axiosClient';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const emptyDefaults = {
  title: '', slug: '', excerpt: '', content: '', status: 'draft', sortOrder: 0,
  'seo.metaTitle': '', 'seo.metaDescription': '', 'seo.metaKeywords': '', 'seo.canonicalUrl': '', 'seo.ogImage': '',
};

export default function PagesPage() {
  const [editing, setEditing] = useState(null); // null | 'new' | 'loading' | page object
  const [imageFile, setImageFile] = useState(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-pages'], queryFn: () => pagesApi.list() });
  const { register, handleSubmit, reset, control } = useForm({ defaultValues: emptyDefaults });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-pages'] });

  const createMutation = useMutation({
    mutationFn: pagesApi.create,
    onSuccess: () => { invalidate(); closeForm(); toast.success('Page created'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => pagesApi.update(id, formData),
    onSuccess: () => { invalidate(); closeForm(); toast.success('Page updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => pagesApi.setStatus(id, status),
    onSuccess: () => { invalidate(); toast.success('Status updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: pagesApi.remove,
    onSuccess: () => { invalidate(); toast.success('Page deleted'); },
  });

  const pages = data?.pages || [];

  const closeForm = () => { setEditing(null); setImageFile(null); reset(emptyDefaults); };

  // The admin list endpoint omits `content` (payload size) — fetch the full
  // page before editing so saving never silently wipes it out.
  const startEdit = async (pageSummary) => {
    if (!pageSummary) {
      setEditing('new');
      setImageFile(null);
      reset(emptyDefaults);
      return;
    }

    setEditing('loading');
    try {
      const { page } = await pagesApi.getById(pageSummary._id);
      setEditing(page);
      setImageFile(null);
      reset({
        title: page.title, slug: page.slug, excerpt: page.excerpt, content: page.content,
        status: page.status, sortOrder: page.sortOrder,
        'seo.metaTitle': page.seo?.metaTitle || '', 'seo.metaDescription': page.seo?.metaDescription || '',
        'seo.metaKeywords': page.seo?.metaKeywords || '', 'seo.canonicalUrl': page.seo?.canonicalUrl || '',
        'seo.ogImage': page.seo?.ogImage || '',
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setEditing(null);
    }
  };

  const onSubmit = (vals) => {
    const formData = new FormData();
    formData.append('title', vals.title);
    if (vals.slug) formData.append('slug', vals.slug);
    formData.append('excerpt', vals.excerpt || '');
    formData.append('content', vals.content || '');
    formData.append('status', vals.status);
    formData.append('sortOrder', vals.sortOrder || 0);
    formData.append('seo', JSON.stringify({
      metaTitle: vals['seo.metaTitle'], metaDescription: vals['seo.metaDescription'],
      metaKeywords: vals['seo.metaKeywords'], canonicalUrl: vals['seo.canonicalUrl'], ogImage: vals['seo.ogImage'],
    }));
    if (imageFile) formData.append('featuredImage', imageFile);

    if (editing?._id) updateMutation.mutate({ id: editing._id, formData });
    else createMutation.mutate(formData);
  };

  return (
    <div>
      <PageHeader
        title="CMS Pages"
        description="About, Privacy Policy, Terms, and any other custom page — each gets a live route at /policies/:slug on the storefront."
        action={<button onClick={() => startEdit(null)} className="btn-primary"><Plus size={16} /> New Page</button>}
      />

      {editing === 'loading' && <div className="card mb-6 p-6"><PageLoader /></div>}

      {editing && editing !== 'loading' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input {...register('title', { required: true })} placeholder="Page Title" className="input-field" />
            <input {...register('slug')} placeholder="Slug (leave blank to auto-generate)" className="input-field" />
          </div>
          <input {...register('excerpt')} placeholder="Short Excerpt (optional)" className="input-field" />

          <div>
            <label className="mb-1 block text-xs font-medium text-night-900/50">Content</label>
            <Controller
              name="content"
              control={control}
              render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} placeholder="Write the page content…" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <select {...register('status')} className="input-field">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
            <input type="number" {...register('sortOrder')} placeholder="Sort Order" className="input-field" />
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="input-field" />
          </div>

          <details className="rounded-sm border border-night-900/10 p-4">
            <summary className="cursor-pointer text-sm font-medium">SEO Settings</summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input {...register('seo.metaTitle')} placeholder="SEO Title" className="input-field" />
              <input {...register('seo.canonicalUrl')} placeholder="Canonical URL" className="input-field" />
              <textarea {...register('seo.metaDescription')} placeholder="Meta Description" className="input-field sm:col-span-2" rows={2} />
              <input {...register('seo.metaKeywords')} placeholder="Meta Keywords (comma separated)" className="input-field" />
              <input {...register('seo.ogImage')} placeholder="OG Image URL" className="input-field" />
            </div>
          </details>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Save Page</button>
            <button type="button" onClick={closeForm} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : pages.length === 0 ? <EmptyState title="No pages yet" description="Create About, Privacy Policy, Terms & Conditions, etc." /> : (
          <table className="w-full">
            <thead><tr className="table-head"><th className="px-4 py-3">Title</th><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p._id} className="table-row">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-night-900/50">/policies/{p.slug}</td>
                  <td className="px-4 py-3">
                    <select value={p.status} onChange={(e) => statusMutation.mutate({ id: p._id, status: e.target.value })} className="input-field w-auto py-1 text-xs">
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="unpublished">Unpublished</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(p)} className="text-gold-600"><Pencil size={15} /></button>
                      <button onClick={() => deleteMutation.mutate(p._id)} className="text-red-600"><Trash2 size={15} /></button>
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
