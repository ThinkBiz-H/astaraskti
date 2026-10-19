import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { premiumHoroscopeAdminApi } from '@/api/endpoints/orders';
import { PageHeader, PageLoader } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { Plus, Trash2 } from 'lucide-react';

// Cloned from pages/premiumKundli/PremiumKundliSettingsPage.jsx — identical
// fields, layout and behavior, pointed at premiumHoroscopeAdminApi instead.
export default function PremiumHoroscopeSettingsPage() {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ['premium-horoscope-settings'], queryFn: premiumHoroscopeAdminApi.getSettings });
  const { register, control, handleSubmit, reset } = useForm({
    defaultValues: { isActive: false, features: [{ value: '' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'features' });

  useEffect(() => {
    if (data?.settings) {
      reset({
        ...data.settings,
        features: data.settings.features?.length ? data.settings.features.map((f) => ({ value: f })) : [{ value: '' }],
      });
    }
  }, [data, reset]);

  const updateMutation = useMutation({
    mutationFn: (formData) => premiumHoroscopeAdminApi.updateSettings(formData),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['premium-horoscope-settings'] }); toast.success('Settings saved'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const onSubmit = (vals) => {
    const formData = new FormData();
    const skip = new Set(['features', 'seo', 'banner', 'thumbnail']);
    Object.entries(vals).forEach(([key, value]) => {
      if (skip.has(key)) return;
      if (value !== undefined && value !== null) formData.append(key, value);
    });
    formData.append('features', JSON.stringify((vals.features || []).map((f) => f.value).filter(Boolean)));
    formData.append('seo', JSON.stringify(vals.seo || {}));
    if (banner) formData.append('banner', banner);
    if (thumbnail) formData.append('thumbnail', thumbnail);

    updateMutation.mutate(formData);
  };

  if (isLoading) return <PageLoader />;
  const settings = data?.settings;

  return (
    <div>
      <PageHeader title="Premium Horoscope Settings" description="Controls the home page card, purchase form price, and content — nothing here is hardcoded on the frontend." />

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Content</h2>
            <div><label className="label-field">Title</label><input {...register('title')} className="input-field" /></div>
            <div><label className="label-field">Subtitle</label><input {...register('subtitle')} className="input-field" /></div>
            <div><label className="label-field">Description</label><textarea {...register('description')} rows={4} className="input-field" /></div>
            <div><label className="label-field">Delivery Text</label><input {...register('deliveryText')} placeholder="e.g. Delivered within 24 hours" className="input-field" /></div>
            <div><label className="label-field">Button Text</label><input {...register('buttonText')} className="input-field" /></div>
          </div>

          <div className="card space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Features</h2>
              <button type="button" onClick={() => append({ value: '' })} className="flex items-center gap-1 text-xs text-gold-600"><Plus size={13} /> Add</button>
            </div>
            {fields.map((field, i) => (
              <div key={field.id} className="flex gap-2">
                <input {...register(`features.${i}.value`)} placeholder="e.g. Personalised Sun-Sign Prediction" className="input-field" />
                <button type="button" onClick={() => remove(i)} className="shrink-0 text-red-500"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          <div className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Media</h2>
            <div>
              <label className="label-field">Banner</label>
              {settings?.banner?.url && <img src={settings.banner.url} className="mb-2 h-24 rounded object-cover" />}
              <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files[0])} className="input-field" />
            </div>
            <div>
              <label className="label-field">Thumbnail</label>
              {settings?.thumbnail?.url && <img src={settings.thumbnail.url} className="mb-2 h-24 w-24 rounded object-cover" />}
              <input type="file" accept="image/*" onChange={(e) => setThumbnail(e.target.files[0])} className="input-field" />
            </div>
          </div>

          <div className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">SEO</h2>
            <div><label className="label-field">Meta Title</label><input {...register('seo.metaTitle')} className="input-field" /></div>
            <div><label className="label-field">Meta Description</label><textarea {...register('seo.metaDescription')} rows={2} className="input-field" /></div>
            <div><label className="label-field">Canonical URL</label><input {...register('seo.canonicalUrl')} className="input-field" /></div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card space-y-3 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Status</h2>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('isActive')} /> Active (visible on home page)</label>
          </div>

          <div className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-night-900/60">Pricing</h2>
            <div><label className="label-field">Original Price</label><input type="number" step="0.01" {...register('originalPrice', { min: 0 })} className="input-field" /></div>
            <div><label className="label-field">Sale Price</label><input type="number" step="0.01" {...register('salePrice')} className="input-field" /></div>
            <div><label className="label-field">GST %</label><input type="number" step="0.01" {...register('gstPercent', { min: 0, max: 100 })} className="input-field" /></div>
          </div>

          <button type="submit" disabled={updateMutation.isPending} className="btn-primary w-full">
            {updateMutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
