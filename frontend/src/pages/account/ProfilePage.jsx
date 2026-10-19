import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { userApi } from '@/api/endpoints/misc';
import { useDispatch } from 'react-redux';
import { updateUser } from '@/features/auth/authSlice';
import { getErrorMessage } from '@/api/axiosClient';
import { Camera } from 'lucide-react';
import SEO from '@/components/common/SEO';

export default function ProfilePage() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const { data } = useQuery({ queryKey: ['profile'], queryFn: userApi.getProfile });
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    if (data?.user) reset(data.user);
  }, [data, reset]);

  const updateMutation = useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: (res) => {
      dispatch(updateUser(res.user));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const uploadImageMutation = useMutation({
    mutationFn: userApi.uploadProfileImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile photo updated');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    uploadImageMutation.mutate(formData);
  };

  return (
    <>
      <SEO title="My Profile" noindex />
      <h1 className="mb-6 font-display text-2xl">My Profile</h1>
      <div className="card p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="relative">
            <img
              src={data?.user?.profileImage?.url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + (data?.user?.name || 'U')}
              alt="Profile"
              className="h-20 w-20 rounded-full object-cover"
            />
            <button onClick={() => fileInputRef.current.click()} className="absolute bottom-0 right-0 rounded-full bg-gold-400 p-1.5">
              <Camera size={13} className="text-night-950" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
          <div>
            <p className="font-medium">{data?.user?.name}</p>
            <p className="text-sm text-night-900/50">{data?.user?.mobile}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit((vals) => updateMutation.mutate(vals))} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field">Full Name</label>
            <input {...register('name')} className="input-field" />
          </div>
          <div>
            <label className="label-field">Mobile Number</label>
            <input {...register('mobile')} className="input-field" />
          </div>
          <div>
            <label className="label-field">City</label>
            <input {...register('city')} className="input-field" />
          </div>
          <div>
            <label className="label-field">State</label>
            <input {...register('state')} className="input-field" />
          </div>
          <div>
            <label className="label-field">Country</label>
            <input {...register('country')} className="input-field" />
          </div>
          <div>
            <label className="label-field">Pincode</label>
            <input {...register('pincode')} className="input-field" />
          </div>
          <button type="submit" disabled={updateMutation.isPending} className="btn-primary sm:col-span-2 sm:w-fit">
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </>
  );
}
