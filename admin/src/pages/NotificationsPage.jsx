import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { notificationsAdminApi, adminUsersApi } from '@/api/endpoints/cms';
import { productsApi } from '@/api/endpoints/catalog';
import { PageHeader, PageLoader, Badge, EmptyState } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { formatDate } from '@/utils/format';
import { Send, RefreshCw, X } from 'lucide-react';

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'selected', label: 'Selected Users' },
  { value: 'purchasers', label: 'Users Who Purchased a Product' },
  { value: 'abandoned_cart', label: 'Users With Abandoned Carts' },
];

const TYPE_OPTIONS = [
  'information', 'offer', 'order_update', 'coupon', 'blog', 'product_launch',
];

const CAMPAIGN_STATUS_TONE = { scheduled: 'warning', sent: 'success', failed: 'danger', cancelled: 'default' };
const JOB_STATUS_TONE = { pending: 'warning', processing: 'info', sent: 'success', failed: 'danger' };

function UserPicker({ selected, onChange }) {
  const [query, setQuery] = useState('');
  const { data } = useQuery({
    queryKey: ['admin-users-search', query],
    queryFn: () => adminUsersApi.list({ keyword: query, limit: 8 }),
    enabled: query.length > 1,
  });
  const results = data?.users || [];

  const addUser = (u) => {
    if (!selected.some((s) => s._id === u._id)) onChange([...selected, u]);
    setQuery('');
  };
  const removeUser = (id) => onChange(selected.filter((u) => u._id !== id));

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users by name or email…" className="input-field" />
      {results.length > 0 && (
        <div className="mt-1 max-h-40 overflow-auto rounded-sm border border-night-900/10 bg-white text-sm shadow-sm">
          {results.map((u) => (
            <button key={u._id} type="button" onClick={() => addUser(u)} className="block w-full px-3 py-2 text-left hover:bg-night-900/5">
              {u.name} <span className="text-night-900/40">({u.email})</span>
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((u) => (
            <span key={u._id} className="flex items-center gap-1 rounded-full bg-gold-50 px-3 py-1 text-xs text-gold-700">
              {u.name} <button type="button" onClick={() => removeUser(u._id)}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductPicker({ product, onChange }) {
  const [query, setQuery] = useState('');
  const { data } = useQuery({
    queryKey: ['admin-products-search', query],
    queryFn: () => productsApi.list({ keyword: query, limit: 8 }),
    enabled: query.length > 1,
  });
  const results = data?.products || [];

  if (product) {
    return (
      <div className="flex items-center gap-2 rounded-sm border border-night-900/15 px-3 py-2 text-sm">
        <span className="flex-1">{product.title}</span>
        <button type="button" onClick={() => onChange(null)}><X size={14} /></button>
      </div>
    );
  }

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a product…" className="input-field" />
      {results.length > 0 && (
        <div className="mt-1 max-h-40 overflow-auto rounded-sm border border-night-900/10 bg-white text-sm shadow-sm">
          {results.map((p) => (
            <button key={p._id} type="button" onClick={() => { onChange(p); setQuery(''); }} className="block w-full px-3 py-2 text-left hover:bg-night-900/5">
              {p.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const [imageFile, setImageFile] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [product, setProduct] = useState(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { title: '', message: '', buttonText: '', buttonLink: '', type: 'information', audience: 'all', scheduledFor: '', expiresAt: '' },
  });
  const audience = watch('audience');

  const { data: campaignData, isLoading: loadingCampaigns } = useQuery({ queryKey: ['admin-campaigns'], queryFn: notificationsAdminApi.campaigns });
  const { data: jobData, isLoading: loadingJobs } = useQuery({ queryKey: ['admin-notification-jobs', 'failed'], queryFn: () => notificationsAdminApi.jobs({ status: 'failed' }) });

  const createMutation = useMutation({
    mutationFn: notificationsAdminApi.createCampaign,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      toast.success(res.campaign?.status === 'sent' ? 'Notification sent' : 'Notification scheduled');
      reset();
      setImageFile(null);
      setSelectedUsers([]);
      setProduct(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const cancelMutation = useMutation({
    mutationFn: notificationsAdminApi.cancelCampaign,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] }); toast.success('Campaign cancelled'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const retryMutation = useMutation({
    mutationFn: notificationsAdminApi.retryJob,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-notification-jobs', 'failed'] }); toast.success('Job queued for retry'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const onSubmit = (vals) => {
    if (vals.audience === 'selected' && selectedUsers.length === 0) return toast.error('Select at least one user');
    if (vals.audience === 'purchasers' && !product) return toast.error('Select a product');

    const formData = new FormData();
    formData.append('title', vals.title);
    formData.append('message', vals.message);
    formData.append('type', vals.type);
    formData.append('audience', vals.audience);
    if (vals.buttonText) formData.append('buttonText', vals.buttonText);
    if (vals.buttonLink) formData.append('buttonLink', vals.buttonLink);
    if (vals.scheduledFor) formData.append('scheduledFor', new Date(vals.scheduledFor).toISOString());
    if (vals.expiresAt) formData.append('expiresAt', new Date(vals.expiresAt).toISOString());
    if (vals.audience === 'selected') formData.append('audienceUserIds', JSON.stringify(selectedUsers.map((u) => u._id)));
    if (vals.audience === 'purchasers') formData.append('audienceProduct', product._id);
    if (imageFile) formData.append('image', imageFile);

    createMutation.mutate(formData);
  };

  const campaigns = campaignData?.campaigns || [];
  const failedJobs = jobData?.jobs || [];

  return (
    <div>
      <PageHeader title="Notification Center" description="Compose and send in-app + email notifications to your customers." />

      <form onSubmit={handleSubmit(onSubmit)} className="card mb-8 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <input {...register('title', { required: true })} placeholder="Title" className="input-field sm:col-span-2" />
        <textarea {...register('message', { required: true })} placeholder="Message" className="input-field sm:col-span-2" rows={3} />
        <input {...register('buttonText')} placeholder="Button Text (optional)" className="input-field" />
        <input {...register('buttonLink')} placeholder="Button URL (optional)" className="input-field" />
        <select {...register('type')} className="input-field">
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="input-field" />

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-night-900/50">Recipients</label>
          <select {...register('audience')} className="input-field">
            {AUDIENCE_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        {audience === 'selected' && (
          <div className="sm:col-span-2">
            <UserPicker selected={selectedUsers} onChange={setSelectedUsers} />
          </div>
        )}
        {audience === 'purchasers' && (
          <div className="sm:col-span-2">
            <ProductPicker product={product} onChange={setProduct} />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-night-900/50">Schedule For (optional — sends immediately if blank)</label>
          <input type="datetime-local" {...register('scheduledFor')} className="input-field" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-night-900/50">Expires At (optional)</label>
          <input type="datetime-local" {...register('expiresAt')} className="input-field" />
        </div>

        <button type="submit" disabled={createMutation.isPending} className="btn-primary flex w-fit items-center gap-2 sm:col-span-2">
          <Send size={15} /> {watch('scheduledFor') ? 'Schedule Notification' : 'Send Now'}
        </button>
      </form>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-night-900/60">Notification History</h2>
        <div className="card overflow-hidden">
          {loadingCampaigns ? <PageLoader /> : campaigns.length === 0 ? <EmptyState title="No notifications sent yet" /> : (
            <table className="w-full">
              <thead><tr className="table-head">
                <th className="px-4 py-3">Title</th><th className="px-4 py-3">Audience</th><th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c._id} className="table-row">
                    <td className="px-4 py-3 font-medium">{c.title}</td>
                    <td className="px-4 py-3 text-night-900/60">{c.audience.replace('_', ' ')}</td>
                    <td className="px-4 py-3">{c.sentCount}/{c.totalRecipients}</td>
                    <td className="px-4 py-3"><Badge tone={CAMPAIGN_STATUS_TONE[c.status]}>{c.status}</Badge></td>
                    <td className="px-4 py-3 text-night-900/40">{formatDate(c.scheduledFor || c.sentAt || c.createdAt)}</td>
                    <td className="px-4 py-3">
                      {c.status === 'scheduled' && (
                        <button onClick={() => cancelMutation.mutate(c._id)} className="text-xs text-red-600">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-night-900/60">Failed Email/SMS Deliveries</h2>
        <div className="card overflow-hidden">
          {loadingJobs ? <PageLoader /> : failedJobs.length === 0 ? <EmptyState title="No failed deliveries" /> : (
            <table className="w-full">
              <thead><tr className="table-head">
                <th className="px-4 py-3">Channel</th><th className="px-4 py-3">To</th><th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {failedJobs.map((j) => (
                  <tr key={j._id} className="table-row">
                    <td className="px-4 py-3 uppercase">{j.channel}</td>
                    <td className="px-4 py-3">{j.to}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-night-900/60">{j.lastError}</td>
                    <td className="px-4 py-3">{j.attempts}/{j.maxAttempts}</td>
                    <td className="px-4 py-3"><Badge tone={JOB_STATUS_TONE[j.status]}>{j.status}</Badge></td>
                    <td className="px-4 py-3">
                      <button onClick={() => retryMutation.mutate(j._id)} className="flex items-center gap-1 text-xs text-gold-600">
                        <RefreshCw size={12} /> Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
