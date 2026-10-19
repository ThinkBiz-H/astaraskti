import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { settingsAdminApi } from '@/api/endpoints/cms';
import { PageHeader, PageLoader, Badge } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';

const TABS = ['General', 'Store', 'Currency & Tax', 'Invoice', 'Inventory', 'Payments & Shipping', 'SEO', 'Social', 'Contact', 'Maintenance', 'Branding', 'Environment'];

// Field names below match backend/models/Settings.js exactly — the
// previous version of this page used names like `general.tagline` and
// `contact.supportPhone` that don't exist on the schema (it's `siteTagline`
// and `contact.phone`), so those fields silently never saved or loaded.
export default function SettingsPage() {
  const [tab, setTab] = useState('General');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-settings'], queryFn: settingsAdminApi.get });
  const { data: envStatus } = useQuery({ queryKey: ['env-status'], queryFn: settingsAdminApi.environmentStatus });
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    if (data?.settings) {
      reset({
        ...data.settings,
        maintenanceMode: {
          ...data.settings.maintenanceMode,
          allowedIPs: (data.settings.maintenanceMode?.allowedIPs || []).join(', '),
        },
      });
    }
  }, [data, reset]);

  const updateMutation = useMutation({
    mutationFn: settingsAdminApi.update,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-settings'] }); toast.success('Settings updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const logoMutation = useMutation({
    mutationFn: settingsAdminApi.updateLogo,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-settings'] }); toast.success('Logo updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const faviconMutation = useMutation({
    mutationFn: settingsAdminApi.updateFavicon,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-settings'] }); toast.success('Favicon updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const onFileUpload = (mutation, fieldName) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append(fieldName, file);
    mutation.mutate(formData);
  };

  const onSubmit = (vals) => {
    // Send only the section(s) relevant to the active tab — the backend
    // deep-merges one level into each section, so this never wipes fields
    // on a section untouched by the current tab.
    const sectionMap = {
      General: { general: vals.general },
      Store: { store: vals.store },
      'Currency & Tax': { currency: vals.currency, tax: vals.tax },
      Invoice: { invoice: vals.invoice },
      Inventory: { inventory: vals.inventory },
      'Payments & Shipping': { integrations: vals.integrations },
      SEO: { seo: vals.seo },
      Social: { social: vals.social },
      Contact: { contact: vals.contact },
      Maintenance: {
        maintenanceMode: {
          ...vals.maintenanceMode,
          allowedIPs: (vals.maintenanceMode.allowedIPs || '').split(',').map((ip) => ip.trim()).filter(Boolean),
        },
      },
    };
    const payload = sectionMap[tab];
    if (payload) updateMutation.mutate(payload);
  };

  if (isLoading) return <PageLoader />;
  const environment = envStatus?.environment || {};

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-night-900/10">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm ${tab === t ? 'border-gold-500 font-medium text-night-950' : 'border-transparent text-night-900/50'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'General' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-xl space-y-4 p-6">
          <div><label className="label-field">Site Name</label><input {...register('general.siteName')} className="input-field" /></div>
          <div><label className="label-field">Tagline</label><input {...register('general.siteTagline')} className="input-field" /></div>
          <div><label className="label-field">Support Email</label><input {...register('general.supportEmail')} className="input-field" /></div>
          <div><label className="label-field">Support Phone</label><input {...register('general.supportPhone')} className="input-field" /></div>
          <div><label className="label-field">Timezone</label><input {...register('general.timezone')} className="input-field" /></div>
          <button type="submit" className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Store' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-xl space-y-4 p-6">
          <div><label className="label-field">Legal Business Name</label><input {...register('store.legalName')} className="input-field" /></div>
          <div><label className="label-field">GST Number</label><input {...register('store.gstNumber')} className="input-field" /></div>
          <div><label className="label-field">Address Line 1</label><input {...register('store.address.line1')} className="input-field" /></div>
          <div><label className="label-field">Address Line 2</label><input {...register('store.address.line2')} className="input-field" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-field">City</label><input {...register('store.address.city')} className="input-field" /></div>
            <div><label className="label-field">State</label><input {...register('store.address.state')} className="input-field" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-field">Country</label><input {...register('store.address.country')} className="input-field" /></div>
            <div><label className="label-field">Pincode</label><input {...register('store.address.pincode')} className="input-field" /></div>
          </div>
          <button type="submit" className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Currency & Tax' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-xl space-y-4 p-6">
          <div><label className="label-field">Currency Code</label><input {...register('currency.code')} maxLength={3} className="input-field" /></div>
          <div><label className="label-field">Currency Symbol</label><input {...register('currency.symbol')} className="input-field" /></div>
          <div>
            <label className="label-field">Symbol Position</label>
            <select {...register('currency.position')} className="input-field">
              <option value="before">Before amount</option>
              <option value="after">After amount</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('tax.gstEnabled')} /> GST Enabled</label>
          <div><label className="label-field">Default Tax %</label><input type="number" step="0.01" {...register('tax.defaultTaxPercent')} className="input-field" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('tax.pricesIncludeTax')} /> Prices include tax</label>
          <button type="submit" className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Invoice' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-xl space-y-4 p-6">
          <div><label className="label-field">Invoice Number Prefix</label><input {...register('invoice.prefix')} className="input-field" /></div>
          <div><label className="label-field">Starting Number</label><input type="number" {...register('invoice.startingNumber')} className="input-field" /></div>
          <div><label className="label-field">Terms & Conditions</label><textarea {...register('invoice.termsAndConditions')} rows={3} className="input-field" /></div>
          <div><label className="label-field">Footer Note</label><textarea {...register('invoice.footerNote')} rows={2} className="input-field" /></div>
          <button type="submit" className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Inventory' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-xl space-y-4 p-6">
          <p className="text-xs text-night-900/50">
            These thresholds drive the "Low Stock" / "Critical" badges on the Inventory page and Dashboard, and are applied to every product/variant automatically.
          </p>
          <div>
            <label className="label-field">Low Stock Limit</label>
            <input type="number" min={0} {...register('inventory.lowStockThreshold')} className="input-field" />
            <p className="mt-1 text-xs text-night-900/40">Stock at or below this (and above the critical limit) shows as "Low Stock".</p>
          </div>
          <div>
            <label className="label-field">Critical Stock Limit</label>
            <input type="number" min={0} {...register('inventory.criticalStockThreshold')} className="input-field" />
            <p className="mt-1 text-xs text-night-900/40">Stock at or below this (and above 0) shows as "Critical". Stock at 0 always shows as "Out of Stock".</p>
          </div>
          <button type="submit" className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Payments & Shipping' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-xl space-y-3 p-6">
          <p className="mb-2 text-xs text-night-900/50">
            These are storefront-facing on/off switches — e.g. turning Razorpay off here shows customers "Cash on Delivery only" without touching server credentials. The underlying integration still needs real credentials configured (see the Environment tab) to actually work.
          </p>
          <label className="flex items-center justify-between border-b border-night-900/5 py-2 text-sm">Accept Razorpay Payments <input type="checkbox" {...register('integrations.razorpayEnabled')} /></label>
          <label className="flex items-center justify-between border-b border-night-900/5 py-2 text-sm">Shiprocket Shipping <input type="checkbox" {...register('integrations.shiprocketEnabled')} /></label>
          <label className="flex items-center justify-between border-b border-night-900/5 py-2 text-sm">Transactional Emails <input type="checkbox" {...register('integrations.emailEnabled')} /></label>
          <label className="flex items-center justify-between py-2 text-sm">SMS Notifications <input type="checkbox" {...register('integrations.smsEnabled')} /></label>
          <button type="submit" className="btn-primary mt-2">Save</button>
        </form>
      )}

      {tab === 'SEO' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-xl space-y-4 p-6">
          <div><label className="label-field">Default Meta Title</label><input {...register('seo.defaultMetaTitle')} className="input-field" /></div>
          <div><label className="label-field">Default Meta Description</label><textarea {...register('seo.defaultMetaDescription')} rows={2} className="input-field" /></div>
          <div><label className="label-field">Default OG Image URL</label><input {...register('seo.defaultOgImage')} className="input-field" /></div>
          <div><label className="label-field">Google Analytics ID</label><input {...register('seo.googleAnalyticsId')} placeholder="G-XXXXXXXXXX" className="input-field" /></div>
          <div><label className="label-field">Google Search Console Verification</label><input {...register('seo.googleSiteVerification')} className="input-field" /></div>
          <div><label className="label-field">Facebook Pixel ID</label><input {...register('seo.facebookPixelId')} className="input-field" /></div>
          <button type="submit" className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Social' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-xl space-y-4 p-6">
          <div><label className="label-field">Facebook URL</label><input {...register('social.facebook')} className="input-field" /></div>
          <div><label className="label-field">Instagram URL</label><input {...register('social.instagram')} className="input-field" /></div>
          <div><label className="label-field">Twitter / X URL</label><input {...register('social.twitter')} className="input-field" /></div>
          <div><label className="label-field">YouTube URL</label><input {...register('social.youtube')} className="input-field" /></div>
          <div><label className="label-field">LinkedIn URL</label><input {...register('social.linkedin')} className="input-field" /></div>
          <div><label className="label-field">Pinterest URL</label><input {...register('social.pinterest')} className="input-field" /></div>
          <div><label className="label-field">WhatsApp Number/Link</label><input {...register('social.whatsapp')} className="input-field" /></div>
          <button type="submit" className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Contact' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-xl space-y-4 p-6">
          <div><label className="label-field">Public Contact Email</label><input {...register('contact.email')} className="input-field" /></div>
          <div><label className="label-field">Public Contact Phone</label><input {...register('contact.phone')} className="input-field" /></div>
          <div><label className="label-field">WhatsApp Number</label><input {...register('contact.whatsapp')} className="input-field" /></div>
          <div><label className="label-field">Address</label><textarea {...register('contact.address')} rows={2} className="input-field" /></div>
          <button type="submit" className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Maintenance' && (
        <form onSubmit={handleSubmit(onSubmit)} className="card max-w-xl space-y-4 p-6">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('maintenanceMode.enabled')} /> Enable Maintenance Mode</label>
          <p className="text-xs text-night-900/50">While enabled, every storefront request (except auth, admin, and payment/shipping webhooks) returns a 503 with the message below — admins can always still log in and turn this back off.</p>
          <div><label className="label-field">Maintenance Message</label><textarea {...register('maintenanceMode.message')} rows={2} className="input-field" /></div>
          <div>
            <label className="label-field">Allowed IPs (comma separated — bypass the block)</label>
            <input {...register('maintenanceMode.allowedIPs')} placeholder="203.0.113.5, 198.51.100.9" className="input-field" />
          </div>
          <button type="submit" className="btn-primary">Save</button>
        </form>
      )}

      {tab === 'Branding' && (
        <div className="card max-w-xl space-y-6 p-6">
          <div>
            <label className="label-field">Logo</label>
            {data?.settings?.logo?.url && <img src={data.settings.logo.url} className="mb-3 h-16 rounded" />}
            <input type="file" accept="image/*" onChange={onFileUpload(logoMutation, 'logo')} className="input-field" />
          </div>
          <div>
            <label className="label-field">Favicon</label>
            {data?.settings?.favicon?.url && <img src={data.settings.favicon.url} className="mb-3 h-10 w-10 rounded" />}
            <input type="file" accept="image/*" onChange={onFileUpload(faviconMutation, 'favicon')} className="input-field" />
          </div>
        </div>
      )}

      {tab === 'Environment' && (
        <div className="card max-w-xl p-6">
          <p className="mb-4 text-xs text-night-900/50">
            Presence-only checks — actual secret values are never shown here. Credentials themselves are set via the server's .env file, not through this UI, since an admin-editable secrets API is a bigger attack surface than an env var that needs a deploy to change.
          </p>
          <div className="space-y-2">
            {Object.entries(environment).map(([key, status]) => (
              <div key={key} className="flex items-center justify-between border-b border-night-900/5 py-2 text-sm">
                <span className="capitalize">{key}{status.provider ? ` (${status.provider})` : ''}{key === 'shiprocket' && !status.enabled ? ' — disabled' : ''}</span>
                <Badge tone={status.configured ? 'success' : 'danger'}>{status.configured ? 'Configured' : 'Not configured'}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
