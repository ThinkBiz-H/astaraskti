import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import SEO from '@/components/common/SEO';
import { cmsApi, contactApi } from '@/api/endpoints/misc';
import { Mail, Phone, MapPin } from 'lucide-react';
import { getErrorMessage } from '@/api/axiosClient';

export default function ContactPage() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: cmsApi.getSettings });
  const s = settings?.settings;

  const submitMutation = useMutation({
    mutationFn: contactApi.submitEnquiry,
    onSuccess: () => {
      toast.success("Thanks for reaching out! We'll get back to you soon.");
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const onSubmit = async (vals) => {
    submitMutation.mutate({
      name: vals.name,
      email: vals.email,
      mobile: vals.phone || '',
      subject: vals.subject || 'Website Contact Form',
      message: vals.message,
    });
  };

  return (
    <>
      <SEO title="Contact Us" description="Get in touch with our team for support or consultation queries." />
      <div className="container-page grid grid-cols-1 gap-10 py-14 lg:grid-cols-2">
        <div>
          <h1 className="mb-4 font-display text-3xl">Get in Touch</h1>
          <p className="mb-8 text-sm text-night-900/60">
            Have a question about a product or consultation? We're here to help.
          </p>
          <div className="space-y-4 text-sm">
            {s?.contact?.supportEmail && <p className="flex items-center gap-3"><Mail size={16} className="text-gold-500" /> {s.contact.supportEmail}</p>}
            {s?.contact?.supportPhone && <p className="flex items-center gap-3"><Phone size={16} className="text-gold-500" /> {s.contact.supportPhone}</p>}
            {s?.contact?.address && <p className="flex items-center gap-3"><MapPin size={16} className="text-gold-500" /> {s.contact.address}</p>}
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-6">
          <input {...register('name', { required: true })} placeholder="Your Name" className="input-field" />
          {errors.name && <p className="field-error">Name is required</p>}
          <input type="email" {...register('email', { required: true })} placeholder="Your Email" className="input-field" />
          {errors.email && <p className="field-error">Email is required</p>}
          <input {...register('phone')} placeholder="Phone Number (optional)" className="input-field" />
          <input {...register('subject', { required: true })} placeholder="Subject" className="input-field" />
          {errors.subject && <p className="field-error">Subject is required</p>}
          <textarea {...register('message', { required: true })} rows={5} placeholder="Your Message" className="input-field" />
          {errors.message && <p className="field-error">Message is required</p>}
          <button type="submit" disabled={isSubmitting || submitMutation.isPending} className="btn-primary w-full">
            {isSubmitting || submitMutation.isPending ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </>
  );
}
