import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { blogAdminApi } from '@/api/endpoints/cms';
import { PageHeader, PageLoader, Badge, EmptyState } from '@/components/common/Elements';
import RichTextEditor from '@/components/common/RichTextEditor';
import { getErrorMessage } from '@/api/axiosClient';
import { formatDate } from '@/utils/format';
import { Plus, Pencil, Trash2 } from 'lucide-react';

// Rough reading-time estimate (average adult reading speed), computed from
// plain text length — not stored, just shown live while editing.
const estimateReadingTime = (html = '') => {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

const emptyDefaults = {
  title: '', slug: '', excerpt: '', content: '', category: '', tags: '', status: 'draft', publishedAt: '',
  'seo.metaTitle': '', 'seo.metaDescription': '', 'seo.metaKeywords': '', 'seo.canonicalUrl': '', 'seo.ogImage': '',
};

export default function BlogAdminPage() {
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-blogs'], queryFn: () => blogAdminApi.list() });
  const { data: categoryData } = useQuery({ queryKey: ['blog-categories'], queryFn: blogAdminApi.categories });
  const { register, handleSubmit, reset, control, watch } = useForm({ defaultValues: emptyDefaults });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-blogs'] });

  const createMutation = useMutation({
    mutationFn: blogAdminApi.create,
    onSuccess: () => { invalidate(); closeForm(); toast.success('Post created'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => blogAdminApi.update(id, formData),
    onSuccess: () => { invalidate(); closeForm(); toast.success('Post updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => blogAdminApi.setStatus(id, status),
    onSuccess: () => { invalidate(); toast.success('Status updated'); },
  });
  const deleteMutation = useMutation({
    mutationFn: blogAdminApi.remove,
    onSuccess: () => { invalidate(); toast.success('Post deleted'); },
  });

  const categories = categoryData?.categories || [];
  const blogs = data?.blogs || [];

  const closeForm = () => { setEditing(null); setImageFile(null); reset(emptyDefaults); };

  // The admin list endpoint omits `content` (payload size) — fetch the full
  // post before editing so saving never silently wipes it out.
  const startEdit = async (postSummary) => {
    if (!postSummary) {
      setEditing('new');
      setImageFile(null);
      reset(emptyDefaults);
      return;
    }

    setEditing('loading');
    try {
      const { blog: post } = await blogAdminApi.getById(postSummary._id);
      setEditing(post);
      setImageFile(null);
      reset({
        title: post.title, slug: post.slug, excerpt: post.excerpt, content: post.content,
        category: post.category?._id || post.category || '', tags: (post.tags || []).join(', '),
        status: post.status, publishedAt: post.publishedAt ? post.publishedAt.slice(0, 16) : '',
        'seo.metaTitle': post.seo?.metaTitle || '', 'seo.metaDescription': post.seo?.metaDescription || '',
        'seo.metaKeywords': post.seo?.metaKeywords || '', 'seo.canonicalUrl': post.seo?.canonicalUrl || '',
        'seo.ogImage': post.seo?.ogImage || '',
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
    if (vals.category) formData.append('category', vals.category);
    formData.append('tags', vals.tags || '');
    formData.append('status', vals.status);
    if (vals.publishedAt) formData.append('publishedAt', new Date(vals.publishedAt).toISOString());
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
      <PageHeader title="Blog" action={<button onClick={() => startEdit(null)} className="btn-primary"><Plus size={16} /> New Post</button>} />

      {editing === 'loading' && <div className="card mb-6 p-6"><PageLoader /></div>}

      {editing && editing !== 'loading' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input {...register('title', { required: true })} placeholder="Post Title" className="input-field" />
            <input {...register('slug')} placeholder="Slug (leave blank to auto-generate)" className="input-field" />
          </div>
          <input {...register('excerpt')} placeholder="Short Excerpt" className="input-field" />

          <div>
            <label className="mb-1 block text-xs font-medium text-night-900/50">Content</label>
            <Controller
              name="content"
              control={control}
              render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} placeholder="Write your post…" />}
            />
            <p className="mt-1 text-xs text-night-900/40">~{estimateReadingTime(watch('content'))} min read</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <select {...register('category')} className="input-field">
              <option value="">No category</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <input {...register('tags')} placeholder="Tags (comma separated)" className="input-field" />
            <select {...register('status')} className="input-field">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {watch('status') === 'scheduled' && (
              <input type="datetime-local" {...register('publishedAt')} className="input-field" />
            )}
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
            <button type="submit" className="btn-primary">Save Post</button>
            <button type="button" onClick={closeForm} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : blogs.length === 0 ? <EmptyState title="No blog posts yet" /> : (
          <table className="w-full">
            <thead><tr className="table-head"><th className="px-4 py-3">Title</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Published</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody>
              {blogs.map((b) => (
                <tr key={b._id} className="table-row">
                  <td className="px-4 py-3 font-medium">{b.title}</td>
                  <td className="px-4 py-3 text-night-900/50">{b.category?.name || '—'}</td>
                  <td className="px-4 py-3 text-night-900/50">{b.publishedAt ? formatDate(b.publishedAt) : '—'}</td>
                  <td className="px-4 py-3">
                    <select value={b.status} onChange={(e) => statusMutation.mutate({ id: b._id, status: e.target.value })} className="input-field w-auto py-1 text-xs">
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(b)} className="text-gold-600"><Pencil size={15} /></button>
                      <button onClick={() => deleteMutation.mutate(b._id)} className="text-red-600"><Trash2 size={15} /></button>
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
