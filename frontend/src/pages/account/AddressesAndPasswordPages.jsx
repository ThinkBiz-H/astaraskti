import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { userApi } from '@/api/endpoints/misc';
import { authApi } from '@/api/endpoints/auth';
import { getErrorMessage } from '@/api/axiosClient';
import SEO from '@/components/common/SEO';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useState } from 'react';

export function AddressesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // address object or 'new' or null
  const { data } = useQuery({ queryKey: ['addresses'], queryFn: userApi.getAddresses });
  const { register, handleSubmit, reset } = useForm();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['addresses'] });

  const addMutation = useMutation({
    mutationFn: userApi.addAddress,
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Address added'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }) => userApi.updateAddress(id, payload),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Address updated'); },
  });
  const deleteMutation = useMutation({
    mutationFn: userApi.deleteAddress,
    onSuccess: () => { invalidate(); toast.success('Address removed'); },
  });

  const startEdit = (addr) => {
    setEditing(addr);
    reset(addr);
  };

  const onSubmit = (vals) => {
    if (editing?._id) updateMutation.mutate({ id: editing._id, ...vals });
    else addMutation.mutate(vals);
  };

  return (
    <>
      <SEO title="My Addresses" noindex />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl">My Addresses</h1>
        <button onClick={() => { setEditing('new'); reset({ type: 'Home', country: 'India' }); }} className="btn-outline">
          <Plus size={15} /> Add Address
        </button>
      </div>

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <select {...register('type')} className="input-field sm:col-span-2">
            <option value="Home">Home</option>
            <option value="Office">Office</option>
            <option value="Other">Other</option>
          </select>
          <input {...register('addressLine1', { required: true })} placeholder="Address Line 1" className="input-field sm:col-span-2" />
          <input {...register('addressLine2')} placeholder="Address Line 2" className="input-field sm:col-span-2" />
          <input {...register('city', { required: true })} placeholder="City" className="input-field" />
          <input {...register('state', { required: true })} placeholder="State" className="input-field" />
          <input {...register('pincode', { required: true })} placeholder="Pincode" className="input-field" />
          <input {...register('country')} placeholder="Country" className="input-field" />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" {...register('isDefault')} /> Set as default address
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary">Save Address</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data?.addresses?.map((addr) => (
          <div key={addr._id} className="card p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gold-600">{addr.type}</span>
              {addr.isDefault && <span className="text-xs text-night-900/40">Default</span>}
            </div>
            <p className="text-sm text-night-900/70">{addr.addressLine1}, {addr.addressLine2}<br />{addr.city}, {addr.state} {addr.pincode}</p>
            <div className="mt-3 flex gap-3 text-xs">
              <button onClick={() => startEdit(addr)} className="flex items-center gap-1 text-gold-600"><Pencil size={12} /> Edit</button>
              <button onClick={() => deleteMutation.mutate(addr._id)} className="flex items-center gap-1 text-maroon-700"><Trash2 size={12} /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function ChangePasswordPage() {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();
  const newPassword = watch('newPassword');

  const mutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => { toast.success('Password changed successfully'); reset(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <>
      <SEO title="Change Password" noindex />
      <h1 className="mb-6 font-display text-2xl">Change Password</h1>
      <form onSubmit={handleSubmit((vals) => mutation.mutate({ currentPassword: vals.currentPassword, newPassword: vals.newPassword }))} className="card max-w-md space-y-4 p-6">
        <div>
          <label className="label-field">Current Password</label>
          <input type="password" {...register('currentPassword', { required: true })} className="input-field" />
        </div>
        <div>
          <label className="label-field">New Password</label>
          <input type="password" {...register('newPassword', { required: true, minLength: 8 })} className="input-field" />
          {errors.newPassword && <p className="field-error">Minimum 8 characters, with a letter and a number</p>}
        </div>
        <div>
          <label className="label-field">Confirm New Password</label>
          <input type="password" {...register('confirmPassword', { validate: (v) => v === newPassword || 'Passwords do not match' })} className="input-field" />
          {errors.confirmPassword && <p className="field-error">{errors.confirmPassword.message}</p>}
        </div>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </>
  );
}
