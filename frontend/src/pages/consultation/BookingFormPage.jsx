import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import toast from 'react-hot-toast';
import SEO from '@/components/common/SEO';
import { Breadcrumbs, PageLoader, AppImage } from '@/components/common/Elements';
import { consultationServicesApi, consultationBookingsApi } from '@/api/endpoints/consultations';
import { useRazorpay } from '@/hooks/useRazorpay';
import { useSelector } from 'react-redux';
import { selectCurrentUser, selectIsAuthenticated } from '@/features/auth/authSlice';
import { getErrorMessage } from '@/api/axiosClient';
import { RAZORPAY_KEY_ID, MEETING_MODES } from '@/utils/constants';
import { HoroscopeFields, GemstoneFields, VastuFields } from '@/components/consultation/DetailFields';
import { Clock, ShieldCheck } from 'lucide-react';

// "kundli" is deliberately absent — that type redirects to the Premium
// Kundli purchase flow above, before this map is ever consulted.
const DETAIL_FIELDS_BY_TYPE = {
  horoscope_matching: HoroscopeFields,
  gemstone: GemstoneFields,
  vastu: VastuFields,
};

export default function BookingFormPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectCurrentUser);
  const { openCheckout } = useRazorpay();
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['consultation-service', slug],
    queryFn: () => consultationServicesApi.getByIdOrSlug(slug),
  });
  const service = data?.service;

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { contactMobile: user?.mobile || '', contactEmail: user?.email || '', meetingMode: 'Phone Call' },
  });

  if (isLoading) return <PageLoader />;
  if (!service) return <div className="container-page py-20 text-center">Service not found.</div>;

  // Kundli is NOT an appointment-based consultation — it's an instant,
  // guest-checkout AI-generated PDF purchase (see pages/kundli/
  // PremiumKundliPage.jsx). A "kundli"-typed consultation service must
  // never reach this appointment/meeting-mode/login-gated booking form —
  // redirect straight to the real purchase flow instead.
  if (service.type === 'kundli') {
    return <Navigate to="/kundli" replace />;
  }
  // Same reasoning for "horoscope" (the Premium Horoscope instant-report
  // module) — NOT to be confused with "horoscope_matching" below, which IS
  // a real appointment-based consultation and keeps using this form.
  if (service.type === 'horoscope') {
    return <Navigate to="/horoscope" replace />;
  }

  const DetailFields = DETAIL_FIELDS_BY_TYPE[service.type];

  const onSubmit = async (vals) => {
    if (!isAuthenticated) {
      toast.error('Please log in to book a consultation');
      navigate('/login', { state: { from: { pathname: `/consultation/${slug}` } } });
      return;
    }

    setSubmitting(true);
    try {
      // Current City / Language / Additional Notes aren't fields the backend's
      // ConsultationBooking schema currently stores (see kundliDetails schema —
      // fullName/gender/dob/birthTime/birthPlace only). TODO(backend): add
      // currentCity/language/problem as first-class fields if this needs to be
      // queryable/reportable later. For now they're folded into customerNotes
      // so nothing the user typed is silently discarded.
      const extraNotes = [
        vals.currentCity && `Current City: ${vals.currentCity}`,
        vals.language && `Preferred Language: ${vals.language}`,
        vals.problem && `Problem: ${vals.problem}`,
        vals.additionalNotes,
      ].filter(Boolean).join('\n');

      const basePayload = {
        serviceId: service._id,
        appointmentDate: vals.appointmentDate,
        appointmentTime: vals.appointmentTime,
        meetingMode: vals.meetingMode,
        contactMobile: vals.contactMobile,
        contactEmail: vals.contactEmail || undefined,
        customerNotes: extraNotes || undefined,
      };

      let booking;
      if (service.type === 'vastu' && vals.vastuImages?.length > 0) {
        const formData = new FormData();
        Object.entries(basePayload).forEach(([k, v]) => v !== undefined && formData.append(k, v));
        formData.append('vastuDetails', JSON.stringify(vals.vastuDetails));
        Array.from(vals.vastuImages).forEach((file) => formData.append('images', file));
        const res = await consultationBookingsApi.create(formData);
        booking = res.booking;
      } else {
        const detailKey = { kundli: 'kundliDetails', horoscope_matching: 'horoscopeDetails', gemstone: 'gemstoneDetails', vastu: 'vastuDetails' }[service.type];
        const payload = { ...basePayload };
        if (detailKey) payload[detailKey] = vals[detailKey];
        const res = await consultationBookingsApi.create(payload);
        booking = res.booking;
      }

      toast.success('Booking created! Redirecting to payment...');

      // Immediately open Razorpay for payment — the "VERY IMPORTANT" Kundli flow.
      const order = await consultationBookingsApi.createPaymentOrder(booking._id, 'razorpay');
      await openCheckout({
        key: RAZORPAY_KEY_ID,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        order_id: order.gatewayOrderId,
        name: 'Astro Sanatan Shakti',
        description: service.name,
        prefill: { name: user?.name, email: vals.contactEmail, contact: vals.contactMobile },
        theme: { color: '#7A1F2B' },
        handler: async (response) => {
          try {
            await consultationBookingsApi.verifyPayment(booking._id, {
              gatewayOrderId: response.razorpay_order_id,
              gatewayPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            toast.success('Payment successful! Your consultation is confirmed.');
            navigate(`/consultation/booking/${booking._id}/success`);
          } catch (err) {
            toast.error(getErrorMessage(err));
            navigate('/account/consultations');
          }
        },
        modal: {
          ondismiss: () => {
            toast.error('Payment not completed. You can retry from "My Consultations".');
            navigate('/account/consultations');
          },
        },
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEO title={`Book ${service.name}`} description={service.description} />
      <div className="container-page">
        <Breadcrumbs items={[{ label: 'Consultation', to: '/consultation' }, { label: service.name }]} />
      </div>

      <div className="container-page grid grid-cols-1 gap-10 pb-16 lg:grid-cols-[1fr_1.4fr]">
        <div>
          {service.image?.url && <AppImage src={service.image.url} alt={service.name} className="mb-5 aspect-video w-full rounded-sm object-cover" />}
          <h1 className="font-display text-3xl">{service.name}</h1>
          <p className="mt-3 text-sm text-night-900/70">{service.description}</p>
          <div className="mt-4 flex items-center gap-4 text-sm text-night-900/60">
            <span className="flex items-center gap-1"><Clock size={14} /> {service.duration} mins</span>
            <span className="flex items-center gap-1"><ShieldCheck size={14} /> Certified Astrologers</span>
          </div>
          <p className="mt-4 font-display text-3xl text-maroon-700">₹{service.price}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-6">
          <h2 className="font-display text-xl">Book Your Consultation</h2>

          {DetailFields && <DetailFields register={register} errors={errors} />}

          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <legend className="col-span-full mb-1 text-sm font-semibold uppercase tracking-wide text-gold-600">Your Details</legend>
            <input {...register('currentCity')} placeholder="Current City" className="input-field" />
            <input {...register('language')} placeholder="Preferred Language" className="input-field" />
            <input {...register('contactMobile', { required: true, pattern: /^[0-9]{10}$/ })} placeholder="Phone Number" className="input-field" />
            {errors.contactMobile && <p className="field-error">Valid 10-digit mobile number required</p>}
            <input type="email" {...register('contactEmail')} placeholder="Email" className="input-field" />
          </fieldset>

          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <legend className="col-span-full mb-1 text-sm font-semibold uppercase tracking-wide text-gold-600">Appointment</legend>
            <div>
              <label className="label-field">Preferred Date</label>
              <input type="date" {...register('appointmentDate', { required: true })} className="input-field" min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="label-field">Preferred Time</label>
              <input type="time" {...register('appointmentTime', { required: true })} className="input-field" />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Meeting Mode</label>
              <select {...register('meetingMode', { required: true })} className="input-field">
                {MEETING_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </fieldset>

          <div>
            <label className="label-field">Your Problem / What would you like to know?</label>
            <textarea {...register('problem')} rows={2} className="input-field" />
          </div>
          <div>
            <label className="label-field">Additional Notes</label>
            <textarea {...register('additionalNotes')} rows={2} className="input-field" />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Processing...' : `Book Now & Pay ₹${service.price}`}
          </button>
          <p className="text-center text-xs text-night-900/40">You'll be redirected to secure Razorpay checkout immediately after booking.</p>
        </form>
      </div>
    </>
  );
}
