import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { consultationServicesAdminApi, premiumKundliAdminApi } from '@/api/endpoints/orders';
import { PageHeader, PageLoader, Badge, EmptyState } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { Plus, Pencil, Trash2, Power } from 'lucide-react';

// "kundli" and "horoscope" are two FIXED, non-dynamic instant-report
// services — never created/edited/deleted through this generic multi-field
// form, never offered in the type dropdown below. Their price only is
// editable via the "Instant Report Pricing" card at the top of this page
// (see PricingCard). This list below manages every OTHER (appointment-
// based) consultation type only.
const SERVICE_TYPES = ['horoscope_matching', 'gemstone', 'vastu', 'general'];

/** Exactly two number fields — Kundli Price, Horoscope Price — nothing else. */
function PricingCard({ services, invalidate }) {
  const kundliService = services.find((s) => s.type === 'kundli');
  const horoscopeService = services.find((s) => s.type === 'horoscope');

  const [kundliPrice, setKundliPrice] = useState('');
  const [horoscopePrice, setHoroscopePrice] = useState('');

  useEffect(() => {
    if (kundliService) setKundliPrice(String(kundliService.price ?? ''));
  }, [kundliService?.price]);
  useEffect(() => {
    if (horoscopeService) setHoroscopePrice(String(horoscopeService.price ?? ''));
  }, [horoscopeService?.price]);

  const saveKundli = useMutation({
    mutationFn: (price) => {
      const formData = new FormData();
      formData.append('originalPrice', price);
      return premiumKundliAdminApi.updateSettings(formData);
    },
    onSuccess: () => { invalidate(); toast.success('Kundli price updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const saveHoroscope = useMutation({
    mutationFn: (price) => {
      const formData = new FormData();
      formData.append('price', price);
      return consultationServicesAdminApi.update(horoscopeService._id, formData);
    },
    onSuccess: () => { invalidate(); toast.success('Horoscope price updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="card mb-6 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
      <h2 className="font-display text-lg sm:col-span-2">Instant Report Pricing</h2>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label-field">Kundli Price</label>
          <input
            type="number" step="0.01" min="0"
            value={kundliPrice}
            onChange={(e) => setKundliPrice(e.target.value)}
            className="input-field"
          />
        </div>
        <button
          onClick={() => saveKundli.mutate(kundliPrice)}
          disabled={saveKundli.isPending}
          className="btn-primary"
        >
          Save
        </button>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label-field">Horoscope Price</label>
          <input
            type="number" step="0.01" min="0"
            value={horoscopePrice}
            onChange={(e) => setHoroscopePrice(e.target.value)}
            disabled={!horoscopeService}
            className="input-field"
          />
        </div>
        <button
          onClick={() => saveHoroscope.mutate(horoscopePrice)}
          disabled={saveHoroscope.isPending || !horoscopeService}
          className="btn-primary"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default function ConsultationServicesAdminPage() {
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-consultation-services'], queryFn: () => consultationServicesAdminApi.list() });
  const { register, handleSubmit, reset } = useForm();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-consultation-services'] });

  const createMutation = useMutation({
    mutationFn: consultationServicesAdminApi.create,
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Service created'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => consultationServicesAdminApi.update(id, formData),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Service updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const toggleMutation = useMutation({
    mutationFn: consultationServicesAdminApi.toggleStatus,
    onSuccess: () => { invalidate(); toast.success('Status toggled'); },
  });
  const deleteMutation = useMutation({
    mutationFn: consultationServicesAdminApi.remove,
    onSuccess: () => { invalidate(); toast.success('Service deleted'); },
  });

  const startEdit = (svc) => {
    setEditing(svc || 'new');
    reset(svc || { name: '', type: 'horoscope_matching', price: 0, duration: 30, description: '', status: 'active' });
    setImageFile(null);
  };

  const onSubmit = (vals) => {
    const formData = new FormData();
    Object.entries(vals).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') formData.append(k, v);
    });
    if (imageFile) formData.append('image', imageFile);

    if (editing?._id) updateMutation.mutate({ id: editing._id, formData });
    else createMutation.mutate(formData);
  };

  const allServices = data?.services || [];
  // Fixed instant-report services are managed exclusively via PricingCard
  // above — never listed/edited/deleted in this generic table.
  const services = allServices.filter((s) => s.type !== 'kundli' && s.type !== 'horoscope');

  return (
    <div>
      <PageHeader title="Consultation Services" action={<button onClick={() => startEdit(null)} className="btn-primary"><Plus size={16} /> Add Service</button>} />

      <PricingCard services={allServices} invalidate={invalidate} />

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <input {...register('name', { required: 'Service name is required' })} placeholder="Service Name" className="input-field" />
          <select {...register('type')} className="input-field">
            {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" step="0.01" min="0" {...register('price', { required: 'Price is required', min: { value: 0, message: 'Price must be positive' } })} placeholder="Price" className="input-field" />
          <input type="number" min="1" {...register('duration', { min: { value: 1, message: 'Duration must be at least 1 minute' } })} placeholder="Duration (minutes)" className="input-field" />
          <textarea {...register('description')} placeholder="Description" className="input-field sm:col-span-2" rows={3} />
          <select {...register('status')} className="input-field">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="input-field" />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : services.length === 0 ? <EmptyState title="No services yet" /> : (
          <table className="w-full">
            <thead><tr className="table-head">
              <th className="px-4 py-3">Service</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Duration</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s._id} className="table-row">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-night-900/50">{s.type}</td>
                  <td className="px-4 py-3">₹{s.price}</td>
                  <td className="px-4 py-3">{s.duration} min</td>
                  <td className="px-4 py-3"><Badge tone={s.status === 'active' ? 'success' : 'default'}>{s.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(s)} className="text-gold-600"><Pencil size={15} /></button>
                      <button onClick={() => toggleMutation.mutate(s._id)} className="text-blue-600"><Power size={15} /></button>
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
